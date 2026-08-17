import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '../auth/SessionProvider';
import { deleteRow, selectMany } from '../../lib/supabase/crud';
import { supabase } from '../../lib/supabase/client';
import type { EffectiveHabitationPermission, FriendGroup, HabitationPermission, LocationType, ShareInvite } from '../../types/database';

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

export function canManageSharing(permission: EffectiveHabitationPermission | null | undefined): boolean {
  return permission === 'owner' || permission === 'proprietaire';
}

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

export function formatInviteQrValue(code: string): string {
  return `${INVITE_QR_PREFIX}${code}`;
}

export type ParsedScannedCode = { type: 'friend'; code: string } | { type: 'invite'; code: string } | { type: 'unknown' };

export function parseScannedCode(raw: string): ParsedScannedCode {
  if (raw.startsWith(FRIEND_QR_PREFIX)) return { type: 'friend', code: raw.slice(FRIEND_QR_PREFIX.length) };
  if (raw.startsWith(INVITE_QR_PREFIX)) return { type: 'invite', code: raw.slice(INVITE_QR_PREFIX.length) };
  return { type: 'unknown' };
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
      const { error } = await supabase.rpc('send_friend_request', { p_friend_code: friendCode.trim().toUpperCase() });
      if (error) throw error;
    },
    onSuccess: () => invalidateFriendships(queryClient),
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
    onSuccess: () => invalidateFriendships(queryClient),
  });
}

export function useRespondToFriendship() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { friendshipId: string; accept: boolean }) => {
      const { error } = await supabase.rpc('respond_to_friendship', { p_friendship_id: input.friendshipId, p_accept: input.accept });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateFriendships(queryClient);
      queryClient.invalidateQueries({ queryKey: ['habitationShares'] });
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

// === Groupes ===============================================================

export function useFriendGroups() {
  const { session } = useSession();
  return useQuery({
    queryKey: ['friendGroups'],
    enabled: !!session,
    queryFn: () => selectMany<FriendGroup>('friend_groups', undefined, 'created_at'),
  });
}

export function useCreateFriendGroup() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string): Promise<FriendGroup> => {
      const { data, error } = await supabase.from('friend_groups').insert({ owner_id: session!.user.id, name }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['friendGroups'] }),
  });
}

export function useUpdateFriendGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; name: string }) => {
      const { error } = await supabase.from('friend_groups').update({ name: input.name }).eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['friendGroups'] }),
  });
}

export function useDeleteFriendGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteRow('friend_groups', id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friendGroups'] });
      queryClient.invalidateQueries({ queryKey: ['groupMembers'] });
      queryClient.invalidateQueries({ queryKey: ['habitationShares'] });
    },
  });
}

export function useGroupMembers(groupId: string | undefined) {
  return useQuery({
    queryKey: ['groupMembers', groupId],
    enabled: !!groupId,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.from('friend_group_members').select('friend_user_id').eq('group_id', groupId!);
      if (error) throw error;
      return (data ?? []).map((row) => row.friend_user_id);
    },
  });
}

// Toutes les appartenances, tous groupes confondus (RLS scope déjà à MES
// groupes) — utilisé par l'écran Amis pour classer chaque ami sous son/ses
// groupe(s) sans un hook par groupe (impossible en boucle, règles des Hooks).
export function useAllGroupMemberships() {
  const { session } = useSession();
  return useQuery({
    queryKey: ['groupMembers', 'all'],
    enabled: !!session,
    queryFn: async (): Promise<{ groupId: string; friendUserId: string }[]> => {
      const { data, error } = await supabase.from('friend_group_members').select('group_id, friend_user_id');
      if (error) throw error;
      return (data ?? []).map((row) => ({ groupId: row.group_id, friendUserId: row.friend_user_id }));
    },
  });
}

export function useAddGroupMember(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (friendUserId: string) => {
      const { error } = await supabase.from('friend_group_members').insert({ group_id: groupId, friend_user_id: friendUserId });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['groupMembers'] }),
  });
}

export function useRemoveGroupMember(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (friendUserId: string) => {
      const { error } = await supabase.from('friend_group_members').delete().eq('group_id', groupId).eq('friend_user_id', friendUserId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['groupMembers'] }),
  });
}

// === Partage d'Habitation ==================================================

export type HabitationShareEntry = {
  id: string;
  habitationId: string;
  permission: HabitationPermission;
  sharedWithUserId: string | null;
  sharedWithUserDisplayName: string | null;
  sharedWithGroupId: string | null;
  sharedWithGroupName: string | null;
  createdAt: string;
};

export function useHabitationShares(habitationId: string | undefined) {
  return useQuery({
    queryKey: ['habitationShares', habitationId],
    enabled: !!habitationId,
    queryFn: async (): Promise<HabitationShareEntry[]> => {
      const { data, error } = await supabase.rpc('list_habitation_shares', { p_habitation_id: habitationId! });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        habitationId: habitationId!,
        permission: row.permission as HabitationPermission,
        sharedWithUserId: row.shared_with_user_id,
        sharedWithUserDisplayName: row.shared_with_user_display_name,
        sharedWithGroupId: row.shared_with_group_id,
        sharedWithGroupName: row.shared_with_group_name,
        createdAt: row.created_at,
      }));
    },
  });
}

