import { CANVAS_WIDTH } from './constants';

// Projection "2:1" façon jeu vidéo (pas un vrai calcul trigonométrique à
// 30°) : simple, bon marché, et visuellement très proche d'une maquette
// isométrique classique. x/y ici sont toujours des coordonnées MONDE (le
// repère plat existant des plan_formes) ; worldToScreen()/project() ne font
// que projeter pour l'affichage, la géométrie source (drag, resize, clamp)
// reste en monde.
export const ISO_X = 1;
export const ISO_Y = 0.5;

// Décalage vertical écran pur pour l'extrusion des murs — indépendant de la
// projection, appliqué après coup sur les points déjà projetés.
export const WALL_HEIGHT = 46;

// Origine écran de la projection : centre horizontalement (les coordonnées
// monde peuvent projeter à gauche ET à droite de 0 selon x-y), petite marge
// en haut. Partagée par PlanCanvas (formes) et PlanPinLayer (pastilles) pour
// qu'elles s'alignent exactement.
const ISO_ORIGIN_X = CANVAS_WIDTH / 2;
const ISO_ORIGIN_Y = 20;

export function worldToScreen(x: number, y: number): { x: number; y: number } {
  return { x: (x - y) * ISO_X, y: (x + y) * ISO_Y };
}

export function project(x: number, y: number): { x: number; y: number } {
  const p = worldToScreen(x, y);
  return { x: ISO_ORIGIN_X + p.x, y: ISO_ORIGIN_Y + p.y };
}

// Rectangle en espace MONDE — géométrie source d'une forme (PlanCanvas) ou
// utilisée pour resituer une pastille (PlanPinLayer) dans le repère de sa
// pièce parente. Partagé pour éviter un import circulaire entre les deux.
export type ShapeGeometry = { x: number; y: number; width: number; height: number };

// Convertit un delta écran (geste tactile) en delta monde. Nécessaire car
// sous la projection, glisser tout droit à l'écran ne correspond plus à un
// déplacement 1:1 sur les axes x/y du monde — comportement attendu : un
// geste vertical à l'écran déplace la pièce en diagonale dans le plan,
// comme dans n'importe quel éditeur isométrique.
export function screenDeltaToWorldDelta(dsx: number, dsy: number): { x: number; y: number } {
  const dwx = (dsx / ISO_X + dsy / ISO_Y) / 2;
  const dwy = (dsy / ISO_Y - dsx / ISO_X) / 2;
  return { x: dwx, y: dwy };
}
