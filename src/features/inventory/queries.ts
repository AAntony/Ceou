import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useSession } from '../../features/auth/SessionProvider';
import { logClientError } from '../../lib/errorLogging';
import { uploadImage } from '../../lib/images/pickAndUploadImage';
import { selectMany, selectOne } from '../../lib/supabase/crud';
import { supabase } from '../../lib/supabase/client';
import type { Conteneur, Emplacement, Habitation, HabitationFavorite, LocationType, Objet, ObjetDeplacement, Piece } from '../../types/database';
import { newId } from '../../lib/uuid';
import { deleteOp, insertOp, rpcOp, updateOp, uploadOp, useLocalFirstWrite, type WriteTable } from '../../lib/writeQueue';
import { isSingleSpaceHabitation } from './constants';
import { planEntityPhoto } from './entityPhoto';
import { locationChainFrom, lookupsFromCache } from './offlineSnapshot';
import type { SearchIndexEntry } from '../search/queries';

// L'INVENTAIRE S'ÉCRIT À TRAVERS LA FILE, ET PLUS DIRECTEMENT.
//
// Toutes les mutations ci-dessous passent par `useLocalFirstWrite` : elles
// construisent la ligne localement (l'identifiant vient de `newId`, plus de la
// base), l'appliquent au cache, et confient l'écriture à la file — qui la
// garde tant qu'il n'y a pas de réseau, la persiste sur le disque et la rejoue
// au retour. Voir lib/writeQueue pour le mécanisme.
//
// LES PHOTOS PASSENT PAR LA FILE ELLES AUSSI, depuis qu'une opération
// `upload` y existe : on garde le chemin LOCAL du fichier choisi, on l'affiche
// tout de suite, et l'envoi vers le stockage attend le réseau comme le reste
// (voir useSetObjetPhotoFromLocal).
//
// CE QUI RESTE EN LIGNE : `useCreateObjetsBulk`, le scan IA multi-objets. Il
// téléverse une photo PAR objet détecté et compte les échecs pour les
// annoncer ; le faire passer en file demanderait de repenser ce compte rendu,
// et c'est de toute façon une fonctionnalité qui appelle un service distant
// pour reconnaître les objets — elle ne peut pas fonctionner sans réseau.
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
/**
 * Le nom tel qu il est en cache, pour raconter une ecriture qui ne recoit
 * qu un identifiant (suppressions, deplacement, photo).
 *
 * Lu AVANT que l ecriture ne parte : apres, la ligne peut avoir disparu du
 * cache — et c est justement le cas d une suppression.
 */
function nameFromCache(client: ReturnType<typeof useQueryClient>, key: QueryKey): string {
  return client.getQueryData<{ name?: string }>(key)?.name ?? '';
}

/**
 * LA PHOTO D'UNE ENTITÉ, SANS ATTENDRE LE RÉSEAU.
 *
 * Les quatre niveaux — habitation, pièce, emplacement, conteneur — passent
 * par ici, et c'est le but : le défaut corrigé était identique sur les
 * quatre, et le laisser réparer quatre fois garantissait qu'un cinquième
 * niveau naîtrait cassé.
 *
 * Rend de quoi compléter l'écriture appelante : la colonne à fondre dans son
 * `patch`, les opérations d'envoi à ajouter à son lot, et le `patches` qui
 * fait apparaître la photo à l'écran tout de suite.
 */
function entityPhotoWrite(params: {
  // L'OBJET A REJOINT LA LISTE, ET IL AURAIT DÛ Y ÊTRE DEPUIS LE DÉBUT.
  //
  // Le commentaire ci-dessus annonçait qu'un cinquième niveau naîtrait
  // cassé s'il ne passait pas par ici. C'est exactement ce qui s'était
  // produit — sauf que l'objet n'est pas né après les quatre autres, il
  // était là AVANT, avec son propre envoi immédiat que la correction des
  // quatre n'a pas touché. Hors ligne, ajouter un objet avec une photo
  // rendait « l'ajout de la photo a échoué » et perdait la photo.
  level: 'habitation' | 'piece' | 'emplacement' | 'conteneur' | 'objet';
  table: WriteTable;
  entityId: string;
  userId: string;
  photo: string | null | undefined;
}) {
  const plan = planEntityPhoto(params);
  return {
    column: plan.column,
    ops: plan.ops,
    patches: plan.localUri === null ? [] : [{ id: params.entityId, patch: { photo_url: plan.localUri } }],
    /** Ce que la ligne DU CACHE doit porter, quand elle vient d'être créée. */
    cachedPhotoUrl: plan.localUri ?? plan.column.photo_url ?? null,
  };
}

