import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useSession } from '../../features/auth/SessionProvider';
import { logClientError } from '../../lib/errorLogging';
import { uploadImage } from '../../lib/images/pickAndUploadImage';
import { selectMany, selectOne } from '../../lib/supabase/crud';
import { supabase } from '../../lib/supabase/client';
import type { Conteneur, Emplacement, Habitation, HabitationFavorite, LocationType, Objet, ObjetDeplacement, Piece } from '../../types/database';
import { newId } from '../../lib/uuid';
import { deleteOp, insertOp, rpcOp, updateOp, useLocalFirstWrite } from '../../lib/writeQueue';
import { isSingleSpaceHabitation } from './constants';
import { locationChainFrom, lookupsFromCache } from './offlineSnapshot';

// L'INVENTAIRE S'ÉCRIT À TRAVERS LA FILE, ET PLUS DIRECTEMENT.
//
// Toutes les mutations ci-dessous passent par `useLocalFirstWrite` : elles
// construisent la ligne localement (l'identifiant vient de `newId`, plus de la
// base), l'appliquent au cache, et confient l'écriture à la file — qui la
// garde tant qu'il n'y a pas de réseau, la persiste sur le disque et la rejoue
// au retour. Voir lib/writeQueue pour le mécanisme.
//
// CE QUI RESTE EN LIGNE, et pourquoi : tout ce qui suppose un TÉLÉVERSEMENT.
// Une photo n'est pas une ligne de base, c'est un fichier à envoyer vers le
// stockage ; la mettre en file demanderait de garder le fichier sur l'appareil
// et de le rejouer séparément — une seconde file, avec ses propres échecs.
// `useCreateObjetsBulk` et `useSetObjetPhoto` gardent donc l'ancien
// fonctionnement et échouent sans réseau, comme avant.
//
// L'HORODATAGE DES LIGNES LOCALES est posé ici et non laissé au défaut de la
// base : la ligne optimiste est affichée AVANT d'être écrite, et les listes
// sont triées par `created_at`. Sans valeur, une création apparaîtrait au
// mauvais endroit puis sauterait à sa place au retour du réseau.

// Toute mutation qui change un nom/une position dans la hiérarchie doit
// aussi invalider le cache de recherche globale (search_index()) — sinon le
// dashboard d'accueil resterait périmé après une modif faite ailleurs.
// Tout ce qui derive de l'arborescence entiere : l'index de recherche ET
// les compteurs d'objets des listes. Les trois se periment exactement aux
// memes moments (creation, suppression ou deplacement d'un objet n'importe
// ou), les invalider ensemble evite qu'une rangee annonce « 12 objets »
// alors que l'accueil en montre 13.
function invalidateSearchIndex(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['searchIndex'] });
  queryClient.invalidateQueries({ queryKey: ['habitationObjectCounts'] });
  queryClient.invalidateQueries({ queryKey: ['habitationNodeCounts'] });
}

// === Habitations =====================================================

export function useHabitations() {
  const { session } = useSession();
  return useQuery({
    queryKey: ['habitations'],
    enabled: !!session,
    queryFn: () => selectMany<Habitation>('habitations', undefined, 'created_at'),
  });
}

export function useHabitation(id: string) {
  return useQuery({
    queryKey: ['habitation', id],
    queryFn: () => selectOne<Habitation>('habitations', id),
  });
}

export function useCreateHabitation() {
  const { session } = useSession();

  return useLocalFirstWrite((input: { name: string; type: string; icon: string; photoUrl?: string | null }) => {
    const habitation: Habitation = {
      id: newId(),
      user_id: session!.user.id,
      name: input.name,
      type: input.type,
      icon: input.icon,
      photo_url: input.photoUrl ?? null,
      created_at: new Date().toISOString(),
    };

    const ops = [insertOp('habitations', [habitation])];
    // LES DEUX DANS LE MÊME LOT, donc dans la même mutation : la Pièce
    // référence l'Habitation, elles doivent partir dans cet ordre et
    // échouer ensemble. C'est possible parce que l'identifiant du parent
    // est connu AVANT l'écriture.
    if (isSingleSpaceHabitation(input.type)) {
      ops.push(insertOp('pieces', [{ id: newId(), habitation_id: habitation.id, name: input.name, is_default: true }]));
    }

    return { ops, appends: [{ key: ['habitations'], row: habitation }], result: habitation };
  });
}

