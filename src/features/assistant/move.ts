import { meaningfulWords, normalizeForMatch } from '../../lib/text/match';
import type { LocationType } from '../../types/database';
import type { SearchIndexEntry } from '../search/queries';
import { MIN_SCORE, scoreMatch, type AssistantIntent } from './resolve';

// Résolution d'un DÉPLACEMENT, la seule intention de l'assistant qui débouche
// sur une ÉCRITURE.
//
// Tout le reste de l'assistant peut se tromper sans conséquence : une réponse
// à côté se corrige en reposant la question. Ici non — un objet rangé au
// mauvais endroit corrompt l'inventaire en silence, et personne ne s'en
// aperçoit avant de chercher l'objet. D'où trois partis pris :
//
//   1. Le modèle ne résout rien. Il a rendu deux TERMES ; c'est ce fichier qui
//      les confronte à l'index déjà chargé, donc déjà filtré par la RLS.
//   2. On ne devine jamais. Zéro correspondance -> on le dit ; plusieurs ->
//      on demande. Jamais de repli sur « le moins mauvais candidat ».
//   3. Rien n'est créé. Une destination inconnue reste inconnue : fabriquer un
//      Emplacement à partir d'un mot mal entendu pollue l'inventaire pour de
//      bon, et la dictée se trompe de mot régulièrement.

export type MoveDestination = {
  /** Un objet vit dans un Emplacement (meuble) ou un Conteneur (boîte). */
  type: LocationType;
  id: string;
  name: string;
  pieceName: string;
  habitationId: string;
  /** Type de meuble, pour l'icône — nul pour un Conteneur. */
  presetKey: string | null;
  /** Pour l'écran : « Entrée · Meuble d'entrée ». */
  label: string;
  /** Pour la voix : le point médian se prononce mal, la virgule donne la pause. */
  sentence: string;
};

export type MoveResolution =
  /**
   * Les deux côtés sont résolus. Plusieurs entrées d'un côté = on demande.
   * `confident` dit qu'il n'y a rien à demander DU TOUT : un seul candidat de
   * chaque côté, et les deux reconnus franchement — c'est ce qui autorise à
   * ranger sans confirmation préalable.
   */
  | { status: 'ready'; objets: SearchIndexEntry[]; destinations: MoveDestination[]; confident: boolean }
  | { status: 'no_object'; query: string }
  | { status: 'no_destination'; query: string }
  /** La destination nommée est une Pièce, mais elle n'a aucun meuble où ranger. */
  | { status: 'room_without_emplacement'; roomName: string }
  /** « range toutes les assiettes » : le déplacement en lot n'existe pas encore. */
  | { status: 'scope_unsupported'; query: string };

// Écart de score en dessous duquel deux candidats sont considérés comme
// également plausibles, donc soumis à l'utilisateur. Au-delà, le meilleur
// gagne seul. C'est la seule liberté que ce fichier s'autorise, et elle est
// bornée : elle ne choisit qu'entre des candidats RÉELS.
const TOLERANCE = 15;

// Une liste de choix qu'on lit d'un coup d'œil. Au-delà, la dictée était trop
// vague pour qu'un choix ait du sens — mieux vaut reformuler.
const MAX_CHOICES = 6;

// Prime au candidat dont le CHEMIN COMPLET (pièce, meuble, boîte) rend compte
// de TOUS les mots prononcés. C'est ce qui départage « tiroir de l'entrée »
// entre le Tiroir de l'Entrée — qui explique les deux mots — et le Meuble
// d'entrée, qui n'en explique qu'un. Le bonus dépasse TOLERANCE, donc il
// tranche vraiment au lieu d'ajouter du bruit ; et il est tout ou rien, pour
// qu'on puisse toujours dire pourquoi un candidat a gagné.
const FULL_MATCH_BONUS = 40;

// Seuil de la reconnaissance FRANCHE, celle qui autorise à écrire sans
// demander. Il est calé sur les paliers de scoreMatch : 100 quand le nom
// prononcé est le nom enregistré, 70 quand il y est contenu, en dessous la
// correspondance a été reconstituée mot à mot.
//
// Côté destination, on compare le score TOTAL, et ce n'est pas un raccourci :
// 30 + FULL_MATCH_BONUS fait exactement 70. Autrement dit, est franche soit
// une destination dont le nom seul suffit, soit une destination dont le
// chemin complet rend compte de tous les mots dits — « tiroir de l'entrée »
// est de celles-là. Une correspondance partielle sans ce bonus reste sous le
// seuil et passera par une confirmation.
const STRONG_SCORE = 70;

type Scored<T> = { item: T; score: number };

