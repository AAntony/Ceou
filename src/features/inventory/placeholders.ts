import type { ImageSourcePropType } from 'react-native';

// Illustration affichée quand un niveau n'a pas de photo.
//
// Ce sont des DESSINS, jamais des photographies, et c'est le point important
// (décision produit du 2026-08-21) : une photo de salon qui n'est pas le
// salon de l'utilisateur se lit comme une revendication — « voilà ta
// pièce » — alors qu'un croquis se lit immédiatement comme un emplacement
// vide à remplir. La distinction compte d'autant plus que tout l'écran
// consiste à reconnaître ses propres affaires d'un coup d'œil.
//
// Une image par NIVEAU, pas par type de pièce : « Cuisine » et « Cave » sans
// photo partagent donc le même croquis, c'est l'icône à côté qui les
// distingue. Un jeu par type serait 20 fichiers à produire et à maintenir
// pour un gain nul — l'illustration dit « pièce », l'icône dit laquelle.

export type EntityLevel = 'habitation' | 'piece' | 'emplacement' | 'conteneur' | 'objet';

// `require` statique et non un chemin calculé : Metro résout les assets à la
// compilation, un `require(variable)` ne serait tout simplement pas empaqueté.
export const PLACEHOLDER_IMAGES: Record<EntityLevel, ImageSourcePropType> = {
  habitation: require('../../../assets/placeholder_habitation.png'),
  piece: require('../../../assets/placeholder_piece.png'),
  emplacement: require('../../../assets/placeholder_emplacement.png'),
  conteneur: require('../../../assets/placeholder_conteneur.png'),
  objet: require('../../../assets/placeholder_objet.png'),
};
