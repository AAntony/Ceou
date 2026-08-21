// Comparaison de texte tolérante, partagée par la recherche de l'accueil et
// par l'assistant vocal.
//
// Les deux se heurtent au même mur : l'utilisateur ne dit jamais exactement
// ce qui est écrit dans l'inventaire. Il demande « tous les verres » alors
// que l'objet s'appelle « Verre », il tape « cles » sans accent alors que la
// fiche dit « Clés ». Sans cette couche, l'app répond « rien trouvé » sur des
// objets qui existent — le défaut le plus décourageant possible pour un
// produit dont le seul but est de retrouver ses affaires.

// Plage des diacritiques combinants isolés par la décomposition NFD.
// ⚠️ Écrite en séquences d'échappement et JAMAIS avec les caractères bruts :
// ces signes sont invisibles dans un éditeur, et une manipulation de fichier
// les a déjà silencieusement effacés une fois — la normalisation devenait
// alors sensible aux accents sans que rien ne le signale.
const COMBINING_MARKS = /[\u0300-\u036f]/g;
const NON_ALPHANUMERIC = /[^a-z0-9\s]/g;

/** Minuscules, sans accents, sans ponctuation. */
export function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(NON_ALPHANUMERIC, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Rapproche singulier et pluriel français.
 *
 * Ce n'est PAS un lemmatiseur et ça n'a pas besoin de l'être : la même
 * transformation est appliquée des DEUX côtés de la comparaison, donc elle
 * doit seulement être cohérente, pas linguistiquement juste. « ciseaux »
 * devient « ciseau », un mot qui n'existe pas dans l'usage courant — mais
 * l'objet « Ciseaux » de l'inventaire devient « ciseau » lui aussi, et les
 * deux se retrouvent. C'est tout ce qu'on lui demande.
 *
 * Les mots de trois lettres ou moins sont laissés tels quels : « vis »,
 * « bas », « pas », « jus » perdraient leur sens en perdant leur « s ».
 */
export function singularize(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith('eaux')) return word.slice(0, -1); // bureaux -> bureau
  if (word.endsWith('aux')) return `${word.slice(0, -3)}al`; // journaux -> journal
  if (word.endsWith('s') || word.endsWith('x')) return word.slice(0, -1);
  return word;
}

/** Normalise ET ramène chaque mot au singulier — la forme à comparer. */
export function normalizeForMatch(value: string): string {
  const normalized = normalize(value);
  if (!normalized) return '';
  return normalized.split(' ').map(singularize).join(' ');
}

// Mots trop courants pour discriminer quoi que ce soit : les garder ferait
// correspondre n'importe quel objet dès qu'une requête contient « de » ou
// « la ». La dictée en produit beaucoup — « Indique-moi où sont tous les
// verres » ne porte qu'un seul mot utile.
const STOP_WORD_FORMS = [
  'de', 'du', 'des', 'la', 'le', 'les', 'un', 'une', 'mon', 'ma', 'mes', 'a', 'au', 'aux',
  'tout', 'tous', 'toute', 'toutes', 'ou', 'est', 'sont', 'moi', 'me', 'je', 'indique',
  'cherche', 'trouve', 'montre', 'dis',
  'of', 'the', 'my', 'all', 'where', 'is', 'are', 'find', 'show', 'tell',
];

// Le filtrage se fait sur des mots DÉJÀ singularisés : sans passer la
// liste par la même moulinette, « tous » deviendrait « tou » et ne serait
// plus reconnu comme mot vide. On garde les deux formes.
const STOP_WORDS = new Set([...STOP_WORD_FORMS, ...STOP_WORD_FORMS.map(singularize)]);
/**
 * Mots réellement porteurs de sens d'une requête, déjà normalisés et au
 * singulier. Retourne un tableau vide seulement si la requête était vide.
 */
export function meaningfulWords(query: string): string[] {
  const words = normalizeForMatch(query).split(' ').filter(Boolean);
  const kept = words.filter((word) => word.length > 1 && !STOP_WORDS.has(word));
  // Une requête entièrement composée de mots vides (« les miens ») vaut
  // mieux que rien : on retombe sur les mots bruts plutôt que de ne rien
  // chercher du tout.
  return kept.length > 0 ? kept : words;
}
