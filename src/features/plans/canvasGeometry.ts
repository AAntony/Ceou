import { MAX_ZOOM, WORLD_HEIGHT, WORLD_WIDTH } from './constants';
import { clamp, clampSize } from './snap';
import type { HandleId, ShapeGeometry } from './types';

export function handleAnchor(geo: ShapeGeometry, handle: HandleId): { x: number; y: number } {
  const cx = geo.x + geo.width / 2;
  const cy = geo.y + geo.height / 2;
  const right = geo.x + geo.width;
  const bottom = geo.y + geo.height;
  const positions: Record<HandleId, { x: number; y: number }> = {
    nw: { x: geo.x, y: geo.y },
    n: { x: cx, y: geo.y },
    ne: { x: right, y: geo.y },
    e: { x: right, y: cy },
    se: { x: right, y: bottom },
    s: { x: cx, y: bottom },
    sw: { x: geo.x, y: bottom },
    w: { x: geo.x, y: cy },
  };
  return positions[handle];
}

// Chaque poignée ne déplace que les bords qu'elle touche ; le(s) bord(s)
// opposé(s) restent ancrés sur la géométrie au début du geste.
export function applyHandle(origin: ShapeGeometry, handle: HandleId, dx: number, dy: number): ShapeGeometry {
  let { x, y, width, height } = origin;
  const right = origin.x + origin.width;
  const bottom = origin.y + origin.height;

  if (handle.includes('w')) {
    width = clampSize(origin.width - dx);
    x = right - width;
  }
  if (handle.includes('e')) {
    width = clampSize(origin.width + dx);
  }
  if (handle.includes('n')) {
    height = clampSize(origin.height - dy);
    y = bottom - height;
  }
  if (handle.includes('s')) {
    height = clampSize(origin.height + dy);
  }
  return { x, y, width, height };
}

export type ZoomState = { scale: number; translateX: number; translateY: number };
export const IDLE_ZOOM: ZoomState = { scale: 1, translateX: 0, translateY: 0 };

// La feuille (WORLD_WIDTH x WORLD_HEIGHT) est une zone FIXE et LIMITÉE : on
// ne peut jamais dézoomer plus loin que "toute la feuille visible d'un coup"
// (minScale), ni glisser la vue pour révéler quoi que ce soit au-delà de son
// bord. Sur l'axe où la feuille projetée est plus petite que le viewport,
// elle reste centrée (rien à glisser sur cet axe) ; sur l'axe où elle est
// plus grande, le glissé est borné pile à ses bords — jamais de vide au-delà.
// Même principe qu'une visionneuse d'image/PDF (contain, puis pan une fois
// zoomé), plutôt qu'un canevas panoramique sans limite perceptible.
export function clampZoomState(z: ZoomState, viewportW: number, viewportH: number, minScale: number, explore = false): ZoomState {
  const scale = clamp(z.scale, minScale, MAX_ZOOM);
  const contentW = WORLD_WIDTH * scale;
  const contentH = WORLD_HEIGHT * scale;
  if (explore) return { scale, translateX: clamp(z.translateX, viewportW / 2 - contentW, viewportW / 2), translateY: clamp(z.translateY, viewportH / 2 - contentH, viewportH / 2) };
  const translateX = contentW <= viewportW ? (viewportW - contentW) / 2 : clamp(z.translateX, viewportW - contentW, 0);
  const translateY = contentH <= viewportH ? (viewportH - contentH) / 2 : clamp(z.translateY, viewportH - contentH, 0);
  return { scale, translateX, translateY };
}