export function useUpdateHabitation() {
  return useLocalFirstWrite((input: { id: string; name: string; type: string; icon: string; photoUrl?: string | null }) => ({
    ops: [
      // `photoUrl` absent = photo inchangée ; `null` explicite = photo
      // retirée. Sans cette distinction, ouvrir la fiche pour renommer
      // effacerait la photo au passage.
      updateOp('habitations', input.id, {
        name: input.name,
        type: input.type,
        icon: input.icon,
        ...(input.photoUrl !== undefined && { photo_url: input.photoUrl }),
      }),
    ],
    result: undefined,
  }));
}

export function useDeleteHabitation() {
  return useLocalFirstWrite((id: string) => ({ ops: [deleteOp('habitations', id)], result: undefined }));
}

// === Favoris d'Habitation (Phase 9b) ==================================
// Filtre l'accueil (search_index() côté SQL) aux seules Habitations
// favorites — évite qu'ajouter un ami ne noie l'accueil sous ses objets.
// Existence-based (pas de colonne booléenne), même pattern que
// habitation_shares/friend_group_members.

function favoriteQueryKey() {
  return ['habitationFavorites'] as const;
}

export function useHabitationFavorites() {
  const { session } = useSession();
  return useQuery({
    queryKey: favoriteQueryKey(),
    enabled: !!session,
    queryFn: () => selectMany<HabitationFavorite>('habitation_favorites'),
  });
}

export function useToggleHabitationFavorite() {
  const { session } = useSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { habitationId: string; isFavorite: boolean }) => {
      if (input.isFavorite) {
        const { error } = await supabase
          .from('habitation_favorites')
          .delete()
          .eq('habitation_id', input.habitationId)
          .eq('user_id', session!.user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('habitation_favorites')
          .upsert({ habitation_id: input.habitationId, user_id: session!.user.id }, { onConflict: 'habitation_id,user_id' });
        if (error) throw error;
      }
    },
    onMutate: async (input) => {
      const queryKey = favoriteQueryKey();
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<HabitationFavorite[]>(queryKey);
      queryClient.setQueryData<HabitationFavorite[]>(queryKey, (current) => {
        const list = current ?? [];
        if (input.isFavorite) return list.filter((f) => f.habitation_id !== input.habitationId);
        return [...list, { habitation_id: input.habitationId, user_id: session!.user.id, created_at: new Date().toISOString() }];
      });
      return { queryKey, previous };
    },
    onError: (error, input, context) => {
      // Le rollback optimiste remet l'étoile dans son état d'origine sans
      // rien dire à l'utilisateur (choix conservé : un favori raté ne
      // mérite pas une alerte bloquante) — mais l'échec doit au moins
      // laisser une trace exploitable côté diagnostic.
      logClientError(error, { source: 'toggle_habitation_favorite', habitationId: input.habitationId });
      if (context) queryClient.setQueryData(context.queryKey, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: favoriteQueryKey() });
      invalidateSearchIndex(queryClient);
    },
  });
}

// === Pièces ===========================================================

export function usePieces(habitationId: string) {
  return useQuery({
    queryKey: ['pieces', habitationId],
    queryFn: () => selectMany<Piece>('pieces', { column: 'habitation_id', value: habitationId }, 'created_at'),
  });
}

export function usePiece(id: string) {
  return useQuery({
    queryKey: ['piece', id],
    queryFn: () => selectOne<Piece>('pieces', id),
  });
}

export function useCreatePiece(habitationId: string) {
  return useLocalFirstWrite(
    (input: { name: string; presetKey: string | null; color?: string | null; photoUrl?: string | null }) => {
      const piece: Piece = {
        id: newId(),
        habitation_id: habitationId,
        name: input.name,
        preset_key: input.presetKey,
        color: input.color ?? null,
        photo_url: input.photoUrl ?? null,
        is_default: false,
        created_at: new Date().toISOString(),
      };

      return {
        ops: [insertOp('pieces', [piece])],
        appends: [{ key: ['pieces', habitationId], row: piece }],
        result: piece,
      };
    },
  );
}

