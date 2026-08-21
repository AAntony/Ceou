import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '../auth/SessionProvider';
import { deleteRow, selectMany } from '../../lib/supabase/crud';
import { inviteWebUrl } from '../../lib/links';
import { notifyFriendEvent } from '../notifications/push';
import { supabase } from '../../lib/supabase/client';
import type { EffectiveHabitationPermission, Habitation, HabitationPermission, LocationType, ShareInvite } from '../../types/database';

// Résout le niveau de droit courant de l'utilisateur sur une Habitation
// ('owner' | 'proprietaire' | 'modification' | 'consultation' | null) via
// get_effective_habitation_permission() — fonction security definer côté
// serveur, seule source de vérité sur les droits (voir la migration RLS
// sharing_rls.sql). Utilisé partout où l'app doit décider d'afficher ou non
// un bouton d'ajout/édition/suppression, plutôt qu'une logique dupliquée
// par écran.
export function useHabitationPermission(habitationId: string | undefined) {
  return useQuery({
    queryKey: ['habitationPermission', habitationId],
    enabled: !!habitationId,
    queryFn: async (): Promise<EffectiveHabitationPermission | null> => {
      const { data, error } = await supabase.rpc('get_effective_habitation_permission', {
        p_habitation_id: habitationId!,
      });
      if (error) throw error;
      return data as EffectiveHabitationPermission | null;
    },
  });
}

// Résout l'habitation_id d'un Emplacement/Conteneur — ContainerContents
// (écran partagé) ne connaît que parentType/parentId, pas l'Habitation.
export function useLocationHabitationId(parentType: LocationType, parentId: string) {
  return useQuery({
    queryKey: ['locationHabitationId', parentType, parentId],
    enabled: !!parentId,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.rpc('resolve_location_habitation', { p_type: parentType, p_id: parentId });
      if (error) throw error;
      return data;
    },
  });
}

// Combine les deux résolutions ci-dessus — le raccourci que la plupart des
// écrans d'Emplacement/Conteneur veulent réellement (juste "puis-je
// modifier ici ?"), sans avoir à enchaîner les deux hooks à la main partout.
export function useLocationPermission(parentType: LocationType, parentId: string) {
  const { data: habitationId } = useLocationHabitationId(parentType, parentId);
  return useHabitationPermission(habitationId ?? undefined);
}

// piece_habitation() est déjà exposée (fonction security definer réutilisée
// telle quelle par la RLS, voir sharing_rls.sql) — pas besoin d'un wrapper
// SQL dédié pour ce cas simple, contrairement à resolve_location_habitation
// qui doit choisir entre deux fonctions selon parentType.
export function usePiecePermission(pieceId: string | undefined) {
  const { data: habitationId } = useQuery({
    queryKey: ['pieceHabitationId', pieceId],
    enabled: !!pieceId,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.rpc('piece_habitation', { p_piece_id: pieceId! });
      if (error) throw error;
      return data;
    },
  });
  return useHabitationPermission(habitationId ?? undefined);
}

// Petits helpers pour ne pas éparpiller la logique "ce niveau suffit-il ?"
// dans chaque écran — l'ordre owner > proprietaire > modification >
// consultation reflète exactement le modèle de droits du plan Phase 8.
const PERMISSION_RANK: Record<EffectiveHabitationPermission, number> = {
  owner: 3,
  proprietaire: 3,
  modification: 2,
  consultation: 1,
};

export function canModify(permission: EffectiveHabitationPermission | null | undefined): boolean {
  return !!permission && PERMISSION_RANK[permission] >= PERMISSION_RANK.modification;
}

// NOTE (audit 2026-08-19) : il existait ici un `canManageSharing()` symétrique
// (owner | proprietaire), supprimé car jamais appelé. Ce n'est pas un oubli :
// la capacité qu'il devait garder — repartager une Habitation dont on n'est
// que 'proprietaire' — est délibérément non exposée côté UI (voir la note de
// FriendDetailSheet), qui ne propose que les Habitations réellement possédées.
// Le serveur, lui, l'autorise déjà (upsert_habitation_share vérifie
// can_manage_habitation_sharing). Si cette capacité est ouverte un jour, ce
// helper est à réécrire en trois lignes ici.

