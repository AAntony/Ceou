import type { SearchKind } from './queries';

// Une teinte fixe par catégorie plutôt qu'une rotation par position : le
// but est de reconnaître la catégorie d'un résultat au premier coup d'œil
// (Pièce/Emplacement/Conteneur/Objet), donc la couleur doit être stable
// d'une recherche à l'autre, pas dépendante de l'ordre d'affichage.
export type Hue = 'teal' | 'coral' | 'mustard' | 'lavender';

const HUE_BY_KIND: Record<SearchKind, Hue> = {
  piece: 'teal', // vert pastel
  emplacement: 'mustard', // jaune pastel
  conteneur: 'lavender', // violet pastel
  // `coral` est un nom HISTORIQUE : la couleur de marque est passee du
  // corail au bleu (#1591EA) le 2026-08-19, l'orange faisant trop
  // "imitation Leboncoin". Le nom du jeton n'a pas ete renomme pour ne pas
  // repandre un renommage de classes Tailwind non verifiable autrement que
  // par relecture. Conteneur a du quitter `sky` (bleu pastel) a cette
  // occasion : deux bleus pastel cote a cote ne se distinguaient plus.
  objet: 'coral', // bleu pastel (cf. ci-dessus)
};

export function hueForKind(kind: SearchKind): Hue {
  return HUE_BY_KIND[kind];
}

export const HUE_BADGE_FILL: Record<Hue, string> = {
  teal: '#2EC4B6',
  coral: '#1591EA',
  mustard: '#FFC857',
  lavender: '#8B7BD8',
};

// Fond de carte en hex brut plutôt qu'en classe Tailwind — EntityCard (donc
// ResultCard, qui délègue son rendu à EntityCard) applique la couleur via un
// style inline, seul moyen d'accepter aussi une couleur dynamique (ex. la
// couleur choisie d'une Pièce) en plus de ces teintes fixes par catégorie.
// Valeurs identiques à tailwind.config.js (`<hue>.light`).
export const HUE_CARD_BG_HEX: Record<Hue, string> = {
  teal: '#DBF7F4',
  coral: '#D8E8F3',
  mustard: '#FFF3DA',
  lavender: '#E8E2FA',
};
