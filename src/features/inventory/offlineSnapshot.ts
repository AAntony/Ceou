import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { INVENTORY_SNAPSHOT_KEY } from '../../lib/queryClient';
import { selectMany } from '../../lib/supabase/crud';
import { supabase } from '../../lib/supabase/client';
import type {
  Conteneur,
  Database,
  Emplacement,
  Habitation,
  LocationType,
  Objet,
  Piece,
  Plan,
  PlanDoor,
  PlanForme,
  PlanPin,
} from '../../types/database';
import { useSession } from '../auth/SessionProvider';
import type { ObjetLocationNode } from './queries';

// TOUT CE QU'ON POSSÈDE, CHARGÉ D'AVANCE PENDANT QU'IL Y A DU RÉSEAU.
//
// LE DÉFAUT D'ORIGINE : persister le cache ne garde que le DÉJÀ-VU. La liste
// de l'accueil était là parce qu'on venait de la regarder ; la fiche d'un
// objet jamais ouvert n'avait jamais été chargée, donc n'existait nulle part.
// Or ranger ses affaires, c'est justement consulter des fiches qu'on n'a pas
// regardées récemment.
//
// ═══ LA RÈGLE À NE JAMAIS ENFREINDRE ICI ═══
//
// AUCUNE REQUÊTE SANS FILTRE sur `pieces`, `emplacements`, `conteneurs`,
// `objets` ou `plans`. Leurs politiques RLS sont de la forme :
//
//   has_habitation_access(location_habitation(parent_emplacement_id,
//                                             parent_conteneur_id), auth.uid(), …)
//
// — deux fonctions PL/pgSQL imbriquées, dont une RÉCURSIVE, évaluées LIGNE PAR
// LIGNE. Le prédicat n'est pas indexable : sans filtre, Postgres les exécute
// sur toutes les lignes de la table, tous comptes confondus. La requête dépasse
// le délai du serveur, le fil JavaScript reste bloqué, et Android finit par
// tuer l'application.
//
// C'est très exactement la faute qu'a commise la première version de ce
// fichier, et ce qui a rendu l'app inutilisable — y compris AVEC du réseau.
//
// Le reste de l'app respecte cette règle sans le dire : chaque requête filtre
// d'abord sur une colonne indexée, ce qui réduit l'ensemble à quelques lignes
// AVANT que la politique ne s'exécute. Et `search_index()`, qui rapatrie tout,
// est une fonction `SECURITY DEFINER` : elle contourne la RLS par construction.
//
// On DESCEND DONC L'ARBRE, palier par palier, avec les mêmes filtres que les
// écrans : habitations, puis pièces de ces habitations, puis emplacements de
// ces pièces, et ainsi de suite. Une dizaine de requêtes toutes indexées, au
// lieu de cinq balayages complets.

/** Découpage des listes d'identifiants passées en `in(...)`. */
// PostgREST fait passer le filtre dans l'URL : quelques centaines
// d'identifiants suffisent à dépasser la longueur admise, et la requête est
// rejetée sans que rien ne dise pourquoi.
const ID_CHUNK = 100;

/** Profondeur maximale d'imbrication des conteneurs explorée. */
// Garde-fou, pas une limite de produit : une boîte dans une caisse dans une
// malle fait trois niveaux. Vingt laisse toute la marge voulue, et empêche une
// donnée cyclique de faire tourner la boucle sans fin.
const MAX_CONTENEUR_DEPTH = 20;

type TableName = keyof Database['public']['Tables'];

/**
 * `select * where <colonne> in (...)`, en tranches.
 *
 * Rend une liste vide sans faire de requête quand il n'y a rien à demander :
 * `in()` sur une liste vide est au mieux inutile, et évite un aller-retour par
 * palier vide de l'arbre.
 */
