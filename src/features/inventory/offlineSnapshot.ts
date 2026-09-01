import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { selectMany } from '../../lib/supabase/crud';
import type { Conteneur, Emplacement, Habitation, LocationType, Objet, Piece } from '../../types/database';
import { useSession } from '../auth/SessionProvider';
import type { ObjetLocationNode } from './queries';

// TOUT L'INVENTAIRE D'AVANCE, PENDANT QU'IL Y A DU RÉSEAU.
//
// LE DÉFAUT QUE CE FICHIER CORRIGE, signalé à l'usage : « j'ai bien la liste
// des objets en hors connexion, mais je ne peux pas consulter la page d'un
// objet ». C'était la limite exacte de la persistance du cache — elle ne garde
// que ce qui a DÉJÀ été affiché. La liste de l'accueil était là parce qu'on
// venait de la regarder ; la fiche d'un objet jamais ouvert n'avait jamais été
// chargée, donc n'existait nulle part. Sans réseau, elle ne pouvait
// qu'attendre indéfiniment.
//
// Or ranger ses affaires, c'est justement consulter des fiches qu'on n'a pas
// regardées récemment. Un cache qui ne retient que le déjà-vu ne répond pas à
// la question posée.
//
// CINQ REQUÊTES, PAS DEUX CENTS. La voie naïve serait de précharger chaque
// écran : une requête par habitation, par pièce, par emplacement, par
// conteneur, par objet — des centaines d'allers-retours pour un inventaire
// ordinaire. On lit donc les cinq TABLES entières (la RLS restreint déjà
// chacune à ce que la personne a le droit de voir), et on en déduit localement
// le contenu de chaque écran.
//
// CE QUE ÇA COÛTE : l'inventaire entier passe sur le réseau à chaque
// démarrage. C'est le même ordre de grandeur que l'index de recherche que
// l'accueil charge déjà. Un inventaire qui deviendrait vraiment gros
// demanderait de ne rapatrier que ce qui a changé depuis la dernière fois —
// pas nécessaire aujourd'hui, et prématuré tant que personne n'en a l'usage.

type Snapshot = {
  habitations: Habitation[];
  pieces: Piece[];
  emplacements: Emplacement[];
  conteneurs: Conteneur[];
  objets: Objet[];
};

async function fetchSnapshot(): Promise<Snapshot> {
  // En parallèle : les cinq tables sont indépendantes, les enchaîner
  // multiplierait par cinq l'attente au démarrage.
  const [habitations, pieces, emplacements, conteneurs, objets] = await Promise.all([
    selectMany<Habitation>('habitations', undefined, 'created_at'),
    selectMany<Piece>('pieces', undefined, 'created_at'),
    selectMany<Emplacement>('emplacements', undefined, 'created_at'),
    selectMany<Conteneur>('conteneurs', undefined, 'created_at'),
    selectMany<Objet>('objets', undefined, 'created_at'),
  ]);
  return { habitations, pieces, emplacements, conteneurs, objets };
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
 * EXPORTÉE POUR ÊTRE ÉPROUVÉE, comme shouldClearForUserChange : c'est la
 * logique la plus délicate de ce fichier, elle réimplémente du SQL de tête, et
 * une erreur d'ordre y donnerait un chemin qui se lit à l'envers sans que rien
 * ne plante. Enfouie dans une boucle de garnissage, elle ne se testerait pas.
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
 * Garnit le cache de TOUTES les clés que les écrans d'inventaire consultent.
 *
 * Les listes vides comptent autant que les autres : un emplacement sans
 * contenu doit voir sa clé posée à `[]`, sinon son écran chercherait à
 * charger — et attendrait indéfiniment sans réseau. C'est la différence entre
 * « c'est vide » et « je ne sais pas ».
 */
function seedCaches(client: QueryClient, snapshot: Snapshot): void {
  const { habitations, pieces, emplacements, conteneurs, objets } = snapshot;

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

  client.setQueryData(['habitations'], habitations);

  for (const habitation of habitations) {
    client.setQueryData(['habitation', habitation.id], habitation);
    client.setQueryData(['pieces', habitation.id], piecesByHabitation.get(habitation.id) ?? []);
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
    queryKey: ['inventorySnapshot', session?.user.id],
    enabled: !!session,
    // Cinq requêtes qui rapatrient tout : inutile de les relancer à chaque
    // remontage d'écran. Les écritures, elles, rafraîchissent déjà ce qu'il
    // faut par la règle globale de queryClient.
    staleTime: 5 * 60 * 1000,
    queryFn: fetchSnapshot,
  });

  useEffect(() => {
    if (!data) return;

    // ON NE GARNIT PAS PAR-DESSUS DES ÉCRITURES EN ATTENTE. Ce cliché a été
    // demandé au serveur, qui ignore encore les modifications faites
    // hors-ligne : l'appliquer ferait disparaître de l'écran ce que la
    // personne vient de saisir, sans rien annuler côté file. On repassera au
    // prochain rafraîchissement, une fois la file vidée.
    const pending = client.getMutationCache().findAll({ predicate: (m) => m.state.isPaused });
    if (pending.length > 0) return;

    seedCaches(client, data);
  }, [data, client]);
}