// === QR : encoder/décoder ce qu'une pastille peut représenter ===========
// Un friend_code (identité permanente) et un share_invite.code (offre
// éphémère avec Habitations+droit déjà configurés) ont la même forme brute
// — ce préfixe est ce qui permet au scanner de savoir laquelle des deux
// opérations déclencher sans ambiguïté.

const FRIEND_QR_PREFIX = 'ceou:friend:';
const INVITE_QR_PREFIX = 'ceou:invite:';

export function formatFriendCodeQrValue(code: string): string {
  return `${FRIEND_QR_PREFIX}${code}`;
}

// Une invitation encode désormais une URL https et non plus la chaîne brute
// `ceou:invite:CODE`. Raison : l'appareil photo natif d'un téléphone ne sait
// rien faire d'un schéma inconnu, et une invitation est justement destinée à
// quelqu'un qui n'a PAS encore l'app — il voyait du texte incompréhensible.
// Le code ami, lui, garde sa forme brute : il ne s'échange qu'entre deux
// personnes qui ont déjà l'app, donc toujours via le scanner intégré.
export function formatInviteQrValue(code: string): string {
  return inviteWebUrl(code);
}

export type ParsedScannedCode = { type: 'friend'; code: string } | { type: 'invite'; code: string } | { type: 'unknown' };

export function parseScannedCode(raw: string): ParsedScannedCode {
  const trimmed = raw.trim();
  if (trimmed.startsWith(FRIEND_QR_PREFIX)) return { type: 'friend', code: trimmed.slice(FRIEND_QR_PREFIX.length) };
  // Forme historique, toujours acceptée : des QR déjà imprimés ou partagés
  // avant la bascule vers l'URL continuent de fonctionner.
  if (trimmed.startsWith(INVITE_QR_PREFIX)) return { type: 'invite', code: trimmed.slice(INVITE_QR_PREFIX.length) };

  const fromUrl = inviteCodeFromUrl(trimmed);
  if (fromUrl) return { type: 'invite', code: fromUrl };

  return { type: 'unknown' };
}

// Accepte aussi bien l'URL web (`https://.../?invite=CODE`) que le lien
// profond (`ceou://invite?code=CODE`) : le scanner intégré, l'appareil photo
// natif et le bouton de la page web produisent ces trois formes.
export function inviteCodeFromUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    return url.searchParams.get('invite') ?? url.searchParams.get('code');
  } catch {
    return null;
  }
}

// === Amis =================================================================

export type FriendshipEntry = {
  id: string;
  status: 'pending' | 'accepted' | 'declined';
  direction: 'incoming' | 'outgoing';
  otherUserId: string;
  otherDisplayName: string | null;
  otherFriendCode: string;
  otherAvatarUrl: string | null;
  sourceInviteId: string | null;
  createdAt: string;
  respondedAt: string | null;
};

// list_friendships() (security definer) résout le nom/avatar de l'AUTRE
// partie de chaque relation — la RLS de `profiles` restreint sinon la
// lecture à sa propre ligne, un join client classique ne verrait rien.
export function useFriendships() {
  const { session } = useSession();
  return useQuery({
    queryKey: ['friendships'],
    enabled: !!session,
    queryFn: async (): Promise<FriendshipEntry[]> => {
      const { data, error } = await supabase.rpc('list_friendships');
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        status: row.status as FriendshipEntry['status'],
        direction: row.direction as FriendshipEntry['direction'],
        otherUserId: row.other_user_id,
        otherDisplayName: row.other_display_name,
        otherFriendCode: row.other_friend_code,
        otherAvatarUrl: row.other_avatar_url,
        sourceInviteId: row.source_invite_id,
        createdAt: row.created_at,
        respondedAt: row.responded_at,
      }));
    },
  });
}

function invalidateFriendships(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['friendships'] });
}

export function useSendFriendRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (friendCode: string) => {
      const { data, error } = await supabase.rpc('send_friend_request', { p_friend_code: friendCode.trim().toUpperCase() });
      if (error) throw error;
      return data;
    },
    onSuccess: (friendshipId) => {
      invalidateFriendships(queryClient);
      // La demande est déjà enregistrée à ce stade ; la notification est un
      // supplément « au mieux » qui ne conditionne rien (voir notifyFriendEvent).
      if (friendshipId) notifyFriendEvent('friend_request', friendshipId);
    },
  });
}

