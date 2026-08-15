import type { IconName } from '../../components/Icon';
import type { PieceTypeKey } from '../inventory/constants';

// "circle" retiré (Phase 7) : la maquette isométrique ne montre que des
// pièces rectangulaires (cas réel quasi systématique) — extruder une
// ellipse en isométrique (arcs de mur ombrés) est nettement plus complexe
// qu'un rectangle pour un bénéfice visuel quasi nul. Les formes "circle"
// déjà en base ne sont pas perdues : PlanCanvas les traite comme des
// rectangles (leur width/height définissent déjà une bounding box).
export type PlanShapeType = 'rectangle';

export const PLAN_SHAPE_TYPES: { key: PlanShapeType; icon: IconName }[] = [{ key: 'rectangle', icon: 'rectangle' }];

export const DEFAULT_SHAPE_SIZE = 80;
export const MIN_SHAPE_SIZE = 30;
export const MAX_SHAPE_SIZE = 300;
export const CANVAS_WIDTH = 340;
export const CANVAS_HEIGHT = 600;

// Couleur de sol pastel de base par type de pièce — volontairement distincte
// de la palette des résultats de recherche (src/features/search/palette.ts,
// 4 teintes par TYPE D'ENTITÉ) : ici on distingue des PIÈCES entre elles sur
// un même plan, un besoin différent (variété façon maquette).
export const PLAN_ROOM_COLORS: Record<PieceTypeKey, string> = {
  chambre: '#F3C6D9',
  sejour: '#C9E4C5',
  cuisine: '#FCE8A8',
  salle_de_bain: '#BEE3DB',
  bureau: '#D7C9F2',
  dressing: '#F6D8B8',
  buanderie: '#BFD7EA',
  cave: '#D6CFC7',
  garage: '#C8CDD3',
  entree: '#E8D5C4',
  autre: '#E0E0E0',
};

export const UNASSIGNED_ROOM_COLOR = '#E0E0E0';

export function roomFloorColor(presetKey: string | null): string {
  if (!presetKey) return UNASSIGNED_ROOM_COLOR;
  return PLAN_ROOM_COLORS[presetKey as PieceTypeKey] ?? UNASSIGNED_ROOM_COLOR;
}

// Assombrit une couleur hex #RRGGBB d'un facteur 0..1 (0 = inchangée, 1 =
// noir) — dérive les 2 teintes de mur depuis la seule couleur de sol plutôt
// que de maintenir 33 valeurs à la main.
export function shade(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const darken = (channel: number) => Math.round(channel * (1 - factor));
  const toHex = (channel: number) => channel.toString(16).padStart(2, '0');
  return `#${toHex(darken(r))}${toHex(darken(g))}${toHex(darken(b))}`;
}
