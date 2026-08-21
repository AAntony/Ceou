import { meaningfulWords, normalizeForMatch } from '../../lib/text/match';
import type { SearchIndexEntry } from '../search/queries';

// Résolution d'une intention en résultats RÉELS.
//
// C'est ici que se joue la fiabilité de l'assistant : le modèle n'a fourni que
// des termes ("clés", "bureau"), jamais d'identifiant. Cette couche les
// confronte à l'index déjà chargé — donc déjà filtré par la RLS. Un objet qui
// n'existe pas ne peut pas apparaître, et un objet auquel l'utilisateur n'a
// pas accès non plus.
//
// La comparaison elle-même (accents, singulier/pluriel) vit dans
// `lib/text/match`, partagée avec la recherche texte de l'accueil : les deux
// chemins doivent trouver exactement les mêmes objets pour les mêmes mots,
// sinon l'assistant paraîtrait moins compétent que la barre de recherche.

export { normalize } from '../../lib/text/match';

export type AssistantIntent = {
  action: 'locate' | 'list_room' | 'search' | 'unknown';
  object_query: string;
  room_query: string;
};

export type AssistantResult = {
  intent: AssistantIntent;
  /** Entrées à présenter, les plus pertinentes d'abord. */
  entries: SearchIndexEntry[];
  /** Pièce reconnue — sert au texte de réponse. */
  roomName: string | null;
};

/**
 * Score de correspondance entre une requête et un texte. 0 = aucun rapport.
 *
 * Volontairement simple et lisible plutôt qu'une distance d'édition : on veut
 * pouvoir expliquer pourquoi tel objet est sorti, et le comportement doit
 * rester le même d'une exécution à l'autre.
 */
function scoreMatch(query: string, text: string): number {
  const haystack = normalizeForMatch(text);
  if (!haystack) return 0;

  const needle = normalizeForMatch(query);
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

function bestMatch(candidates: SearchIndexEntry[], query: string): SearchIndexEntry | null {
  if (!query) return null;
  return (
    candidates
      .map((entry) => ({ entry, score: scoreMatch(query, entry.name) }))
      .filter((candidate) => candidate.score >= MIN_SCORE)
      .sort((a, b) => b.score - a.score)[0]?.entry ?? null
  );
}

export function resolveIntent(intent: AssistantIntent, index: SearchIndexEntry[]): AssistantResult {
  const objets = index.filter((entry) => entry.kind === 'objet');
  const pieces = index.filter((entry) => entry.kind === 'piece');

  if (intent.action === 'list_room') {
    // On identifie d'abord LA pièce, puis on prend tout ce qu'elle contient.
    // Filtrer directement les objets sur le nom de pièce donnerait les mêmes
    // résultats, mais on ne saurait pas quoi annoncer si aucune pièce ne
    // correspond — « aucun objet » et « cette pièce n'existe pas » appellent
    // deux réponses différentes.
    const room = bestMatch(pieces, intent.room_query);
    if (!room) return { intent, entries: [], roomName: null };

    return {
      intent,
      entries: objets.filter((objet) => objet.piece_id === room.id).slice(0, MAX_RESULTS),
      roomName: room.name,
    };
  }

  const query = intent.object_query || intent.room_query;
  if (!query) return { intent, entries: [], roomName: null };

  const matches = objets
    .map((objet) => ({ objet, score: scoreMatch(query, objet.name) }))
    .filter((candidate) => candidate.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .map((candidate) => candidate.objet);

  if (matches.length > 0) {
    // La phrase nommait aussi une pièce (« où sont les verres dans la
    // cuisine ? ») : on y restreint la réponse. Sauf si cette pièce n'en
    // contient aucun — répondre « ils sont au salon » reste plus utile que
    // « rien trouvé », et la liste montre de toute façon où ils sont.
    const room = bestMatch(pieces, intent.room_query);
    if (room) {
      const inRoom = matches.filter((objet) => objet.piece_id === room.id);
      if (inRoom.length > 0) {
        return { intent, entries: inRoom.slice(0, MAX_RESULTS), roomName: room.name };
      }
    }

    return { intent, entries: matches.slice(0, MAX_RESULTS), roomName: null };
  }

  // Aucun objet de ce nom : la demande visait peut-être une pièce entière
  // (« montre-moi la cuisine »), mal classée en "locate". Sans ce repli, une
  // pièce pleine renverrait « rien trouvé ».
  const room = bestMatch(pieces, query);
  if (room) {
    return {
      intent: { ...intent, action: 'list_room', room_query: query },
      entries: objets.filter((objet) => objet.piece_id === room.id).slice(0, MAX_RESULTS),
      roomName: room.name,
    };
  }

  return { intent, entries: [], roomName: null };
}

/** Où se trouve une entrée, en une ligne : « Entrée · Meuble d'entrée ». */
export function locationLabel(entry: SearchIndexEntry): string {
  return [entry.piece_name, entry.parent_label].filter(Boolean).join(' · ');
}

/**
 * Même information que `locationLabel`, mais destinée à être LUE.
 *
 * Le point médian sépare bien deux niveaux à l'écran ; une synthèse vocale,
 * elle, le prononce mal ou l'avale sans marquer la pause — la réponse sonne
 * alors hachée là où une virgule donne un débit naturel.
 */
export function locationSentence(entry: SearchIndexEntry): string {
  return [entry.piece_name, entry.parent_label].filter(Boolean).join(', ');
}
