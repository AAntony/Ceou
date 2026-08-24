import { MAX_SHAPE_SIZE, MIN_SHAPE_SIZE, WORLD_HEIGHT, WORLD_WIDTH } from './constants';
import type { HandleId, ShapeGeometry } from './types';

// Unités écran (~pixels) : une pièce glissée ou redimensionnée dont un bord
// passe à moins de ce seuil du bord d'une AUTRE pièce s'aligne exactement
// dessus (accolées, sans recouvrement ni espace). Purement géométrique,
// recalculé à chaque frame à partir des positions actuelles de toutes les
// pièces — pas de relation "attachée à" persistée en base : déplacer une
// pièce plus tard n'entraîne pas ses voisines avec elle.
export const SNAP_THRESHOLD = 10;

// Partagé avec PlanCanvas.tsx (clamp générique borne aussi le zoom, pas
// seulement une taille de pièce) — une seule définition plutôt que deux
// copies identiques dans les deux fichiers.
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// Également exportée : PlanCanvas.tsx la réutilise pour clamper la taille
// pendant le redimensionnement brut (applyHandle), avant même le calcul
// d'accolement magnétique ci-dessous.
export function clampSize(value: number): number {
  return clamp(value, MIN_SHAPE_SIZE, MAX_SHAPE_SIZE);
}

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
// dont ceci vient compléter le résultat. Chaque largeur/hauteur recalculée
// après un accolement est repassée par clampSize() : sans ça, une pièce
// accolée à un voisin situé loin de sa taille déjà pincée par applyHandle()
// pouvait ressortir bien plus grande que MAX_SHAPE_SIZE (voire une largeur
// négative si le voisin dépassait le bord opposé), un vrai bug — la pastille
// de sélection (qui reflète toujours la géométrie exacte) se retrouvait
// alors bien plus large que le rectangle réellement dessiné, resté limité
// par une autre valeur en aval : symptôme observé d'un "mur invisible"
// coupant la pièce en deux.
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
    width = clampSize(right - x);
    x = right - width;
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
    width = clampSize(width);
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
    height = clampSize(bottom - y);
    y = bottom - height;
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
    height = clampSize(height);
  }
  return { x, y, width, height };
}

// Glissé : la pièce bute contre le bord de la feuille sans changer de
// taille — x/y sont simplement bornés à [0, WORLD_WIDTH-width] /
// [0, WORLD_HEIGHT-height].
export function clampPositionToWorld(x: number, y: number, width: number, height: number): { x: number; y: number } {
  return {
    x: Math.min(Math.max(x, 0), Math.max(0, WORLD_WIDTH - width)),
    y: Math.min(Math.max(y, 0), Math.max(0, WORLD_HEIGHT - height)),
  };
}

// Redimensionnement : un bord précis (celui que la poignée déplace) a pu
// dépasser la feuille — on RÉDUIT depuis ce bord-là plutôt que de
// repositionner tout le rectangle, sinon pousser contre le bord droit de la
// feuille ferait glisser toute la pièce vers la gauche au lieu de buter
// dessus (le bord opposé, fixe pendant le geste, doit le rester ici aussi).
export function clampResizeToWorld(geo: ShapeGeometry): ShapeGeometry {
  let { x, y, width, height } = geo;
  if (x < 0) {
    width += x;
    x = 0;
  }
  if (x + width > WORLD_WIDTH) {
    width = WORLD_WIDTH - x;
  }
  if (y < 0) {
    height += y;
    y = 0;
  }
  if (y + height > WORLD_HEIGHT) {
    height = WORLD_HEIGHT - y;
  }
  return { x, y, width: Math.max(width, MIN_SHAPE_SIZE), height: Math.max(height, MIN_SHAPE_SIZE) };
}

// === Puces d Emplacement =================================================

// La marge qu'une puce garde avec le mur, exprimée en unités feuille : la
// DEMI-HAUTEUR de la carte, sur les DEUX axes.
//
// C'était la demi-LARGEUR à l'horizontale, et c'est ce qui empêchait de coller
// une puce au mur de gauche ou de droite. Les pièces sont bien plus larges que
// hautes du point de vue d'une carte de 54×36 : dans une chambre de 130 de
// large, la demi-largeur mangeait 42 % du débattement horizontal quand la
// demi-hauteur n'en prenait que 20 % à la verticale — et en taille XL la plage
// se refermait complètement, la puce restait clouée au centre. D'où
// l'asymétrie constatée : haut et bas répondaient, gauche et droite non.
//
// Prendre la demi-hauteur des deux côtés rend le débattement identique sur les
// deux axes. La carte déborde alors du mur latéral de la moitié de ce qui la
// rend plus large que haute — une dizaine d'unités —, ce qui est le prix pour
// que l'icône vienne réellement se poser contre le mur.
const MAX_EDGE_INSET_REL = 0.35;

// Distance, en unités feuille, à laquelle deux puces s'aimantent l'une à
// l'autre. Plus courte que l'aimant des murs (SNAP_THRESHOLD) : deux puces
// voisines sont bien plus proches l'une de l'autre qu'un mur ne l'est du
// centre d'une pièce, et un aimant trop long les rendrait impossibles à
// séparer.
const PIN_SNAP = 8;

/**
 * Aimante la puce sur ses voisines de la MÊME pièce.
 *
 * Trois accroches par axe, essayées de la plus proche à la plus lointaine :
 * bord contre bord des deux côtés (les deux cartes se touchent), et centre
 * contre centre (les deux s'alignent en rangée ou en colonne). Toutes les
 * puces ayant la même taille, un décalage d'exactement une largeur ou une
 * hauteur de carte suffit à les faire se toucher.
 *
 * Les deux axes sont traités séparément : une puce peut donc s'aligner en
 * hauteur sur une voisine tout en gardant sa position horizontale.
 */
export function snapToSiblings(
  x: number,
  y: number,
  siblings: { x: number; y: number }[],
  cardWidth: number,
  cardHeight: number,
): { x: number; y: number } {
  let snappedX = x;
  let snappedY = y;
  let closestX = PIN_SNAP;
  let closestY = PIN_SNAP;

  for (const sibling of siblings) {
    for (const candidate of [sibling.x - cardWidth, sibling.x, sibling.x + cardWidth]) {
      const distance = Math.abs(x - candidate);
      if (distance < closestX) {
        closestX = distance;
        snappedX = candidate;
      }
    }
    for (const candidate of [sibling.y - cardHeight, sibling.y, sibling.y + cardHeight]) {
      const distance = Math.abs(y - candidate);
      if (distance < closestY) {
        closestY = distance;
        snappedY = candidate;
      }
    }
  }

  return { x: snappedX, y: snappedY };
}

export function resolvePinRel(value: number, sideLength: number, margin: number): number {
  if (sideLength <= 0) return clamp(value, 0, 1);
  // Plafond : sur une pièce minuscule, la marge ne doit jamais refermer la
  // plage au point de figer la puce au centre.
  const edgeInsetRel = Math.min(margin / sideLength, MAX_EDGE_INSET_REL);
  const thresholdRel = SNAP_THRESHOLD / sideLength;
  const bounded = clamp(value, edgeInsetRel, 1 - edgeInsetRel);
  if (bounded < edgeInsetRel + thresholdRel) return edgeInsetRel;
  if (bounded > 1 - edgeInsetRel - thresholdRel) return 1 - edgeInsetRel;
  return bounded;
}
