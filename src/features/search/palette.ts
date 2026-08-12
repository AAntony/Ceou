// Rotation pastel partagée entre le fond de carte (teinte claire) et le badge
// hexagonal (teinte saturée) — 4 teintes de la palette de marque, en rotation
// par index plutôt qu'une couleur fixe par type (aucune donnée ne justifie un
// mapping type -> couleur).
export type Hue = 'teal' | 'coral' | 'mustard' | 'sky';

const HUES: Hue[] = ['teal', 'coral', 'mustard', 'sky'];

export function hueAt(index: number): Hue {
  return HUES[index % HUES.length];
}

export const HUE_CARD_BG: Record<Hue, string> = {
  teal: 'bg-teal-light',
  coral: 'bg-coral-light',
  mustard: 'bg-mustard-light',
  sky: 'bg-sky-light',
};

export const HUE_BADGE_FILL: Record<Hue, string> = {
  teal: '#2EC4B6',
  coral: '#FF6B4A',
  mustard: '#FFC857',
  sky: '#5B9BE0',
};