// habitationId fait partie du payload (pas un argument du hook) : la fiche
// ami/groupe doit pouvoir upsert sur PLUSIEURS Habitations différentes
// depuis une seule liste rendue en boucle, où appeler un hook par ligne
// serait invalide (règles des Hooks) — même raisonnement que
// useCreateObjet/useCreateObjetsBulk (inventory/queries.ts). Une Habitation
// n'a qu'une seule ligne de partage par ami/groupe (index unique partiel
// côté base) — passe par upsert_habitation_share() plutôt qu'un .upsert()
// client, qui ne peut pas cibler fiablement un index partiel.

type ShareTarget = { userId: string } | { groupId: string };

// Clé exacte lue par useSharesForUser/useSharesForGroup selon la cible —
// factorisée ici car utilisée à la fois pour l'invalidation ET la mise à
// jour optimiste ci-dessous (onMutate doit écrire dans la MÊME clé que
// celle que l'écran appelant lit, sinon rien ne bouge à l'écran).
function shareTargetQueryKey(target: ShareTarget) {
  return 'userId' in target ? (['habitationShares', 'forUser', target.userId] as const) : (['habitationShares', 'forGroup', target.groupId] as const);
}

export function useUpsertHabitationShare() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { habitationId: string; target: ShareTarget; permission: HabitationPermission }) => {
      // `supabase gen types` ne sait pas que ces deux paramètres SQL sont
      // nullable (un seul des deux est fourni à la fois, voir la fonction) —
      // le cast documente que c'est volontaire, pas un oubli de typage.
      const { error } = await supabase.rpc('upsert_habitation_share', {
        p_habitation_id: input.habitationId,
        p_shared_with_user_id: ('userId' in input.target ? input.target.userId : null) as string,
        p_shared_with_group_id: ('groupId' in input.target ? input.target.groupId : null) as string,
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
      const queryKey = shareTargetQueryKey(input.target);
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
              sharedWithUserId: 'userId' in input.target ? input.target.userId : null,
              sharedWithUserDisplayName: null,
              sharedWithGroupId: 'groupId' in input.target ? input.target.groupId : null,
              sharedWithGroupName: null,
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
    // ['habitationShares', habitationId]) : useSharesForUser/useSharesForGroup
    // lisent sous des clés ['habitationShares', 'forUser'|'forGroup', id] —
    // la clé étroite ne les matchait jamais. Se déclenche APRÈS la mise à
    // jour optimiste ci-dessus, pour réconcilier avec la valeur réelle du
    // serveur (id définitif, etc.) une fois la requête terminée.
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['habitationShares'] }),
  });
}

export function useDeleteHabitationShare() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { shareId: string; habitationId: string; target: ShareTarget }) => deleteRow('habitation_shares', input.shareId),
    onMutate: async (input) => {
      const queryKey = shareTargetQueryKey(input.target);
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

// Partages tenus par UN ami précis, tous cibles d'Habitation confondus —
// la RLS de habitation_shares filtre déjà à ce que JE gère (mes propres
// Habitations, ou celles où j'ai un partage 'proprietaire'), donc filtrer
// juste par shared_with_user_id suffit, pas besoin d'un can_manage_ côté
// client. Utilisé par la fiche Ami (une ligne par Habitation à moi).
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
        sharedWithUserId: row.shared_with_user_id,
        sharedWithUserDisplayName: null,
        sharedWithGroupId: row.shared_with_group_id,
        sharedWithGroupName: null,
        createdAt: row.created_at,
      }));
    },
  });
}

// Pendant de useSharesForUser mais pour un groupe — utilisé par la
// configuration de partage d'un groupe entier.
export function useSharesForGroup(groupId: string | undefined) {
  return useQuery({
    queryKey: ['habitationShares', 'forGroup', groupId],
    enabled: !!groupId,
    queryFn: async (): Promise<HabitationShareEntry[]> => {
      const { data, error } = await supabase.from('habitation_shares').select('*').eq('shared_with_group_id', groupId!);
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        habitationId: row.habitation_id,
        permission: row.permission as HabitationPermission,
        sharedWithUserId: row.shared_with_user_id,
        sharedWithUserDisplayName: null,
        sharedWithGroupId: row.shared_with_group_id,
        sharedWithGroupName: null,
        createdAt: row.created_at,
      }));
    },
  });
}

// === Invitations (Partager mon code / Inviter un invité) ================

export function useCreateShareInvite() {
  return useMutation({
    mutationFn: async (input: {
      habitationIds: string[];
      permission: HabitationPermission;
      targetType: 'friend' | 'guest';
    }): Promise<ShareInvite> => {
      const { data, error } = await supabase.rpc('create_share_invite', {
        p_habitation_ids: input.habitationIds,
        p_permission: input.permission,
        p_target_type: input.targetType,
      });
      if (error) throw error;
      return data as ShareInvite;
    },
  });
}