export function useRedeemShareInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await supabase.rpc('redeem_share_invite', { p_code: code });
      if (error) throw error;
      return data as { type: 'guest'; granted: boolean } | { type: 'friend'; friendship_id: string };
    },
    onSuccess: (result) => {
      invalidateFriendships(queryClient);
      // Une invitation « ami » crée une demande EN ATTENTE côté créateur du
      // code : c'est lui qu'il faut prévenir, exactement comme un ajout par
      // code ami. Une invitation « invité », elle, s'applique immédiatement
      // et n'attend l'accord de personne — rien à notifier.
      if (result.type === 'friend') notifyFriendEvent('friend_request', result.friendship_id);
    },
  });
}

export function useRespondToFriendship() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { friendshipId: string; accept: boolean }) => {
      const { error } = await supabase.rpc('respond_to_friendship', { p_friendship_id: input.friendshipId, p_accept: input.accept });
      if (error) throw error;
    },
    onSuccess: (_data, input) => {
      invalidateFriendships(queryClient);
      queryClient.invalidateQueries({ queryKey: ['habitationShares'] });
      // Seule l'acceptation est notifiée. Un refus ne l'est délibérément
      // pas : personne n'a besoin d'une alerte pour apprendre ça, et la
      // demande disparaît simplement de la liste de l'expéditeur.
      if (input.accept) notifyFriendEvent('friend_accepted', input.friendshipId);
    },
  });
}

// Annuler une demande envoyée (encore pending) ou en refuser une reçue sans
// passer par respond_to_friendship (pas de partage à appliquer côté
// refus/annulation) — un simple delete suffit, la RLS de friendships
// autorise déjà les deux parties.
export function useCancelFriendRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (friendshipId: string) => deleteRow('friendships', friendshipId),
    onSuccess: () => invalidateFriendships(queryClient),
  });
}

export function useRemoveFriend() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (friendUserId: string) => {
      const { error } = await supabase.rpc('remove_friend', { p_friend_user_id: friendUserId });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateFriendships(queryClient);
      queryClient.invalidateQueries({ queryKey: ['habitationShares'] });
    },
  });
}

// === Partage d'Habitation ==================================================

export type HabitationShareEntry = {
  id: string;
  habitationId: string;
  permission: HabitationPermission;
  sharedWithUserId: string;
  sharedWithUserDisplayName: string | null;
  createdAt: string;
};

// NOTE (audit 2026-08-19) : un `useHabitationShares(habitationId)` vivait ici
// — lecture des partages D'UNE Habitation via la RPC list_habitation_shares.
// Supprimé car jamais appelé : l'UI attaque le partage par l'AMI
// (useSharesForUser ci-dessous), jamais par l'Habitation. La fonction SQL
// list_habitation_shares est volontairement CONSERVÉE côté base — la retirer
// demanderait une migration pour zéro gain, et c'est exactement la lecture
// dont aurait besoin un futur écran « qui a accès à cette Habitation ? ».

// habitationId fait partie du payload (pas un argument du hook) : la fiche
// ami doit pouvoir upsert sur PLUSIEURS Habitations différentes depuis une
// seule liste rendue en boucle, où appeler un hook par ligne serait invalide
// (règles des Hooks) — même raisonnement que useCreateObjet/useCreateObjetsBulk
// (inventory/queries.ts). Une Habitation n'a qu'une seule ligne de partage
// par ami (index unique partiel côté base) — passe par upsert_habitation_share()
// plutôt qu'un .upsert() client, qui ne peut pas cibler fiablement un index
// partiel.
function shareUserQueryKey(userId: string) {
  return ['habitationShares', 'forUser', userId] as const;
}

