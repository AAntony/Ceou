import { normalize } from '../../lib/text/match';

// ANALYSE LOCALE DE LA PHRASE, avant tout appel réseau.
//
// Le modèle n'a jamais fait qu'une chose : découper une phrase en termes de
// recherche. Or la tournure de très loin la plus fréquente — « j'ai rangé X
// dans Y » — se découpe très bien ici, en quelques dizaines de lignes, et
// sans les deux secondes d'aller-retour qu'un appel coûte. Le modèle reste
// pour tout le reste : les formulations biscornues, les questions, ce qui
// n'entre dans aucun moule.
//
// C'est aussi ce qui rend une session utilisable : on range dix objets à la
// suite, et attendre le réseau à chaque phrase ferait abandonner avant le
// troisième.
//
// La normalisation utilisée ici est `normalize` et NON `normalizeForMatch` :
// cette dernière ramène chaque mot au singulier, ce qui transforme « dans »
// en « dan » et détruirait précisément les mots-charnières sur lesquels tout
// ce fichier s'appuie.

/** Ce qui clôt une session, quand la phrase n'est QUE ça. */
const CLOSING_PHRASES = new Set([
  'merci',
  'merci ceou',
  'merci beaucoup',
  'merci bien',
  'merci a toi',
  'c est bon',
  'c est tout',
  'termine',
  'fini',
  'j ai fini',
  'ca suffit',
  'stop',
  'au revoir',
  'a plus tard',
  'thanks',
  'thank you',
  'that s all',
  'i m done',
  'done',
  'bye',
]);

/**
 * Formules qui closent la session même posées à la FIN d'un ordre.
 *
 * « Range mes clés dans le tiroir, merci » est une phrase parfaitement
 * normale : elle demande un rangement ET prend congé. Exiger que « merci »
 * soit dit seul, dans une phrase à part, revient à exiger une façon de parler
 * que personne n'a.
 */
const CLOSING_TAILS = ['merci beaucoup', 'merci ceou', 'merci', 'c est tout', 'voila', 'thanks', 'thank you'];

export type ClosingSplit = {
  closing: boolean;
  /** Ce qui reste à exécuter avant de raccrocher — vide si la phrase ne disait que « merci ». */
  rest: string;
};

export function splitClosing(transcript: string): ClosingSplit {
  const text = normalize(transcript);
  if (!text) return { closing: false, rest: '' };
  if (CLOSING_PHRASES.has(text)) return { closing: true, rest: '' };

  for (const tail of CLOSING_TAILS) {
    if (text.endsWith(` ${tail}`)) {
      const rest = text.slice(0, text.length - tail.length - 1).trim();
      // Un reste d'un seul mot après la formule (« voilà merci ») n'est pas
      // un ordre : c'est encore de la politesse.
      if (rest.split(' ').length <= 1) return { closing: true, rest: '' };
      return { closing: true, rest };
    }
  }

  return { closing: false, rest: text };
}

// === Analyse locale d'un rangement =======================================

/**
 * Verbes qui annoncent un rangement — impératif, participe et infinitif.
 *
 * Écrits SANS accent : ils sont comparés à une phrase déjà normalisée, où
 * « rangé » est devenu « range ». Une entrée accentuée ici ne serait jamais
 * trouvée.
 */
const MOVE_VERBS = new Set([
  'range',
  'ranges',
  'rangee',
  'rangees',
  'rangez',
  'ranger',
  'met',
  'mets',
  'mettez',
  'mettre',
  'mis',
  'mise',
  'pose',
  'posee',
  'posez',
  'poser',
  'place',
  'placee',
  'placez',
  'placer',
  'depose',
  'deposee',
  'deposez',
  'deposer',
  'remets',
  'remis',
  'remise',
  'ranges',
  'stocke',
  'stocke',
]);

/** Verbes d'ÉTAT : « les ciseaux sont dans la boîte » décrit aussi un rangement. */
const STATE_VERBS = new Set(['est', 'sont']);

/**
 * Mots-charnières qui séparent l'objet de sa destination.
 *
 * « à » seul est volontairement exclu : il apparaît au milieu de noms très
 * courants (« boîte à outils », « sac à dos »), et couper là donnerait une
 * destination absurde. Seules ses formes suivies d'un article — « à la »,
 * « à l' » — sont sans ambiguïté.
 */
const SINGLE_PREPOSITIONS = new Set(['dans', 'sur', 'sous', 'au', 'aux', 'dedans']);
const DOUBLE_PREPOSITIONS = [
  ['a', 'la'],
  ['a', 'l'],
];