async function selectIn<T>(table: TableName, column: string, values: string[], orderBy?: string): Promise<T[]> {
  if (values.length === 0) return [];

  const rows: T[] = [];
  for (let start = 0; start < values.length; start += ID_CHUNK) {
    let query = supabase.from(table).select('*').in(column, values.slice(start, start + ID_CHUNK));
    if (orderBy) query = query.order(orderBy);
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...(data as T[]));
  }
  return rows;
}

const idsOf = (rows: { id: string }[]) => rows.map((row) => row.id);

type Snapshot = {
  habitations: Habitation[];
  pieces: Piece[];
  emplacements: Emplacement[];
  conteneurs: Conteneur[];
  objets: Objet[];
  plans: Plan[];
  formes: PlanForme[];
  pins: PlanPin[];
  doors: PlanDoor[];
};

async function fetchSnapshot(): Promise<Snapshot> {
  // `habitations` est la seule table lue sans filtre, et c'est déjà ce que
  // fait l'écran Habitations : sa politique se résout sur les colonnes de la
  // ligne, sans fonction récursive, et la table est petite par nature.
  const habitations = await selectMany<Habitation>('habitations', undefined, 'created_at');
  const habitationIds = idsOf(habitations);

  const pieces = await selectIn<Piece>('pieces', 'habitation_id', habitationIds, 'created_at');
  const emplacements = await selectIn<Emplacement>('emplacements', 'piece_id', idsOf(pieces), 'created_at');

  // Les conteneurs s'imbriquent : on descend par PALIERS, chacun filtré sur
  // les identifiants du palier précédent. Une requête par niveau de
  // profondeur réellement utilisé, et zéro quand il n'y en a pas.
  const conteneurs: Conteneur[] = [];
  let level = await selectIn<Conteneur>('conteneurs', 'parent_emplacement_id', idsOf(emplacements), 'created_at');
  for (let depth = 0; level.length > 0 && depth < MAX_CONTENEUR_DEPTH; depth++) {
    conteneurs.push(...level);
    level = await selectIn<Conteneur>('conteneurs', 'parent_conteneur_id', idsOf(level), 'created_at');
  }

  // Un objet est posé soit dans un emplacement, soit dans un conteneur : les
  // deux familles se demandent séparément et se réunissent ici.
  const [objetsInEmplacements, objetsInConteneurs] = await Promise.all([
    selectIn<Objet>('objets', 'parent_emplacement_id', idsOf(emplacements), 'created_at'),
    selectIn<Objet>('objets', 'parent_conteneur_id', idsOf(conteneurs), 'created_at'),
  ]);

  const plans = await selectIn<Plan>('plans', 'habitation_id', habitationIds, 'floor_order');
  const planIds = idsOf(plans);
  const [formes, pins, doors] = await Promise.all([
    selectIn<PlanForme>('plan_formes', 'plan_id', planIds, 'created_at'),
    selectIn<PlanPin>('plan_pins', 'plan_id', planIds),
    selectIn<PlanDoor>('plan_doors', 'plan_id', planIds),
  ]);

  return {
    habitations,
    pieces,
    emplacements,
    conteneurs,
    objets: [...objetsInEmplacements, ...objetsInConteneurs],
    plans,
    formes,
    pins,
    doors,
  };
}

function groupBy<T>(rows: T[], key: (row: T) => string | null): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    if (k === null) continue;
    const list = map.get(k);
    if (list) list.push(row);
    else map.set(k, [row]);
  }
  return map;
}

/**
 * LA CHAÎNE D'EMPLACEMENT, RECONSTITUÉE ICI.
 *
 * En ligne, c'est une fonction SQL (`objet_location_chain`) qui la calcule —
 * une requête par objet, ce qui interdit de la précharger pour tout
 * l'inventaire. Elle est donc redéduite de la hiérarchie qu'on vient de lire.
 *
 * L'ORDRE REPRODUIT CELUI DU SQL : habitation, pièce, emplacement, puis les
 * conteneurs du plus englobant au plus interne. C'est l'ordre du fil d'Ariane,
 * et s'en écarter donnerait un chemin qui se lit à l'envers.
 *
 * Le garde-fou sur les identifiants déjà vus n'est pas décoratif : un
 * conteneur qui se retrouverait son propre ancêtre — ce que la base interdit,
 * mais qu'une donnée abîmée pourrait présenter — ferait boucler l'application
 * sans fin au lieu d'afficher un chemin incomplet.
 *
 * EXPORTÉE POUR ÊTRE ÉPROUVÉE : c'est la logique la plus délicate de ce
 * fichier, elle réimplémente du SQL de tête, et une erreur d'ordre y donnerait
 * un chemin qui se lit à l'envers sans que rien ne plante.
 */