// L'IDENTIFIANT DU PARENT N'EST PLUS UTILISÉ ICI, et le paramètre reste
// pourtant. Il servait à invalider `['pieces', habitationId]` après coup ;
// c'est désormais la règle globale de queryClient qui s'en charge, au moment
// où l'écriture aboutit réellement. Le garder évite de retoucher les cinq
// écrans qui appellent ces hooks — et le jour où une mise à jour optimiste
// plus fine sera nécessaire, il sera déjà là.
export function useUpdatePiece(_habitationId: string) {
  return useLocalFirstWrite(
    (input: { id: string; name?: string; presetKey?: string | null; color?: string | null; photoUrl?: string | null }) => ({
      ops: [
        updateOp('pieces', input.id, {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.presetKey !== undefined && { preset_key: input.presetKey }),
          ...(input.color !== undefined && { color: input.color }),
          ...(input.photoUrl !== undefined && { photo_url: input.photoUrl }),
        }),
      ],
      result: undefined,
    }),
  );
}

export function useDeletePiece(_habitationId: string) {
  return useLocalFirstWrite((id: string) => ({ ops: [deleteOp('pieces', id)], result: undefined }));
}

// === Emplacements ======================================================

export function useEmplacements(pieceId: string) {
  return useQuery({
    queryKey: ['emplacements', pieceId],
    enabled: !!pieceId,
    queryFn: () => selectMany<Emplacement>('emplacements', { column: 'piece_id', value: pieceId }, 'created_at'),
  });
}

// Utilisé par l'écran Plan (Phase 7) pour afficher nom/icône des Emplacements
// déjà épinglés sur le plan, quelle que soit la pièce à laquelle ils
// appartiennent — un seul aller-retour réseau pour toutes les pièces posées
// sur ce plan plutôt qu'un hook par pièce (le nombre de pièces varie d'un
// plan à l'autre, incompatible avec les règles des Hooks appelés en boucle).
export function useEmplacementsForPieces(pieceIds: string[]) {
  return useQuery({
    queryKey: ['emplacementsForPieces', [...pieceIds].sort()],
    enabled: pieceIds.length > 0,
    queryFn: async (): Promise<Emplacement[]> => {
      const { data, error } = await supabase.from('emplacements').select('*').in('piece_id', pieceIds);
      if (error) throw error;
      return data;
    },
  });
}

export function useEmplacement(id: string) {
  return useQuery({
    queryKey: ['emplacement', id],
    queryFn: () => selectOne<Emplacement>('emplacements', id),
  });
}

export function useCreateEmplacement(pieceId: string) {
  return useLocalFirstWrite((input: { name: string; presetKey: string | null; photoUrl?: string | null }) => {
    const emplacement: Emplacement = {
      id: newId(),
      piece_id: pieceId,
      name: input.name,
      preset_key: input.presetKey,
      photo_url: input.photoUrl ?? null,
      created_at: new Date().toISOString(),
    };

    return {
      ops: [insertOp('emplacements', [emplacement])],
      appends: [{ key: ['emplacements', pieceId], row: emplacement }],
      result: emplacement,
    };
  });
}

export function useUpdateEmplacement(_pieceId: string) {
  return useLocalFirstWrite((input: { id: string; name: string; presetKey: string | null; photoUrl?: string | null }) => ({
    ops: [
      updateOp('emplacements', input.id, {
        name: input.name,
        preset_key: input.presetKey,
        ...(input.photoUrl !== undefined && { photo_url: input.photoUrl }),
      }),
    ],
    result: undefined,
  }));
}

export function useDeleteEmplacement(_pieceId: string) {
  return useLocalFirstWrite((id: string) => ({ ops: [deleteOp('emplacements', id)], result: undefined }));
}

// === Conteneurs + Objets (contenu d'un Emplacement ou d'un Conteneur) ===

const PARENT_COLUMN: Record<LocationType, 'parent_emplacement_id' | 'parent_conteneur_id'> = {
  emplacement: 'parent_emplacement_id',
  conteneur: 'parent_conteneur_id',
};

export function useContainerContents(parentType: LocationType, parentId: string) {
  const column = PARENT_COLUMN[parentType];

  const conteneursQuery = useQuery({
    queryKey: ['containerContents', 'conteneurs', parentType, parentId],
    enabled: !!parentId,
    queryFn: () => selectMany<Conteneur>('conteneurs', { column, value: parentId }, 'created_at'),
  });

  const objetsQuery = useQuery({
    queryKey: ['containerContents', 'objets', parentType, parentId],
    enabled: !!parentId,
    queryFn: () => selectMany<Objet>('objets', { column, value: parentId }, 'created_at'),
  });

  return {
    conteneurs: conteneursQuery.data ?? [],
    objets: objetsQuery.data ?? [],
    isLoading: conteneursQuery.isLoading || objetsQuery.isLoading,
    // Une seule des deux requêtes en échec suffit à rendre l'écran faux (il
    // afficherait la moitié du contenu comme si c'était le tout) — d'où le
    // OU, et un refetch qui relance les deux sans se demander laquelle a
    // lâché.
    isError: conteneursQuery.isError || objetsQuery.isError,
    refetch: () => {
      conteneursQuery.refetch();
      objetsQuery.refetch();
    },
  };
}