export function useUpsertHabitationShare() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { habitationId: string; sharedWithUserId: string; permission: HabitationPermission }) => {
      const { error } = await supabase.rpc('upsert_habitation_share', {
        p_habitation_id: input.habitationId,
        p_shared_with_user_id: input.sharedWithUserId,
        p_permission: input.permission,
      });
      if (error) throw error;
    },
    // Mise à jour optimiste : le picker de droit doit bouger AU TAP, pas
    // après l'aller-retour réseau (écriture + relecture) — retour utilisateur
    // du 2026-08-17 ("le changement visuel est très long") après que
    // l'invalidation ci-dessous a été élargie pour vraiment déclencher un
    // refetch (avant, elle ne matchait même pas la bonne clé, donc l'écran ne
    // bougeait jamais du tout — voir l'historique de ce fichier).
    onMutate: async (input) => {
      const queryKey = shareUserQueryKey(input.sharedWithUserId);
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<HabitationShareEntry[]>(queryKey);
      queryClient.setQueryData<HabitationShareEntry[]>(queryKey, (current) => {
        const list = current ?? [];
        const index = list.findIndex((s) => s.habitationId === input.habitationId);
        if (index === -1) {
          return [
            ...list,
            {
              id: `optimistic-${input.habitationId}`,
              habitationId: input.habitationId,
              permission: input.permission,
              sharedWithUserId: input.sharedWithUserId,
              sharedWithUserDisplayName: null,
              createdAt: new Date().toISOString(),
            },
          ];
        }
        const next = [...list];
        next[index] = { ...next[index], permission: input.permission };
        return next;
      });
      return { queryKey, previous };
    },
    onError: (_error, _input, context) => {
      if (context) queryClient.setQueryData(context.queryKey, context.previous);
    },
    // Invalide TOUT le préfixe ['habitationShares', ...] (pas la seule clé
    // ['habitationShares', habitationId]) : useSharesForUser lit sous une clé
    // ['habitationShares', 'forUser', id] — la clé étroite ne la matchait
    // jamais. Se déclenche APRÈS la mise à jour optimiste ci-dessus, pour
    // réconcilier avec la valeur réelle du serveur (id définitif, etc.) une
    // fois la requête terminée.
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['habitationShares'] }),
  });
}

export function useDeleteHabitationShare() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { shareId: string; habitationId: string; sharedWithUserId: string }) => deleteRow('habitation_shares', input.shareId),
    onMutate: async (input) => {
      const queryKey = shareUserQueryKey(input.sharedWithUserId);
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<HabitationShareEntry[]>(queryKey);
      queryClient.setQueryData<HabitationShareEntry[]>(queryKey, (current) =>
        (current ?? []).filter((s) => s.habitationId !== input.habitationId),
      );
      return { queryKey, previous };
    },
    onError: (_error, _input, context) => {
      if (context) queryClient.setQueryData(context.queryKey, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['habitationShares'] }),
  });
}

// Partages tenus par UN ami précis — la RLS de habitation_shares filtre déjà
// à ce que JE gère (mes propres Habitations, ou celles où j'ai un partage
// 'proprietaire'), donc filtrer juste par shared_with_user_id suffit, pas
// besoin d'un can_manage_ côté client. Utilisé par la fiche Ami (une ligne
// par Habitation à moi).
export function useSharesForUser(friendUserId: string | undefined) {
  return useQuery({
    queryKey: ['habitationShares', 'forUser', friendUserId],
    enabled: !!friendUserId,
    queryFn: async (): Promise<HabitationShareEntry[]> => {
      const { data, error } = await supabase.from('habitation_shares').select('*').eq('shared_with_user_id', friendUserId!);
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        habitationId: row.habitation_id,
        permission: row.permission as HabitationPermission,
        sharedWithUserId: row.shared_with_user_id!,
        sharedWithUserDisplayName: null,
        createdAt: row.created_at,
      }));
    },
  });
}

// Habitations que CET ami possède et a partagées AVEC MOI (sens inverse de
// useSharesForUser, qui liste ce que JE partage avec lui) — utilisé par la
// fiche Ami pour donner accès à ce qu'il a rendu consultable. Filtrer juste
// par owner suffit : la RLS de `habitations` (habitations_select) n'autorise
// déjà le SELECT que si je suis le propriétaire OU qu'un partage existe —
// PostgREST ne peut donc renvoyer que des lignes réellement partagées avec
// moi, pas besoin de refaire ce filtre côté client.
export function useHabitationsSharedByFriend(friendUserId: string | undefined) {
  return useQuery({
    queryKey: ['habitationsSharedByFriend', friendUserId],
    enabled: !!friendUserId,
    queryFn: () => selectMany<Habitation>('habitations', { column: 'user_id', value: friendUserId! }, 'created_at'),
  });
}

