// L'ÉTIQUETTE COURTE D'UN NIVEAU, tirée du nom libre du plan.
//
// Le sélecteur d'étage est une colonne étroite posée sur le plan : il ne peut
// pas afficher « Rez-de-chaussée » sans manger la moitié de la largeur utile.
// Il lui faut trois ou quatre signes, et surtout des signes qui distinguent
// un niveau d'un autre au premier coup d'œil.
//
// La règle est volontairement générique, sans dictionnaire de mots français :
// « Rez-de-chaussée » donne RDC parce que c'est un nom en trois morceaux, pas
// parce qu'on a reconnu la formule. Elle marche donc aussi en anglais
// (« Ground floor » → GF) et sur ce que la personne invente.
//
// Le nom COMPLET n'est jamais perdu : il reste le titre de l'écran, et il est
// ce qu'annonce le lecteur d'écran sur chaque bouton du sélecteur.

const MAX_LENGTH = 4;

// Espaces, tirets longs, soulignés, barres obliques : ce qui sépare deux
// morceaux d'un nom composé. Le trait d'union en fait partie SAUF devant un
// chiffre — sans quoi « Niveau -1 » perdrait son signe et deviendrait N1,
// c'est-à-dire un étage au lieu d'un sous-sol.
const SEPARATORS = /[\s–—_/]+|-(?!\d)/;

// Un morceau qui commence par un nombre, signe compris.
const LEADING_NUMBER = /^-?\d+/;

// Un mot unique terminé par un nombre : « Étage1 », « Étage-1 », « -1 ».
const WORD_THEN_NUMBER = /^(\D+)(-?\d+)$/;

export function floorLabel(name: string): string {
  const parts = name.trim().split(SEPARATORS).filter(Boolean);
  if (parts.length === 0) return '?';

  if (parts.length === 1) {
    const word = parts[0];
    // Un mot collé à son numéro se coupe entre les deux : « Étage1 » doit
    // donner É1, et non « Étag » — qui serait identique pour tous les étages.
    const numbered = WORD_THEN_NUMBER.exec(word);
    if (numbered) return (numbered[1].charAt(0).toUpperCase() + numbered[2]).slice(0, MAX_LENGTH);
    // Sinon on le tronque plutôt que de le réduire à son initiale : « G » ne
    // dirait rien, « Gren » se relit comme Grenier.
    return capitalize(word.slice(0, MAX_LENGTH));
  }

  // PLUSIEURS MORCEAUX : l'initiale de chacun. Un morceau qui commence par
  // des chiffres les garde ENTIERS — « Étage 1 » doit donner É1 et non É,
  // sans quoi tous les étages se ressembleraient.
  return parts
    .map((part) => {
      const digits = LEADING_NUMBER.exec(part);
      return digits ? digits[0] : part.charAt(0).toUpperCase();
    })
    .join('')
    .slice(0, MAX_LENGTH);
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