function invalidateContainerContents(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['containerContents'] });
  invalidateSearchIndex(queryClient);
}

export function useConteneur(id: string) {
  return useQuery({
    queryKey: ['conteneur', id],
    queryFn: () => selectOne<Conteneur>('conteneurs', id),
  });
}

export function useCreateConteneur(parentType: LocationType, parentId: string) {
  return useLocalFirstWrite((input: { name: string; presetKey: string | null; photoUrl?: string | null }) => {
    const conteneur: Conteneur = {
      id: newId(),
      name: input.name,
      preset_key: input.presetKey,
      photo_url: input.photoUrl ?? null,
      parent_emplacement_id: parentType === 'emplacement' ? parentId : null,
      parent_conteneur_id: parentType === 'conteneur' ? parentId : null,
      created_at: new Date().toISOString(),
    };

    return {
      ops: [insertOp('conteneurs', [conteneur])],
      appends: [{ key: ['containerContents', 'conteneurs', parentType, parentId], row: conteneur }],
      result: conteneur,
    };
  });
}

export function useUpdateConteneur() {
  return useLocalFirstWrite((input: { id: string; name: string; presetKey?: string | null; photoUrl?: string | null }) => ({
    ops: [
      updateOp('conteneurs', input.id, {
        name: input.name,
        ...(input.presetKey !== undefined && { preset_key: input.presetKey }),
        ...(input.photoUrl !== undefined && { photo_url: input.photoUrl }),
      }),
    ],
    result: undefined,
  }));
}

export function useDeleteConteneur() {
  return useLocalFirstWrite((id: string) => ({ ops: [deleteOp('conteneurs', id)], result: undefined }));
}

// === Objets ============================================================

export function useObjet(id: string) {
  return useQuery({
    queryKey: ['objet', id],
    queryFn: () => selectOne<Objet>('objets', id),
  });
}

// parentType/parentId font partie du payload de la mutation (pas des
// arguments du hook) : AddObjetModal ne connaît la destination qu'à la toute
// fin de son flux (objet d'abord, emplacement ensuite — voir AiPhotoScanFlow
// et ObjetFormBody, mode "collecte"), donc le hook doit pouvoir être appelé
// une seule fois puis déclenché avec une destination connue seulement au
// moment du clic. CreateObjetModal (destination déjà connue dès l'ouverture)
// passe simplement les mêmes valeurs à chaque appel, sans rien y perdre.
export function useCreateObjet() {
  return useLocalFirstWrite(
    (input: {
      parentType: LocationType;
      parentId: string;
      name: string;
      description: string | null;
      photoUrl: string | null;
      barcode?: string | null;
    }) => {
      const objet: Objet = {
        id: newId(),
        name: input.name,
        description: input.description,
        photo_url: input.photoUrl,
        barcode: input.barcode ?? null,
        parent_emplacement_id: input.parentType === 'emplacement' ? input.parentId : null,
        parent_conteneur_id: input.parentType === 'conteneur' ? input.parentId : null,
        created_at: new Date().toISOString(),
      };

      return {
        ops: [insertOp('objets', [objet])],
        appends: [{ key: ['containerContents', 'objets', input.parentType, input.parentId], row: objet }],
        // RENDU TOUT DE SUITE, et c'est ce qui permet aux écrans d'enchaîner :
        // ils font `await mutateAsync(...)` puis naviguent vers l'objet créé,
        // ou lui attachent une photo. L'identifiant étant déjà connu, il n'y a
        // rien à attendre du serveur.
        result: objet,
      };
    },
  );
}