/**
 * CE QUI VIENT D'ÊTRE CRÉÉ DOIT EXISTER SOUS SA PROPRE CLÉ, PAS SEULEMENT
 * DANS LA LISTE DE SON PARENT.
 *
 * LE DÉFAUT QUE ÇA CORRIGE, signalé à l'usage : hors-ligne, créer un
 * emplacement puis y déplacer un objet affichait « null · Cellier » sur
 * l'accueil. La cause n'était pas dans le déplacement : `lookupsFromCache`
 * cherche les entités sous `['emplacement', id]`, et une création ne
 * garnissait que `['emplacements', pieceId]`. L'emplacement restait donc
 * INTROUVABLE, le chemin se reconstruisait vide, et le libellé perdait son
 * contenant — puis affichait le mot « null » à sa place.
 *
 * En ligne, le rafraîchissement global rechargeait tout une seconde plus
 * tard : la faute ne pouvait se voir que sans réseau.
 *
 * LES LISTES VIDES SONT POSÉES ELLES AUSSI. Une pièce qui vient de naître
 * n'a pas d'emplacement — mais sans clé en cache, l'écran ne lit pas « rien
 * dedans », il lit « je n'ai pas la réponse », et hors-ligne il ne peut pas
 * aller la chercher. C'est la même règle que le préchargement, qui garnit
 * lui aussi les listes vides (voir seedCaches).
 */
function seedNewEntity(
  key: QueryKey,
  row: unknown,
  children: { key: QueryKey; data: unknown }[] = [],
): { key: QueryKey; data: unknown }[] {
  return [{ key, data: row }, ...children];
}

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
    const id = newId();
    const photo = entityPhotoWrite({
      level: 'habitation',
      table: 'habitations',
      entityId: id,
      userId: session!.user.id,
      photo: input.photoUrl,
    });

    const habitation: Habitation = {
      id,
      user_id: session!.user.id,
      name: input.name,
      type: input.type,
      icon: input.icon,
      // LA LIGNE PART SANS PHOTO et le cache en porte une : voir
      // entityPhotoWrite. L'adresse définitive n'existera qu'après l'envoi
      // du fichier, que la file fera juste derrière.
      photo_url: photo.column.photo_url ?? null,
      created_at: new Date().toISOString(),
    };

    const ops = [insertOp('habitations', [habitation]), ...photo.ops];
    // LES DEUX DANS LE MÊME LOT, donc dans la même mutation : la Pièce
    // référence l'Habitation, elles doivent partir dans cet ordre et
    // échouer ensemble. C'est possible parce que l'identifiant du parent
    // est connu AVANT l'écriture.
    //
    // LA LIGNE ENVOYÉE RESTE MINIMALE — la base pose elle-même les colonnes
    // absentes — mais le CACHE, lui, reçoit une Pièce complète : c'est une
    // ligne que des écrans vont lire, pas seulement écrire.
    const defaultPiece: Piece | null = isSingleSpaceHabitation(input.type)
      ? {
          id: newId(),
          habitation_id: id,
          name: input.name,
          preset_key: null,
          color: null,
          photo_url: null,
          is_default: true,
          created_at: new Date().toISOString(),
        }
      : null;
    if (defaultPiece) {
      ops.push(insertOp('pieces', [{ id: defaultPiece.id, habitation_id: id, name: input.name, is_default: true }]));
    }

    return {
      ops,
      describe: { kind: 'create', name: input.name },
      appends: [{ key: ['habitations'], row: { ...habitation, photo_url: photo.cachedPhotoUrl } }],
      sets: seedNewEntity(['habitation', id], { ...habitation, photo_url: photo.cachedPhotoUrl }, [
        // La liste des pièces est POSÉE et non complétée : une habitation
        // qui vient de naître n'en a pas d'autre, et sa clé n'existe pas
        // encore en cache — un ajout à une liste absente ne donnerait rien.
        { key: ['pieces', id], data: defaultPiece ? [defaultPiece] : [] },
        ...(defaultPiece ? [{ key: ['piece', defaultPiece.id] as QueryKey, data: defaultPiece }] : []),
        ...(defaultPiece ? [{ key: ['emplacements', defaultPiece.id] as QueryKey, data: [] }] : []),
      ]),
      result: habitation,
    };
  });
}

