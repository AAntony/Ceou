// Rectangle en espace écran (plan 2D top-down pur, pas de projection) —
// géométrie source d'une forme (PlanCanvas), et utilisée pour resituer une
// pastille d'Emplacement dans le repère de sa pièce parente. Partagé pour
// éviter les imports circulaires entre PlanCanvas et les couches d'overlay
// (PlanPinLayer, snap).
export type ShapeGeometry = { x: number; y: number; width: number; height: number };

// nw/n/ne/e/se/s/sw/w — les 4 coins ajustent largeur ET hauteur (bord opposé
// fixe), les 4 milieux de segment n'ajustent qu'une seule dimension.
export type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

// Le mur d'une pièce sur lequel une porte est posée. Nord/est/sud/ouest dans
// le repère de la feuille, pas de la boussole : « n » est le mur du haut.
export type DoorEdge = 'n' | 'e' | 's' | 'w';
