import type { IconName } from '../../components/Icon';

// "circle" retiré (Phase 7) : simplifie l'éditeur à des pièces rectangulaires
// uniquement (cas réel quasi systématique pour un plan d'architecte). Les
// formes "circle" déjà en base ne sont pas perdues : PlanCanvas les traite
// comme des rectangles (leur width/height définissent déjà une bounding box).
export type PlanShapeType = 'rectangle';

export const PLAN_SHAPE_TYPES: { key: PlanShapeType; icon: IconName }[] = [{ key: 'rectangle', icon: 'rectangle' }];

export const DEFAULT_SHAPE_SIZE = 80;
export const MIN_SHAPE_SIZE = 30;
export const MAX_SHAPE_SIZE = 300;
export const CANVAS_WIDTH = 340;
export const CANVAS_HEIGHT = 600;

export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 3;

// Couleur dédiée au surlignage "Voir sur le plan" (delibérément hors de
// ROOM_COLOR_PALETTE, qui reste dans des tons pastel — celle-ci doit se
// distinguer sans ambiguïté de la couleur normale d'une pièce).
export const HIGHLIGHT_GREEN = '#4CAF50';

// Palette pastel — volontairement distincte de celle des résultats de
// recherche (src/features/search/palette.ts, 4 teintes par TYPE D'ENTITÉ) :
// ici on distingue des PIÈCES entre elles sur un même plan.
export const ROOM_COLOR_PALETTE: string[] = [
  '#F3C6D9',
  '#C9E4C5',
  '#FCE8A8',
  '#BEE3DB',
  '#D7C9F2',
  '#F6D8B8',
  '#BFD7EA',
  '#D6CFC7',
  '#C8CDD3',
  '#E8D5C4',
];

// Couleur PAR PIÈCE INDIVIDUELLE (pas par catégorie) : un hash déterministe
// sur l'id de la FORME (pas de la pièce — une forme sans piece_id doit quand
// même avoir une couleur) garantit que la même pièce garde toujours la même
// couleur d'une session à l'autre, et que deux pièces voisines sont
// visuellement distinctes même si elles partagent la même catégorie (deux
// Chambres côte à côte) ou n'ont pas de catégorie du tout.
export function roomColorForForme(formeId: string): string {
  let hash = 0;
  for (let i = 0; i < formeId.length; i++) hash = (hash * 31 + formeId.charCodeAt(i)) >>> 0;
  return ROOM_COLOR_PALETTE[hash % ROOM_COLOR_PALETTE.length];
}

// Assombrit une couleur hex #RRGGBB d'un facteur 0..1 (0 = inchangée, 1 =
// noir) — dérive la couleur de contour depuis la couleur de sol plutôt que
// de maintenir une deuxième valeur à la main.
export function shade(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const darken = (channel: number) => Math.round(channel * (1 - factor));
  const toHex = (channel: number) => channel.toString(16).padStart(2, '0');
  return `#${toHex(darken(r))}${toHex(darken(g))}${toHex(darken(b))}`;
}