export function useUpdateHabitation() {
  const { session } = useSession();

  return useLocalFirstWrite((input: { id: string; name: string; type: string; icon: string; photoUrl?: string | null }) => {
    // `photoUrl` absent = photo inchangée ; `null` explicite = photo retirée.
    // Sans cette distinction, ouvrir la fiche pour renommer effacerait la
    // photo au passage.
    const photo = entityPhotoWrite({
      level: 'habitation',
      table: 'habitations',
      entityId: input.id,
      userId: session!.user.id,
      photo: input.photoUrl,
    });

    return {
      describe: { kind: 'update' as const, name: input.name },
      ops: [
        updateOp('habitations', input.id, {
          name: input.name,
          type: input.type,
          icon: input.icon,
          ...photo.column,
        }),
        ...photo.ops,
      ],
      patches: photo.patches,
      result: undefined,
    };
  });
}

export function useDeleteHabitation() {
  const queryClient = useQueryClient();
  return useLocalFirstWrite((id: string) => ({
    describe: { kind: 'delete' as const, name: nameFromCache(queryClient, ['habitation', id]) },
    ops: [deleteOp('habitations', id)],
    result: undefined,
  }));
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
  const { session } = useSession();

  return useLocalFirstWrite(
    (input: { name: string; presetKey: string | null; color?: string | null; photoUrl?: string | null }) => {
      const id = newId();
      const photo = entityPhotoWrite({
        level: 'piece',
        table: 'pieces',
        entityId: id,
        userId: session!.user.id,
        photo: input.photoUrl,
      });

      const piece: Piece = {
        id,
        habitation_id: habitationId,
        name: input.name,
        preset_key: input.presetKey,
        color: input.color ?? null,
        photo_url: photo.column.photo_url ?? null,
        is_default: false,
        created_at: new Date().toISOString(),
      };

      return {
        describe: { kind: 'create' as const, name: input.name },
        ops: [insertOp('pieces', [piece]), ...photo.ops],
        appends: [{ key: ['pieces', habitationId], row: { ...piece, photo_url: photo.cachedPhotoUrl } }],
        sets: seedNewEntity(['piece', id], { ...piece, photo_url: photo.cachedPhotoUrl }, [
          { key: ['emplacements', id], data: [] },
        ]),
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
  const { session } = useSession();
  const queryClient = useQueryClient();

  return useLocalFirstWrite(
    (input: { id: string; name?: string; presetKey?: string | null; color?: string | null; photoUrl?: string | null }) => {
      const photo = entityPhotoWrite({
        level: 'piece',
        table: 'pieces',
        entityId: input.id,
        userId: session!.user.id,
        photo: input.photoUrl,
      });

      return {
        describe: { kind: 'update' as const, name: input.name ?? nameFromCache(queryClient, ['piece', input.id]) },
        ops: [
          updateOp('pieces', input.id, {
            ...(input.name !== undefined && { name: input.name }),
            ...(input.presetKey !== undefined && { preset_key: input.presetKey }),
            ...(input.color !== undefined && { color: input.color }),
            ...photo.column,
          }),
          ...photo.ops,
        ],
        patches: photo.patches,
        result: undefined,
      };
    },
  );
}

export function useDeletePiece(_habitationId: string) {
  const queryClient = useQueryClient();
  return useLocalFirstWrite((id: string) => ({
    describe: { kind: 'delete' as const, name: nameFromCache(queryClient, ['piece', id]) },
    ops: [deleteOp('pieces', id)],
    result: undefined,
  }));
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
  const { session } = useSession();

  return useLocalFirstWrite((input: { name: string; presetKey: string | null; photoUrl?: string | null }) => {
    const id = newId();
    const photo = entityPhotoWrite({
      level: 'emplacement',
      table: 'emplacements',
      entityId: id,
      userId: session!.user.id,
      photo: input.photoUrl,
    });

    const emplacement: Emplacement = {
      id,
      piece_id: pieceId,
      name: input.name,
      preset_key: input.presetKey,
      photo_url: photo.column.photo_url ?? null,
      created_at: new Date().toISOString(),
    };

    return {
      describe: { kind: 'create' as const, name: input.name },
      ops: [insertOp('emplacements', [emplacement]), ...photo.ops],
      appends: [{ key: ['emplacements', pieceId], row: { ...emplacement, photo_url: photo.cachedPhotoUrl } }],
      sets: seedNewEntity(['emplacement', id], { ...emplacement, photo_url: photo.cachedPhotoUrl }, [
        { key: ['containerContents', 'conteneurs', 'emplacement', id], data: [] },
        { key: ['containerContents', 'objets', 'emplacement', id], data: [] },
      ]),
      result: emplacement,
    };
  });
}

export function useUpdateEmplacement(_pieceId: string) {
  const { session } = useSession();

  return useLocalFirstWrite((input: { id: string; name: string; presetKey: string | null; photoUrl?: string | null }) => {
    const photo = entityPhotoWrite({
      level: 'emplacement',
      table: 'emplacements',
      entityId: input.id,
      userId: session!.user.id,
      photo: input.photoUrl,
    });

    return {
      describe: { kind: 'update' as const, name: input.name },
      ops: [
        updateOp('emplacements', input.id, {
          name: input.name,
          preset_key: input.presetKey,
          ...photo.column,
        }),
        ...photo.ops,
      ],
      patches: photo.patches,
      result: undefined,
    };
  });
}

export function useDeleteEmplacement(_pieceId: string) {
  const queryClient = useQueryClient();
  return useLocalFirstWrite((id: string) => ({
    describe: { kind: 'delete' as const, name: nameFromCache(queryClient, ['emplacement', id]) },
    ops: [deleteOp('emplacements', id)],
    result: undefined,
  }));
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
  const { session } = useSession();

  return useLocalFirstWrite((input: { name: string; presetKey: string | null; photoUrl?: string | null }) => {
    const id = newId();
    const photo = entityPhotoWrite({
      level: 'conteneur',
      table: 'conteneurs',
      entityId: id,
      userId: session!.user.id,
      photo: input.photoUrl,
    });

    const conteneur: Conteneur = {
      id,
      name: input.name,
      preset_key: input.presetKey,
      photo_url: photo.column.photo_url ?? null,
      parent_emplacement_id: parentType === 'emplacement' ? parentId : null,
      parent_conteneur_id: parentType === 'conteneur' ? parentId : null,
      created_at: new Date().toISOString(),
    };

    return {
      describe: { kind: 'create' as const, name: input.name },
      ops: [insertOp('conteneurs', [conteneur]), ...photo.ops],
      appends: [
        {
          key: ['containerContents', 'conteneurs', parentType, parentId],
          row: { ...conteneur, photo_url: photo.cachedPhotoUrl },
        },
      ],
      sets: seedNewEntity(['conteneur', id], { ...conteneur, photo_url: photo.cachedPhotoUrl }, [
        { key: ['containerContents', 'conteneurs', 'conteneur', id], data: [] },
        { key: ['containerContents', 'objets', 'conteneur', id], data: [] },
      ]),
      result: conteneur,
    };
  });
}

export function useUpdateConteneur() {
  const { session } = useSession();

  return useLocalFirstWrite((input: { id: string; name: string; presetKey?: string | null; photoUrl?: string | null }) => {
    const photo = entityPhotoWrite({
      level: 'conteneur',
      table: 'conteneurs',
      entityId: input.id,
      userId: session!.user.id,
      photo: input.photoUrl,
    });

    return {
      describe: { kind: 'update' as const, name: input.name },
      ops: [
        updateOp('conteneurs', input.id, {
          name: input.name,
          ...(input.presetKey !== undefined && { preset_key: input.presetKey }),
          ...photo.column,
        }),
        ...photo.ops,
      ],
      patches: photo.patches,
      result: undefined,
    };
  });
}

export function useDeleteConteneur() {
  const queryClient = useQueryClient();
  return useLocalFirstWrite((id: string) => ({
    describe: { kind: 'delete' as const, name: nameFromCache(queryClient, ['conteneur', id]) },
    ops: [deleteOp('conteneurs', id)],
    result: undefined,
  }));
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
  const { session } = useSession();

  return useLocalFirstWrite(
    (input: {
      parentType: LocationType;
      parentId: string;
      name: string;
      description: string | null;
      /** Chemin LOCAL d'une photo fraîchement choisie, ou adresse déjà connue. */
      photoUrl: string | null;
      barcode?: string | null;
    }) => {
      const id = newId();
      // LA PHOTO PART PAR LA FILE, COMME CELLE DES QUATRE AUTRES NIVEAUX.
      //
      // Elle était envoyée à part, tout de suite, par l'écran appelant. Hors
      // ligne, cet envoi échouait : l'objet était créé sans sa photo, et le
      // fichier était simplement perdu — l'app invitait à « réessayer depuis
      // sa fiche », c'est-à-dire à tout refaire à la main.
      const photo = entityPhotoWrite({
        level: 'objet',
        table: 'objets',
        entityId: id,
        userId: session!.user.id,
        photo: input.photoUrl,
      });

      const objet: Objet = {
        id,
        name: input.name,
        description: input.description,
        // Ce que la BASE recevra : rien tant que le fichier n'est pas parti.
        // C'est l'opération d'envoi qui écrira l'adresse, une fois le réseau
        // revenu.
        photo_url: photo.column.photo_url ?? null,
        barcode: input.barcode ?? null,
        parent_emplacement_id: input.parentType === 'emplacement' ? input.parentId : null,
        parent_conteneur_id: input.parentType === 'conteneur' ? input.parentId : null,
        created_at: new Date().toISOString(),
      };

      // Ce que le CACHE montre : le fichier local, tout de suite. Il est déjà
      // sur l'appareil, il n'y a aucune raison d'attendre pour l'afficher.
      const cached = { ...objet, photo_url: photo.cachedPhotoUrl };

      return {
        describe: { kind: 'create' as const, name: input.name },
        ops: [insertOp('objets', [objet]), ...photo.ops],
        appends: [{ key: ['containerContents', 'objets', input.parentType, input.parentId], row: cached }],
        // SANS CETTE LIGNE L'OBJET N'EXISTE QUE DANS LA LISTE DE SON PARENT.
        //
        // Sa fiche le cherche sous `['objet', id]` : non garnie, la requête
        // part au réseau, et hors ligne elle ne revient pas. L'écran
        // n'affiche donc pas « rien », il reste sans réponse — et l'objet
        // qu'on vient de créer paraît ne pas avoir été enregistré. C'est
        // exactement le défaut que seedNewEntity existe pour éviter, et les
        // objets étaient les seuls à ne pas s'en servir.
        //
        // L'historique et le chemin d'emplacement sont posés vides pour la
        // même raison : un objet qui vient de naître n'a ni l'un ni l'autre,
        // et leurs écrans doivent lire « rien » plutôt qu'attendre.
        sets: seedNewEntity(['objet', id], cached, [
          { key: ['objetHistory', id], data: [] },
          { key: ['objetLocationChain', id], data: [] },
        ]),
        // RENDU TOUT DE SUITE, et c'est ce qui permet aux écrans d'enchaîner :
        // ils font `await mutateAsync(...)` puis naviguent vers l'objet créé.
        // L'identifiant étant déjà connu, il n'y a rien à attendre du serveur.
        result: cached,
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
  const queryClient = useQueryClient();
  return useLocalFirstWrite((patch: Partial<Pick<Objet, 'name' | 'description' | 'photo_url'>>) => ({
    describe: { kind: 'update' as const, name: patch.name ?? nameFromCache(queryClient, ['objet', id]) },
    ops: [updateOp('objets', id, patch)],
    result: undefined,
  }));
}

// RETIRÉ : `useSetObjetPhoto`, qui posait l'adresse d'une photo téléversée
// APRÈS la création d'un objet. Sa raison d'être était la séquence même qu'on
// vient de supprimer — créer, puis envoyer le fichier, puis écrire l'adresse.
// La photo part désormais dans la même écriture que l'objet (voir
// useCreateObjet), il n'y a plus d'« après ». Le laisser en place aurait
// invité à reprendre le motif qui cassait le hors ligne.
//
// `useSetObjetPhotoFromLocal`, juste en dessous, reste : c'est le chemin de
// la fiche d'un objet DÉJÀ créé, et lui passe bien par la file.

/**
 * CHANGER LA PHOTO D'UN OBJET SANS ATTENDRE LE RÉSEAU.
 *
 * Le défaut corrigé, signalé à l'usage : hors-ligne, choisir une photo ne
 * faisait RIEN, et après reconnexion l'ancienne était toujours là. La cause
 * était que l'écran téléversait d'abord et n'écrivait qu'ensuite — sans
 * réseau, le téléversement échouait et rien n'était mis en file.
 *
 * L'ordre est inversé : on prend le chemin LOCAL du fichier, on l'affiche
 * immédiatement, et c'est la file qui se charge de l'envoyer puis d'écrire
 * l'adresse définitive. Le fichier choisi est déjà sur l'appareil : il n'y a
 * aucune raison d'attendre pour le montrer.
 *
 * `patches` touche l'objet ET sa ligne dans l'index de recherche — les deux
 * portent une colonne `photo_url`, donc l'accueil se met à jour tout seul.
 */
export function useSetObjetPhotoFromLocal(objetId: string) {
  const { session } = useSession();
  const queryClient = useQueryClient();

  return useLocalFirstWrite((localUri: string) => ({
    ops: [
      uploadOp({
        uri: localUri,
        bucket: 'objets',
        // MÊME CHEMIN QU'AVANT, à l'octet près : le fichier de stockage porte
        // l'identifiant de l'objet, donc une nouvelle photo remplace la
        // précédente au lieu d'en accumuler.
        path: `${session!.user.id}/${objetId}.jpg`,
        then: { table: 'objets', id: objetId, column: 'photo_url' },
      }),
    ],
    describe: { kind: 'photo' as const, name: nameFromCache(queryClient, ['objet', objetId]) },
    patches: [{ id: objetId, patch: { photo_url: localUri } }],
    result: undefined,
  }));
}

export function useDeleteObjet() {
  const queryClient = useQueryClient();
  return useLocalFirstWrite((id: string) => ({
    describe: { kind: 'delete' as const, name: nameFromCache(queryClient, ['objet', id]) },
    ops: [deleteOp('objets', id)],
    result: undefined,
  }));
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

    // UN CHEMIN VIDE VEUT DIRE « JE NE SAIS PAS », PAS « IL N'Y A RIEN ».
    //
    // Il l'est quand la destination est introuvable en cache — ce que
    // seedNewEntity rend désormais très improbable, mais qu'un cache
    // incomplet peut encore produire. Les deux affichages qui en dépendent
    // sont alors laissés TELS QUELS : écrire un chemin vide effacerait le
    // fil d'Ariane de la fiche, et réécrire l'index de recherche y poserait
    // `parent_label: null` par-dessus une valeur juste. Mieux vaut un
    // affichage périmé d'une seconde, que le rafraîchissement corrigera,
    // qu'un affichage faux.
    const chain = locationChainFrom(
      {
        emplacementId: destination.type === 'emplacement' ? destination.id : null,
        conteneurId: destination.type === 'conteneur' ? destination.id : null,
      },
      lookupsFromCache(queryClient),
    );

    const sets: { key: QueryKey; data: unknown }[] = [];
    if (chain.length > 0) sets.push({ key: ['objetLocationChain', objetId], data: chain });

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

    // L'ACCUEIL AUSSI, et il a sa propre représentation. Il ne lit ni les
    // objets ni les listes de contenants, mais l'index de recherche — une
    // ligne à plat par objet, qui recopie le nom de sa pièce, de son
    // habitation et de son contenant direct. Rien de tout cela ne se déduit
    // d'un `parent_conteneur_id` : il faut réécrire ces champs.
    //
    // Défaut signalé à l'usage : « hors-ligne, quand je déplace un objet, la
    // modification ne se voit pas dans la page d'accueil ». En ligne, le
    // rafraîchissement global rechargeait l'index une seconde plus tard.
    //
    // La clé porte l'identifiant du compte : on la retrouve par PRÉFIXE
    // plutôt que de le faire remonter jusqu'ici.
    const habitationNode = chain.find((node) => node.kind === 'habitation');
    const pieceNode = chain.find((node) => node.kind === 'piece');
    const parentNode = chain[chain.length - 1];

    if (chain.length > 0) {
      for (const [key, entries] of queryClient.getQueriesData<SearchIndexEntry[]>({ queryKey: ['searchIndex'] })) {
        if (!entries) continue;
        sets.push({
          key,
          data: entries.map((entry) =>
            entry.kind === 'objet' && entry.id === objetId
              ? {
                  ...entry,
                  piece_id: pieceNode?.id ?? entry.piece_id,
                  piece_name: pieceNode?.name ?? entry.piece_name,
                  habitation_id: habitationNode?.id ?? entry.habitation_id,
                  habitation_name: habitationNode?.name ?? entry.habitation_name,
                  // Le contenant DIRECT, c'est-à-dire le dernier maillon du
                  // chemin. Nul si l'objet est posé à même sa pièce — et
                  // c'est un null que l'accueil doit savoir ne pas écrire
                  // (voir locationLine).
                  parent_label:
                    parentNode && parentNode.kind !== 'piece' && parentNode.kind !== 'habitation' ? parentNode.name : null,
                }
              : entry,
          ),
        });
      }
    }

    return {
      describe: { kind: 'move' as const, name: objet?.name ?? '' },
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