// Utilisé par le scan photo IA (AiPhotoScanFlow) : une détection par
// objet retenu, créées en série (pas Promise.all) pour rester lisible si une
// erreur survient au milieu du lot — un échec partiel laisse les objets déjà
// créés en place plutôt que de tout annuler, cohérent avec le reste de l'app
// qui n'a pas de notion de transaction multi-lignes côté client. La photo de
// chaque objet est uploadée APRÈS l'insert de sa ligne, même séquence que
// ObjetFormBody.handleSubmit (l'id de l'objet sert de nom de fichier).
// Même raisonnement que useCreateObjet ci-dessus : parentType/parentId dans
// le payload, pas dans les arguments du hook.
export function useCreateObjetsBulk() {
  const { session } = useSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      parentType: LocationType;
      parentId: string;
      items: { name: string; localPhotoUri: string }[];
    }): Promise<{ created: number; photoFailures: number }> => {
      if (!session) throw new Error('no_session');
      let photoFailures = 0;

      for (const item of input.items) {
        const { data: objet, error } = await supabase
          .from('objets')
          .insert({
            name: item.name,
            description: null,
            photo_url: null,
            barcode: null,
            parent_emplacement_id: input.parentType === 'emplacement' ? input.parentId : null,
            parent_conteneur_id: input.parentType === 'conteneur' ? input.parentId : null,
          })
          .select()
          .single();
        if (error) throw error;

        try {
          const photoUrl = await uploadImage(item.localPhotoUri, { bucket: 'objets', path: `${session.user.id}/${objet.id}.jpg` });
          const { error: updateError } = await supabase.from('objets').update({ photo_url: photoUrl }).eq('id', objet.id);
          if (updateError) throw updateError;
        } catch (err) {
          // Déjà COMPTÉ et signalé à l'utilisateur ("N photos non
          // enregistrées"), mais jamais journalisé jusqu'ici : on savait
          // qu'une photo avait échoué, jamais pourquoi.
          logClientError(err, { source: 'create_objets_bulk', step: 'photo_upload', objetId: objet.id });
          photoFailures += 1;
        }
      }

      return { created: input.items.length, photoFailures };
    },
    onSuccess: () => invalidateContainerContents(queryClient),
  });
}

export function useUpdateObjet(id: string) {
  return useLocalFirstWrite((patch: Partial<Pick<Objet, 'name' | 'description' | 'photo_url'>>) => ({
    ops: [updateOp('objets', id, patch)],
    result: undefined,
  }));
}

// La photo d'un objet qu'on vient de créer : elle est téléversée APRÈS la
// création (il faut l'id de l'objet pour nommer le fichier), donc après
// l'invalidation déclenchée par cette création. Sans une écriture qui passe
// elle aussi par une mutation, l'objet resterait affiché sans sa photo
// jusqu'au prochain chargement — cf. la règle de src/lib/queryClient.ts, qui
// ne voit que les mutations.
export function useSetObjetPhoto() {
  return useMutation({
    mutationFn: async (input: { objetId: string; photoUrl: string }) => {
      const { error } = await supabase.from('objets').update({ photo_url: input.photoUrl }).eq('id', input.objetId);
      if (error) throw error;
    },
  });
}

export function useDeleteObjet() {
  return useLocalFirstWrite((id: string) => ({ ops: [deleteOp('objets', id)], result: undefined }));
}

export type ObjetLocationNode = {
  kind: 'habitation' | 'piece' | 'emplacement' | 'conteneur';
  id: string;
  name: string;
  preset_key: string | null;
  // Vrai uniquement pour la pièce fantôme d'une habitation mono-espace
  // (Garage, Cave...), que le fil d'ariane écarte de l'affichage — la fiche
  // objet, elle, garde ce maillon pour le lien vers le plan.
  is_default: boolean;
};

export function useObjetLocationChain(objetId: string) {
  return useQuery({
    queryKey: ['objetLocationChain', objetId],
    queryFn: async (): Promise<ObjetLocationNode[]> => {
      const { data, error } = await supabase.rpc('objet_location_chain', { p_objet_id: objetId });
      if (error) throw error;
      return data as unknown as ObjetLocationNode[];
    },
  });
}

