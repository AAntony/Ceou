// Teintes pastel des cartes en grille (amis, plans partagés). Chaque
// appelant choisit la sienne explicitement.
//
// La table qui associait une teinte à un TYPE de résultat de recherche a été
// retirée le 2026-08-21 : l'accueil n'affiche plus de pastille colorée par
// catégorie mais la photo de l'objet (ou l'illustration de son niveau), donc
// plus rien ne consommait cette association.
export type Hue = 'teal' | 'coral' | 'mustard' | 'lavender';

export const HUE_BADGE_FILL: Record<Hue, string> = {
  teal: '#2EC4B6',
  coral: '#1591EA',
  mustard: '#FFC857',
  lavender: '#8B7BD8',
};

// Fond de carte en hex brut plutôt qu'en classe Tailwind — EntityCard
// applique la couleur via un style inline, seul moyen d'accepter aussi une
// couleur dynamique (ex. la couleur choisie d'une Pièce) en plus de ces
// teintes fixes.
// Valeurs identiques à tailwind.config.js (`<hue>.light`).
export const HUE_CARD_BG_HEX: Record<Hue, string> = {
  teal: '#DBF7F4',
  coral: '#D8E8F3',
  mustard: '#FFF3DA',
  lavender: '#E8E2FA',
};
