import type { SearchKind } from './queries';

// Une teinte fixe par catégorie plutôt qu'une rotation par position : le
// but est de reconnaître la catégorie d'un résultat au premier coup d'œil
// (Pièce/Emplacement/Conteneur/Objet), donc la couleur doit être stable
// d'une recherche à l'autre, pas dépendante de l'ordre d'affichage.
export type Hue = 'teal' | 'coral' | 'mustard' | 'sky';

const HUE_BY_KIND: Record<SearchKind, Hue> = {
  piece: 'teal', // vert pastel
  emplacement: 'mustard', // jaune pastel
  conteneur: 'sky', // bleu pastel
  objet: 'coral', // rouge/corail pastel
};

export function hueForKind(kind: SearchKind): Hue {
  return HUE_BY_KIND[kind];
}

export const HUE_BADGE_FILL: Record<Hue, string> = {
  teal: '#2EC4B6',
  coral: '#FF6B4A',
  mustard: '#FFC857',
  sky: '#5B9BE0',
};

// Fond de carte en hex brut plutôt qu'en classe Tailwind — EntityCard (donc
// ResultCard, qui délègue son rendu à EntityCard) applique la couleur via un
// style inline, seul moyen d'accepter aussi une couleur dynamique (ex. la
// couleur choisie d'une Pièce) en plus de ces teintes fixes par catégorie.
// Valeurs identiques à tailwind.config.js (`<hue>.light`).
export const HUE_CARD_BG_HEX: Record<Hue, string> = {
  teal: '#DBF7F4',
  coral: '#FFE4DB',
  mustard: '#FFF3DA',
  sky: '#DCEBFB',
};