export function locationChainFor(
  objet: Objet,
  conteneurById: Map<string, Conteneur>,
  emplacementById: Map<string, Emplacement>,
  pieceById: Map<string, Piece>,
  habitationById: Map<string, Habitation>,
): ObjetLocationNode[] {
  const nested: Conteneur[] = [];
  const seen = new Set<string>();
  let emplacementId = objet.parent_emplacement_id;
  let cursor = objet.parent_conteneur_id;

  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    const conteneur = conteneurById.get(cursor);
    if (!conteneur) break;
    nested.push(conteneur);
    if (conteneur.parent_emplacement_id) emplacementId = conteneur.parent_emplacement_id;
    cursor = conteneur.parent_conteneur_id;
  }
  // Remonté depuis l'objet, donc du plus interne au plus englobant.
  nested.reverse();

  const emplacement = emplacementId ? emplacementById.get(emplacementId) : undefined;
  const piece = emplacement ? pieceById.get(emplacement.piece_id) : undefined;
  const habitation = piece ? habitationById.get(piece.habitation_id) : undefined;

  const chain: ObjetLocationNode[] = [];
  if (habitation) {
    chain.push({ kind: 'habitation', id: habitation.id, name: habitation.name, preset_key: null, is_default: false });
  }
  if (piece) {
    chain.push({ kind: 'piece', id: piece.id, name: piece.name, preset_key: piece.preset_key, is_default: piece.is_default });
  }
  if (emplacement) {
    chain.push({
      kind: 'emplacement',
      id: emplacement.id,
      name: emplacement.name,
      preset_key: emplacement.preset_key,
      is_default: false,
    });
  }
  for (const conteneur of nested) {
    chain.push({ kind: 'conteneur', id: conteneur.id, name: conteneur.name, preset_key: null, is_default: false });
  }
  return chain;
}

/**
 * Garnit le cache de toutes les clés que les écrans d'inventaire consultent.
 *
 * Les listes vides comptent autant que les autres : un emplacement sans
 * contenu doit voir sa clé posée à `[]`, sinon son écran chercherait à
 * charger — et attendrait indéfiniment sans réseau. C'est la différence entre
 * « c'est vide » et « je ne sais pas ».
 */