/**
 * Ouvertures qui disqualifient un rangement.
 *
 * « Où sont mes clés » contient un verbe d'état et une préposition : sans ce
 * garde-fou, une QUESTION serait exécutée comme un ordre, et l'objet
 * déplacé alors qu'on demandait seulement où il se trouve. C'est la seule
 * erreur vraiment coûteuse que ce fichier puisse commettre.
 */
const QUESTION_OPENERS = new Set([
  'ou',
  'est',
  'quel',
  'quelle',
  'quels',
  'quelles',
  'qui',
  'quoi',
  'comment',
  'combien',
  'pourquoi',
  'dis',
  'dit',
  'montre',
  'trouve',
  'cherche',
  'indique',
  'liste',
  'affiche',
  'retrouve',
  'peux',
  'sais',
]);

/** Articles et possessifs à retirer en tête d'un terme. */
const LEADING_FILLER = new Set([
  'le',
  'la',
  'les',
  'l',
  'un',
  'une',
  'des',
  'du',
  'de',
  'd',
  'mon',
  'ma',
  'mes',
  'ton',
  'ta',
  'tes',
  'son',
  'sa',
  'ses',
  'notre',
  'nos',
  'votre',
  'vos',
  'leur',
  'leurs',
  'ce',
  'cet',
  'cette',
  'ces',
  'moi',
  'nous',
  'maintenant',
]);

const SCOPE_ALL = new Set(['tous', 'toutes', 'tout', 'toute']);

function trimFiller(words: string[]): string[] {
  let start = 0;
  while (start < words.length && LEADING_FILLER.has(words[start])) start++;
  return words.slice(start);
}

export type LocalMove = {
  object_query: string;
  destination_query: string;
  scope: 'one' | 'all';
};

/**
 * Découpe « j'ai rangé X dans Y » sans passer par le modèle.
 *
 * Renvoie `null` dès le moindre doute : c'est alors l'IA qui prend le relais.
 * Ce fichier n'a pas à couvrir toutes les phrases possibles, seulement à
 * reconnaître sans se tromper celles qui reviennent tout le temps.
 */
export function parseMove(transcript: string): LocalMove | null {
  const words = normalize(transcript).split(' ').filter(Boolean);
  if (words.length < 4) return null;
  if (QUESTION_OPENERS.has(words[0])) return null;

  // Le verbe, cherché dans les premiers mots seulement : passé ce point, un
  // participe appartient au nom de l'objet plutôt qu'à l'action.
  let verbIndex = -1;
  let stateVerb = false;
  for (let i = 0; i < Math.min(words.length, 6); i++) {
    if (MOVE_VERBS.has(words[i])) {
      verbIndex = i;
      break;
    }
    if (STATE_VERBS.has(words[i])) {
      verbIndex = i;
      stateVerb = true;
      break;
    }
  }
  if (verbIndex < 0) return null;

  // Un verbe d'état ne dit un rangement que si un objet le précède : « sont
  // dans la boîte » tout court ne désigne rien.
  if (stateVerb && verbIndex === 0) return null;

  // La PREMIÈRE charnière après le verbe. Prendre la dernière découperait
  // « dans le tiroir de la commode du salon » au mauvais endroit.
  let prepIndex = -1;
  let prepLength = 1;
  for (let i = verbIndex + 1; i < words.length - 1; i++) {
    if (SINGLE_PREPOSITIONS.has(words[i])) {
      prepIndex = i;
      break;
    }
    const double = DOUBLE_PREPOSITIONS.find((pair) => pair[0] === words[i] && pair[1] === words[i + 1]);
    if (double) {
      prepIndex = i;
      prepLength = 2;
      break;
    }
  }
  if (prepIndex < 0) return null;

  // Un verbe d'état prend ce qui est AVANT lui comme objet ; un verbe
  // d'action, ce qui le suit.
  const rawObject = stateVerb ? words.slice(0, verbIndex) : words.slice(verbIndex + 1, prepIndex);

  // Le marqueur de lot se retire AVANT le nettoyage des articles : « toutes
  // les assiettes » cache un « les » que seul ce retrait rend visible.
  const scope: 'one' | 'all' = rawObject.some((word) => SCOPE_ALL.has(word)) ? 'all' : 'one';
  const objectWords = trimFiller(rawObject.filter((word) => !SCOPE_ALL.has(word)));
  const destinationWords = trimFiller(words.slice(prepIndex + prepLength));
  if (objectWords.length === 0 || destinationWords.length === 0) return null;

  return { object_query: objectWords.join(' '), destination_query: destinationWords.join(' '), scope };
}