function topCandidates<T>(items: T[], score: (item: T) => number): Scored<T>[] {
  const scored = items
    .map((item) => ({ item, score: score(item) }))
    .filter((candidate) => candidate.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return [];
  const best = scored[0].score;
  return scored.filter((candidate) => candidate.score >= best - TOLERANCE).slice(0, MAX_CHOICES);
}

function scoreDestination(query: string, entry: SearchIndexEntry): number {
  // Le NOM reste la condition d'entrée : la pièce seule ne fait pas d'un
  // meuble une destination plausible, sinon citer « la cuisine » élirait
  // n'importe lequel de ses meubles.
  const base = scoreMatch(query, entry.name);
  if (base < MIN_SCORE) return 0;

  const words = meaningfulWords(query);
  if (words.length === 0) return base;

  const path = normalizeForMatch([entry.piece_name, entry.parent_label, entry.name].filter(Boolean).join(' '));
  const explained = words.every((word) => path.includes(word));
  return base + (explained ? FULL_MATCH_BONUS : 0);
}

function toDestination(entry: SearchIndexEntry): MoveDestination {
  const parts = [entry.piece_name, entry.parent_label, entry.name].filter(Boolean) as string[];
  return {
    type: entry.kind === 'conteneur' ? 'conteneur' : 'emplacement',
    id: entry.id,
    name: entry.name,
    pieceName: entry.piece_name,
    habitationId: entry.habitation_id,
    presetKey: entry.preset_key,
    label: parts.join(' · '),
    sentence: parts.join(', '),
  };
}

/**
 * Restreint des candidats à l'Habitation de l'objet quand c'est possible.
 *
 * Deux logements ont chacun leur « salle de bain » et leur « placard ». Sans
 * ça, la moindre destination courante forcerait une question à chaque fois,
 * alors que l'objet à ranger désigne déjà le logement concerné. Le filtre ne
 * s'applique que s'il laisse quelque chose : déplacer un objet d'un logement
 * à l'autre reste possible (« j'ai emmené la perceuse au garage »).
 */
function preferHabitation<T>(
  candidates: Scored<T>[],
  homeOf: (item: T) => string,
  habitationId: string | null,
): Scored<T>[] {
  if (!habitationId || candidates.length <= 1) return candidates;
  const sameHome = candidates.filter((candidate) => homeOf(candidate.item) === habitationId);
  return sameHome.length > 0 ? sameHome : candidates;
}

/** L'Habitation commune à tous les candidats, ou `null` s'ils sont dispersés. */
function commonHabitation(objets: SearchIndexEntry[]): string | null {
  const homes = new Set(objets.map((objet) => objet.habitation_id));
  return homes.size === 1 ? [...homes][0] : null;
}

/**
 * Peut-on ranger sans rien demander ?
 *
 * Trois conditions, et il les faut toutes : un seul objet possible, un seul
 * endroit possible, et les deux reconnus FRANCHEMENT. La dernière est celle
 * qu'on oublie — un candidat unique n'est pas un candidat sûr. « Range le truc
 * dans le machin » peut ne laisser qu'un candidat de chaque côté tout en
 * n'ayant presque rien reconnu ; là, on montre avant d'écrire.
 */
function isConfident(objets: Scored<unknown>[], destinations: Scored<unknown>[]): boolean {
  if (objets.length !== 1 || destinations.length !== 1) return false;
  return objets[0].score >= STRONG_SCORE && destinations[0].score >= STRONG_SCORE;
}

export function resolveMove(intent: AssistantIntent, index: SearchIndexEntry[]): MoveResolution {
  const ranked = topCandidates(
    index.filter((entry) => entry.kind === 'objet'),
    (entry) => scoreMatch(intent.object_query, entry.name),
  );

  if (ranked.length === 0) return { status: 'no_object', query: intent.object_query };

  const objets = ranked.map((candidate) => candidate.item);

  // « Range toutes les assiettes » quand il n'y en a qu'une revient à ranger
  // cette assiette : on ne refuse que si le lot est réel.
  if (intent.scope === 'all' && objets.length > 1) {
    return { status: 'scope_unsupported', query: intent.object_query };
  }

  const home = commonHabitation(objets);
  const query = intent.destination_query;

  // Un objet se range dans un meuble ou une boîte, jamais dans une pièce nue :
  // c'est la contrainte de move_objet, et elle est juste — « dans la cuisine »
  // ne dit pas où l'on retrouvera l'objet.
  const direct = preferHabitation(
    topCandidates(
      index.filter((entry) => entry.kind === 'emplacement' || entry.kind === 'conteneur'),
      (entry) => scoreDestination(query, entry),
    ),
    (entry) => entry.habitation_id,
    home,
  );

  if (direct.length > 0) {
    return {
      status: 'ready',
      objets,
      destinations: direct.map((candidate) => toDestination(candidate.item)),
      confident: isConfident(ranked, direct),
    };
  }

  // Rien de ce nom : la phrase désignait peut-être la PIÈCE (« range-le dans
  // mon bureau »). On descend alors d'un cran, jusqu'à ses meubles.
  const rooms = preferHabitation(
    topCandidates(
      index.filter((entry) => entry.kind === 'piece'),
      (entry) => scoreMatch(query, entry.name),
    ),
    (entry) => entry.habitation_id,
    home,
  );

  if (rooms.length > 0) {
    const room = rooms[0].item;
    const inRoom = index.filter((entry) => entry.kind === 'emplacement' && entry.piece_id === room.piece_id);
    if (inRoom.length === 0) return { status: 'room_without_emplacement', roomName: room.name };
    return {
      status: 'ready',
      objets,
      destinations: inRoom.slice(0, MAX_CHOICES).map(toDestination),
      // Jamais sans confirmation ici, même si la pièce n'a qu'un meuble :
      // l'utilisateur a nommé un endroit qui n'est PAS celui où l'on écrit. On
      // le lui montre une fois plutôt que de choisir dans son dos.
      confident: false,
    };
  }

  return { status: 'no_destination', query };
}

/**
 * L'objet est-il déjà à cet endroit ?
 *
 * Comparaison sur les NOMS et non les identifiants : l'index de recherche ne
 * porte pas l'identifiant du parent d'un objet, seulement son libellé. Une
 * égalité manquée ne coûte qu'un déplacement redondant — une ligne
 * d'historique de trop, rien de faux.
 */
export function isAlreadyThere(objet: SearchIndexEntry, destination: MoveDestination): boolean {
  const parent = normalizeForMatch(objet.parent_label ?? '');
  if (!parent) return false;
  return (
    parent === normalizeForMatch(destination.name) &&
    normalizeForMatch(objet.piece_name) === normalizeForMatch(destination.pieceName)
  );
}