function seedCaches(client: QueryClient, snapshot: Snapshot): void {
  const { habitations, pieces, emplacements, conteneurs, objets, plans, formes, pins, doors } = snapshot;

  const habitationById = new Map(habitations.map((h) => [h.id, h]));
  const pieceById = new Map(pieces.map((p) => [p.id, p]));
  const emplacementById = new Map(emplacements.map((e) => [e.id, e]));
  const conteneurById = new Map(conteneurs.map((c) => [c.id, c]));

  const piecesByHabitation = groupBy(pieces, (p) => p.habitation_id);
  const emplacementsByPiece = groupBy(emplacements, (e) => e.piece_id);
  const conteneursByEmplacement = groupBy(conteneurs, (c) => c.parent_emplacement_id);
  const conteneursByConteneur = groupBy(conteneurs, (c) => c.parent_conteneur_id);
  const objetsByEmplacement = groupBy(objets, (o) => o.parent_emplacement_id);
  const objetsByConteneur = groupBy(objets, (o) => o.parent_conteneur_id);
  const plansByHabitation = groupBy(plans, (p) => p.habitation_id);
  const formesByPlan = groupBy(formes, (f) => f.plan_id);
  const pinsByPlan = groupBy(pins, (p) => p.plan_id);
  const doorsByPlan = groupBy(doors, (d) => d.plan_id);

  client.setQueryData(['habitations'], habitations);

  for (const habitation of habitations) {
    client.setQueryData(['habitation', habitation.id], habitation);
    client.setQueryData(['pieces', habitation.id], piecesByHabitation.get(habitation.id) ?? []);
    client.setQueryData(['plans', habitation.id], plansByHabitation.get(habitation.id) ?? []);
  }

  for (const piece of pieces) {
    client.setQueryData(['piece', piece.id], piece);
    client.setQueryData(['emplacements', piece.id], emplacementsByPiece.get(piece.id) ?? []);
  }

  const seedContents = (parentType: LocationType, id: string, childConteneurs: Conteneur[], childObjets: Objet[]) => {
    client.setQueryData(['containerContents', 'conteneurs', parentType, id], childConteneurs);
    client.setQueryData(['containerContents', 'objets', parentType, id], childObjets);
  };

  for (const emplacement of emplacements) {
    client.setQueryData(['emplacement', emplacement.id], emplacement);
    seedContents(
      'emplacement',
      emplacement.id,
      conteneursByEmplacement.get(emplacement.id) ?? [],
      objetsByEmplacement.get(emplacement.id) ?? [],
    );
  }

  for (const conteneur of conteneurs) {
    client.setQueryData(['conteneur', conteneur.id], conteneur);
    seedContents(
      'conteneur',
      conteneur.id,
      conteneursByConteneur.get(conteneur.id) ?? [],
      objetsByConteneur.get(conteneur.id) ?? [],
    );
  }

  for (const objet of objets) {
    client.setQueryData(['objet', objet.id], objet);
    client.setQueryData(
      ['objetLocationChain', objet.id],
      locationChainFor(objet, conteneurById, emplacementById, pieceById, habitationById),
    );
  }

  for (const plan of plans) {
    client.setQueryData(['plan', plan.id], plan);
    client.setQueryData(['planFormes', plan.id], formesByPlan.get(plan.id) ?? []);
    client.setQueryData(['planPins', plan.id], pinsByPlan.get(plan.id) ?? []);
    client.setQueryData(['planDoors', plan.id], doorsByPlan.get(plan.id) ?? []);
  }
}

/**
 * À monter UNE FOIS, au-dessus des écrans.
 *
 * Ne fait rien hors-ligne : la requête est simplement mise en attente, comme
 * toutes les autres, et repart au retour du réseau.
 */
export function useInventorySnapshot(): void {
  const { session } = useSession();
  const client = useQueryClient();

  const { data } = useQuery({
    queryKey: [INVENTORY_SNAPSHOT_KEY, session?.user.id],
    enabled: !!session,
    // JAMAIS PÉRIMÉ DE LUI-MÊME. C'est une dizaine de requêtes : les relancer
    // à chaque remontage d'écran serait ruineux. Les écritures rafraîchissent
    // déjà ce qu'il faut, écran par écran, par la règle globale de
    // queryClient — qui exclut expressément cette clé-ci.
    staleTime: Infinity,
    // Pas de seconde tentative : si la lecture échoue, la reprendre
    // aussitôt doublerait la charge sans rien changer. Le prochain
    // démarrage réessaiera.
    retry: false,
    queryFn: fetchSnapshot,
  });

  useEffect(() => {
    if (!data) return;

    // ON NE GARNIT PAS PAR-DESSUS DES ÉCRITURES EN ATTENTE. Ce cliché a été
    // demandé au serveur, qui ignore encore les modifications faites
    // hors-ligne : l'appliquer ferait disparaître de l'écran ce que la
    // personne vient de saisir, sans rien annuler côté file.
    const pending = client.getMutationCache().findAll({ predicate: (m) => m.state.isPaused });
    if (pending.length > 0) return;

    seedCaches(client, data);
  }, [data, client]);
}
