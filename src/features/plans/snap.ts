import type { HandleId, ShapeGeometry } from './types';

// Unités écran (~pixels) : une pièce glissée ou redimensionnée dont un bord
// passe à moins de ce seuil du bord d'une AUTRE pièce s'aligne exactement
// dessus (accolées, sans recouvrement ni espace). Purement géométrique,
// recalculé à chaque frame à partir des positions actuelles de toutes les
// pièces — pas de relation "attachée à" persistée en base : déplacer une
// pièce plus tard n'entraîne pas ses voisines avec elle.
export const SNAP_THRESHOLD = 10;

export function snapPosition(x: number, y: number, width: number, height: number, others: ShapeGeometry[]): { x: number; y: number } {
  let sx = x;
  let sy = y;
  for (const o of others) {
    if (Math.abs(x - (o.x + o.width)) < SNAP_THRESHOLD) sx = o.x + o.width;
    else if (Math.abs(x + width - o.x) < SNAP_THRESHOLD) sx = o.x - width;
    if (Math.abs(y - (o.y + o.height)) < SNAP_THRESHOLD) sy = o.y + o.height;
    else if (Math.abs(y + height - o.y) < SNAP_THRESHOLD) sy = o.y - height;
  }
  return { x: sx, y: sy };
}

// N'ajuste que le(s) bord(s) que la poignée `handle` déplace, sans toucher
// au(x) bord(s) opposé(s) fixe(s) — même principe que applyHandle (PlanCanvas)
// dont ceci vient compléter le résultat.
export function snapResize(next: ShapeGeometry, handle: HandleId, others: ShapeGeometry[]): ShapeGeometry {
  let { x, y, width, height } = next;
  const right = x + width;
  const bottom = y + height;

  if (handle.includes('w')) {
    for (const o of others) {
      if (Math.abs(x - (o.x + o.width)) < SNAP_THRESHOLD) {
        x = o.x + o.width;
        break;
      }
      if (Math.abs(x - o.x) < SNAP_THRESHOLD) {
        x = o.x;
        break;
      }
    }
    width = right - x;
  }
  if (handle.includes('e')) {
    for (const o of others) {
      if (Math.abs(right - o.x) < SNAP_THRESHOLD) {
        width = o.x - x;
        break;
      }
      if (Math.abs(right - (o.x + o.width)) < SNAP_THRESHOLD) {
        width = o.x + o.width - x;
        break;
      }
    }
  }
  if (handle.includes('n')) {
    for (const o of others) {
      if (Math.abs(y - (o.y + o.height)) < SNAP_THRESHOLD) {
        y = o.y + o.height;
        break;
      }
      if (Math.abs(y - o.y) < SNAP_THRESHOLD) {
        y = o.y;
        break;
      }
    }
    height = bottom - y;
  }
  if (handle.includes('s')) {
    for (const o of others) {
      if (Math.abs(bottom - o.y) < SNAP_THRESHOLD) {
        height = o.y - y;
        break;
      }
      if (Math.abs(bottom - (o.y + o.height)) < SNAP_THRESHOLD) {
        height = o.y + o.height - y;
        break;
      }
    }
  }
  return { x, y, width, height };
}
