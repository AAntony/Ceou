import type { SearchIndexEntry } from '../search/queries';

// Résolution d'une intention en résultats RÉELS.
//
// C'est ici que se joue la fiabilité de l'assistant : le modèle n'a fourni que
// des termes ("clés", "bureau"), jamais d'identifiant. Cette couche les
// confronte à l'index déjà chargé — donc déjà filtré par la RLS. Un objet qui
// n'existe pas ne peut pas apparaître, et un objet auquel l'utilisateur n'a
// pas accès non plus.

export type AssistantIntent = {
  action: 'locate' | 'list_room' | 'search' | 'unknown';
  object_query: string;
  room_query: string;
};

export type AssistantResult = {
  intent: AssistantIntent;
  /** Entrées à présenter, les plus pertinentes d'abord. */
  entries: SearchIndexEntry[];
  /** Pièce reconnue pour une demande "list_room" — sert au texte de réponse. */
  roomName: string | null;
};

/**
 * Normalise pour comparer : minuscules, sans accents, sans ponctuation.
 *
 * Indispensable ici — la dictée écrit « clés » et l'inventaire peut contenir
 * « Cles de voiture ». Sans dépliage des accents, la moitié des recherches
 * françaises échoueraient sur une apostrophe ou un accent aigu.
 */
export function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Mots trop courants pour discriminer : les garder ferait correspondre
// n'importe quoi dès qu'une requête contient « de » ou « la ».
const STOP_WORDS = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'un', 'une', 'mon', 'ma', 'mes', 'a', 'au', 'aux', 'of', 'the', 'my']);

function meaningfulWords(query: string): string[] {
  return normalize(query)
    .split(' ')
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));
}

/**
 * Score de correspondance entre une requête et un texte. 0 = aucun rapport.
 *
 * Volontairement simple et lisible plutôt qu'une distance d'édition : on veut
 * pouvoir expliquer pourquoi tel objet est sorti, et le comportement doit
 * rester le même d'une exécution à l'autre.
 */
function scoreMatch(query: string, text: string): number {
  const haystack = normalize(text);
  if (!haystack) return 0;

  const needle = normalize(query);
  if (!needle) return 0;

  if (haystack === needle) return 100;
  if (haystack.includes(needle)) return 70;

  const words = meaningfulWords(query);
  if (words.length === 0) return 0;

  const hits = words.filter((word) => haystack.includes(word)).length;
  if (hits === 0) return 0;

  // Proportion de mots retrouvés : « clés de voiture » doit mieux coller à
  // « Clés de voiture » qu'à « Voiture télécommandée ».
  return Math.round((hits / words.length) * 60);
}

const MIN_SCORE = 30;
const MAX_RESULTS = 12;

export function resolveIntent(intent: AssistantIntent, index: SearchIndexEntry[]): AssistantResult {
  const objets = index.filter((entry) => entry.kind === 'objet');

  if (intent.action === 'list_room') {
    // On identifie d'abord LA pièce, puis on prend tout ce qu'elle contient.
    // Filtrer directement les objets sur le nom de pièce donnerait les mêmes
    // résultats, mais on ne saurait pas quoi annoncer si aucune pièce ne
    // correspond — « aucun objet » et « cette pièce n'existe pas » appellent
    // deux réponses différentes.
    const rooms = index.filter((entry) => entry.kind === 'piece');
    const best = rooms
      .map((room) => ({ room, score: scoreMatch(intent.room_query, room.name) }))
      .filter((candidate) => candidate.score >= MIN_SCORE)
      .sort((a, b) => b.score - a.score)[0];

    if (!best) return { intent, entries: [], roomName: null };

    return {
      intent,
      entries: objets.filter((objet) => objet.piece_id === best.room.id).slice(0, MAX_RESULTS),
      roomName: best.room.name,
    };
  }

  const query = intent.object_query || intent.room_query;
  if (!query) return { intent, entries: [], roomName: null };

  const scored = objets
    .map((objet) => ({ objet, score: scoreMatch(query, objet.name) }))
    .filter((candidate) => candidate.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score);

  return { intent, entries: scored.slice(0, MAX_RESULTS).map((candidate) => candidate.objet), roomName: null };
}

/** Où se trouve une entrée, en une ligne : « Entrée · Meuble d'entrée ». */
export function locationLabel(entry: SearchIndexEntry): string {
  return [entry.piece_name, entry.parent_label].filter(Boolean).join(' · ');
}
