import { DOOR_WIDTH, WALL_WIDTH } from './constants';
import type { DoorEdge, ShapeGeometry } from './types';

// Le trait de mur d'une pièce, PERCÉ de ses portes.
//
// Une porte n'est pas un objet posé sur le mur : c'est le mur qui s'arrête et
// reprend plus loin. C'est la convention des plans d'architecte, et c'est ce
// qui la rend discrète — elle retire de l'encre au lieu d'en ajouter (la
// version précédente, une pastille à icône, avait été retirée pour ça).
//
// D'où ce calcul : au lieu d'un rectangle tracé d'un trait, chaque mur est
// découpé en segments autour des ouvertures qu'il porte.

export type DoorSpan = { edge: DoorEdge; position: number };
export type Segment = { x1: number; y1: number; x2: number; y2: number };

/** Les quatre murs, du coin haut-gauche et dans le sens des aiguilles. */
const EDGES: DoorEdge[] = ['n', 'e', 's', 'w'];

function edgeLength(geo: ShapeGeometry, edge: DoorEdge): number {
  return edge === 'n' || edge === 's' ? geo.width : geo.height;
}

/** Point situé à `distance` du départ du mur, dans le repère de la feuille. */
function pointAlong(geo: ShapeGeometry, edge: DoorEdge, distance: number): { x: number; y: number } {
  if (edge === 'n') return { x: geo.x + distance, y: geo.y };
  if (edge === 's') return { x: geo.x + distance, y: geo.y + geo.height };
  if (edge === 'w') return { x: geo.x, y: geo.y + distance };
  return { x: geo.x + geo.width, y: geo.y + distance };
}

/**
 * Ramene une position pour que l'ouverture tienne ENTIEREMENT dans le mur.
 *
 * Sans ca, une porte posee tout au bord mange le coin de la piece : la
 * moitie de son ouverture depasse sur le mur perpendiculaire, et l'angle
 * disparait. Un mur plus court qu'une porte n'a d'autre choix que le centre.
 */
export function clampDoorPosition(position: number, wallLength: number): number {
  const half = DOOR_WIDTH / 2 / wallLength;
  if (half >= 0.5) return 0.5;
  return Math.min(1 - half, Math.max(half, position));
}

export function doorCenter(geo: ShapeGeometry, edge: DoorEdge, position: number): { x: number; y: number } {
  return pointAlong(geo, edge, position * edgeLength(geo, edge));
}

/**
 * Les deux extrémités de l'ouverture d'une porte, dans le repère de la
 * feuille — de quoi la surligner quand elle est sélectionnée, sans
 * recalculer la découpe des murs.
 */
export function doorSpan(geo: ShapeGeometry, edge: DoorEdge, position: number): Segment {
  const length = edgeLength(geo, edge);
  const center = position * length;
  const start = pointAlong(geo, edge, Math.max(0, center - DOOR_WIDTH / 2));
  const end = pointAlong(geo, edge, Math.min(length, center + DOOR_WIDTH / 2));
  return { x1: start.x, y1: start.y, x2: end.x, y2: end.y };
}

export function wallSegments(geo: ShapeGeometry, doors: DoorSpan[]): Segment[] {
  const segments: Segment[] = [];

  for (const edge of EDGES) {
    const length = edgeLength(geo, edge);

    // Les ouvertures de CE mur, ramenées à des intervalles [début, fin] le
    // long du mur, fusionnées quand elles se chevauchent — deux portes
    // voisines ne doivent pas laisser un moignon de trait entre elles.
    const gaps = doors
      .filter((door) => door.edge === edge)
      .map((door) => {
        const center = door.position * length;
        return { start: Math.max(0, center - DOOR_WIDTH / 2), end: Math.min(length, center + DOOR_WIDTH / 2) };
      })
      .sort((a, b) => a.start - b.start)
      .reduce<{ start: number; end: number }[]>((merged, gap) => {
        const last = merged[merged.length - 1];
        if (last && gap.start <= last.end) last.end = Math.max(last.end, gap.end);
        else merged.push({ ...gap });
        return merged;
      }, []);

    let cursor = 0;
    for (const gap of gaps) {
      if (gap.start > cursor) segments.push(segmentBetween(geo, edge, cursor, gap.start, length));
      cursor = Math.max(cursor, gap.end);
    }
    if (cursor < length) segments.push(segmentBetween(geo, edge, cursor, length, length));
  }

  return segments;
}

// Les extrémités qui tombent sur un COIN sont prolongées d'une demi-épaisseur
// de trait : sans ça, quatre segments qui se rejoignent bout à bout laissent
// une encoche carrée à chaque angle de la pièce. Les extrémités qui bordent
// une porte, elles, s'arrêtent net — c'est le tableau de l'ouverture.
function segmentBetween(geo: ShapeGeometry, edge: DoorEdge, from: number, to: number, length: number): Segment {
  const half = WALL_WIDTH / 2;
  const start = pointAlong(geo, edge, from === 0 ? -half : from);
  const end = pointAlong(geo, edge, to === length ? length + half : to);
  return { x1: start.x, y1: start.y, x2: end.x, y2: end.y };
}