export function useObjetHistory(objetId: string) {
  return useQuery({
    queryKey: ['objetHistory', objetId],
    queryFn: async (): Promise<ObjetDeplacement[]> => {
      const { data, error } = await supabase
        .from('objet_deplacements')
        .select('*')
        .eq('objet_id', objetId)
        .order('moved_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

/**
 * L'appel de déplacement, sans React.
 *
 * Extrait de `useMoveObjet` parce que l'assistant vocal déplace un objet
 * choisi À L'EXÉCUTION : il ne peut pas instancier un hook par objet.
 */
export async function moveObjet(objetId: string, destination: { type: LocationType; id: string }): Promise<void> {
  const { error } = await supabase.rpc('move_objet', {
    p_objet_id: objetId,
    p_to_type: destination.type,
    p_to_id: destination.id,
  });
  if (error) throw error;
}

/**
 * Remet un objet là où il était juste avant.
 *
 * L'origine est relue dans l'HISTORIQUE plutôt que retenue côté client : c'est
 * la seule source qui fasse foi, et ça évite une requête supplémentaire sur
 * chaque déplacement pour un retour en arrière qui reste rare.
 *
 * L'annulation est elle-même un déplacement, donc journalisée à son tour.
 * L'historique dit ce qui s'est passé, erreurs et corrections comprises ;
 * effacer la ligne fautive reviendrait à mentir sur le passé.
 */
export async function undoLastMove(objetId: string): Promise<void> {
  const { data, error } = await supabase
    .from('objet_deplacements')
    .select('from_location_type, from_location_id')
    .eq('objet_id', objetId)
    .order('moved_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;

  // Un objet créé directement à sa place n'a pas d'origine à retrouver.
  const type = data?.from_location_type as LocationType | null | undefined;
  if (!data?.from_location_id || !type) throw new Error('no_previous_location');

  await moveObjet(objetId, { type, id: data.from_location_id });
}

/**
 * Ce qu'un déplacement rend périmé, quelle que soit sa provenance.
 *
 * Un seul endroit pour les deux chemins (fiche objet et assistant vocal) :
 * deux listes d'invalidation à maintenir en parallèle finiraient par
 * diverger, et l'écart ne se verrait que sur un écran resté à l'ancien
 * emplacement.
 */
export function invalidateAfterMove(queryClient: ReturnType<typeof useQueryClient>, objetId: string) {
  queryClient.invalidateQueries({ queryKey: ['objet', objetId] });
  queryClient.invalidateQueries({ queryKey: ['objetHistory', objetId] });
  queryClient.invalidateQueries({ queryKey: ['objetLocationChain', objetId] });
  invalidateContainerContents(queryClient);
}

export function useMoveObjet(objetId: string) {
  const queryClient = useQueryClient();

  return useLocalFirstWrite((destination: { type: LocationType; id: string }) => {
    const objet = queryClient.getQueryData<Objet>(['objet', objetId]);

    // CE QUE LE DÉPLACEMENT CHANGE À L'ÉCRAN, ET QUE RIEN NE DEVINE.
    //
    // Trois affichages mentent sinon, et l'un d'eux se voit immédiatement :
    // le fil d'Ariane de la fiche continuait d'annoncer l'ancien endroit juste
    // après le déplacement. Constaté à l'essai, hors-ligne.
    //
    // En ligne, le rafraîchissement global corrigeait tout ça tout seul une
    // seconde plus tard — c'est pour ça que ça ne s'était jamais vu.
    const previousType: LocationType | null = objet?.parent_conteneur_id ? 'conteneur' : objet?.parent_emplacement_id ? 'emplacement' : null;
    const previousId = objet?.parent_conteneur_id ?? objet?.parent_emplacement_id ?? null;

    const moved: Objet | undefined = objet && {
      ...objet,
      parent_emplacement_id: destination.type === 'emplacement' ? destination.id : null,
      parent_conteneur_id: destination.type === 'conteneur' ? destination.id : null,
    };

    const sets: { key: QueryKey; data: unknown }[] = [
      {
        key: ['objetLocationChain', objetId],
        data: locationChainFrom(
          {
            emplacementId: destination.type === 'emplacement' ? destination.id : null,
            conteneurId: destination.type === 'conteneur' ? destination.id : null,
          },
          lookupsFromCache(queryClient),
        ),
      },
    ];

    // L'objet quitte la liste de son ancien contenant et entre dans celle du
    // nouveau. Chirurgie CIBLÉE sur ces deux clés : un retrait généralisé par
    // identifiant l'aurait aussi effacé de l'index de recherche, où il a
    // toujours sa place.
    if (previousType && previousId && previousId !== destination.id) {
      const fromKey: QueryKey = ['containerContents', 'objets', previousType, previousId];
      const previousList = queryClient.getQueryData<Objet[]>(fromKey);
      if (previousList) sets.push({ key: fromKey, data: previousList.filter((row) => row.id !== objetId) });
    }

    if (moved && previousId !== destination.id) {
      const toKey: QueryKey = ['containerContents', 'objets', destination.type, destination.id];
      const nextList = queryClient.getQueryData<Objet[]>(toKey);
      if (nextList) sets.push({ key: toKey, data: [...nextList.filter((row) => row.id !== objetId), moved] });
    }

    return {
      // UNE FONCTION SQL ET NON DEUX ÉCRITURES : `move_objet` change le parent
      // ET journalise le déplacement, dans la même transaction. La décomposer
      // côté client pour la faire tenir dans la file perdrait cette garantie —
      // un objet déplacé sans trace, ou une trace sans déplacement.
      ops: [rpcOp('move_objet', { p_objet_id: objetId, p_to_type: destination.type, p_to_id: destination.id })],
      // Un `rpc` ne dit pas quelles lignes il touche : l'affichage optimiste
      // doit donc être déclaré ici. L'HISTORIQUE, lui, n'est pas simulé — il
      // apparaîtra au retour du réseau. Inventer une ligne d'historique
      // reviendrait à écrire dans le journal ce qui n'a pas encore eu lieu.
      patches: [
        {
          id: objetId,
          patch: {
            parent_emplacement_id: destination.type === 'emplacement' ? destination.id : null,
            parent_conteneur_id: destination.type === 'conteneur' ? destination.id : null,
          },
        },
      ],
      sets,
      result: undefined,
    };
  });
}

/**
 * Nombre d'objets par Habitation, pour la liste des Habitations.
 *
 * Requete separee plutot qu'une colonne calculee sur `habitations` : le
 * compte depend de toute l'arborescence en dessous, il changerait a chaque
 * ajout d'objet n'importe ou et invaliderait la liste entiere.
 */
export function useHabitationObjectCounts() {
  const { session } = useSession();
  return useQuery({
    queryKey: ['habitationObjectCounts', session?.user.id],
    enabled: !!session,
    queryFn: async (): Promise<Map<string, number>> => {
      const { data, error } = await supabase.rpc('habitation_object_counts');
      if (error) throw error;
      return new Map((data ?? []).map((row) => [row.habitation_id, Number(row.objet_count)]));
    },
  });
}

/** Cle de cache d'un noeud dans les compteurs d'une habitation. */
export function nodeCountKey(kind: 'piece' | 'emplacement' | 'conteneur', id: string): string {
  return `${kind}:${id}`;
}

/**
 * Compteurs de TOUS les noeuds d'une habitation, en un seul appel.
 *
 * Volontairement a la maille de l'habitation et non de l'ecran : la
 * navigation reste dans la meme habitation d'un bout a l'autre, donc le
 * resultat est charge une fois puis resservi depuis le cache a chaque
 * descente d'un niveau. Un hook par ecran aurait fait une requete par
 * niveau traverse.
 */
export function useHabitationNodeCounts(habitationId: string | null | undefined) {
  return useQuery({
    queryKey: ['habitationNodeCounts', habitationId],
    enabled: !!habitationId,
    queryFn: async (): Promise<Map<string, number>> => {
      const { data, error } = await supabase.rpc('habitation_node_counts', { p_habitation_id: habitationId! });
      if (error) throw error;
      return new Map(
        (data ?? []).map((row) => [
          nodeCountKey(row.node_kind as 'piece' | 'emplacement' | 'conteneur', row.node_id),
          Number(row.objet_count),
        ]),
      );
    },
  });
}

/**
 * Habitation d'appartenance d'un noeud, pour brancher `useHabitationNodeCounts`
 * depuis un ecran qui ne connait que son propre identifiant.
 *
 * `staleTime: Infinity` : un Emplacement ne change jamais d'habitation dans
 * l'app (il n'existe aucun deplacement a ce niveau), la reponse est donc
 * definitive pour la duree de la session.
 */
export function useHabitationIdForNode(kind: 'piece' | 'emplacement' | 'conteneur', id: string) {
  return useQuery({
    queryKey: ['habitationIdForNode', kind, id],
    staleTime: Infinity,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.rpc('habitation_id_for_node', { p_kind: kind, p_id: id });
      if (error) throw error;
      return data ?? null;
    },
  });
}