// === Invitations (Partager mon code / Inviter un invité) ================

export type ShareInviteOptions = {
  habitationIds: string[];
  permission: HabitationPermission;
  targetType: 'friend' | 'guest';
  // null = illimité / n'expire jamais. Le serveur force ces deux valeurs à
  // (1, +7 jours) pour une invitation d'ami, quoi qu'envoie le client.
  maxUses: number | null;
  expiresAt: string | null;
  label: string | null;
};

export function useCreateShareInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ShareInviteOptions): Promise<ShareInvite> => {
      const { data, error } = await supabase.rpc('create_share_invite', {
        p_habitation_ids: input.habitationIds,
        p_permission: input.permission,
        p_target_type: input.targetType,
        // supabase gen types ne modélise pas la nullabilité des PARAMÈTRES
        // de fonction : il les déclare non-nullables alors que NULL est
        // précisément ce qui encode « illimité » et « n’expire jamais » côté
        // SQL (DEFAULT NULL, voir la migration 20260820120000). L’assertion
        // porte donc sur une limite du générateur, pas sur notre modèle — ne
        // pas la « corriger » en interdisant null côté client.
        p_max_uses: input.maxUses as number,
        p_expires_at: input.expiresAt as string,
        p_label: input.label as string,
      });
      if (error) throw error;
      return data as ShareInvite;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['myShareInvites'] }),
  });
}

// === Gestion des codes par leur propriétaire ============================

export type ShareInviteEntry = {
  id: string;
  code: string;
  label: string | null;
  targetType: 'friend' | 'guest';
  permission: HabitationPermission;
  habitationIds: string[];
  habitationNames: string[];
  maxUses: number | null;
  useCount: number;
  expiresAt: string | null;
  createdAt: string;
};

type ShareInviteRow = {
  id: string;
  code: string;
  label: string | null;
  target_type: 'friend' | 'guest';
  permission: HabitationPermission;
  habitation_ids: string[];
  habitation_names: string[];
  max_uses: number | null;
  use_count: number;
  expires_at: string | null;
  created_at: string;
};

export function useMyShareInvites() {
  return useQuery({
    queryKey: ['myShareInvites'],
    queryFn: async (): Promise<ShareInviteEntry[]> => {
      const { data, error } = await supabase.rpc('list_my_share_invites');
      if (error) throw error;
      return ((data ?? []) as ShareInviteRow[]).map((row) => ({
        id: row.id,
        code: row.code,
        label: row.label,
        targetType: row.target_type,
        permission: row.permission,
        habitationIds: row.habitation_ids ?? [],
        habitationNames: row.habitation_names ?? [],
        maxUses: row.max_uses,
        useCount: row.use_count,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
      }));
    },
  });
}

export function useUpdateShareInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      inviteId: string;
      maxUses: number | null;
      expiresAt: string | null;
      resetUses: boolean;
      label: string | null;
    }): Promise<ShareInvite> => {
      const { data, error } = await supabase.rpc('update_share_invite', {
        p_invite_id: input.inviteId,
        // Même limite du générateur que dans useCreateShareInvite ci-dessus.
        p_max_uses: input.maxUses as number,
        p_expires_at: input.expiresAt as string,
        p_reset_uses: input.resetUses,
        p_label: input.label as string,
      });
      if (error) throw error;
      return data as ShareInvite;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['myShareInvites'] }),
  });
}

// Suppression directe : la policy share_invites_delete (created_by =
// auth.uid()) suffit, pas besoin d'une RPC. L'effet de bord est VOULU et
// central au modèle « l'accès suit le code » — supprimer la ligne emporte en
// cascade share_invite_redemptions, donc coupe instantanément l'accès de tous
// les visiteurs entrés par ce code.
export function useDeleteShareInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) => deleteRow('share_invites', inviteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myShareInvites'] });
      queryClient.invalidateQueries({ queryKey: ['searchIndex'] });
    },
  });
}
