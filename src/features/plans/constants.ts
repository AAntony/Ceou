export type PlanShapeType = 'rectangle' | 'circle' | 'triangle';

export const PLAN_SHAPE_TYPES: { key: PlanShapeType; icon: string }[] = [
  { key: 'rectangle', icon: '▭' },
  { key: 'circle', icon: '⬤' },
  { key: 'triangle', icon: '▲' },
];

export const DEFAULT_SHAPE_SIZE = 80;
export const CANVAS_WIDTH = 340;
export const CANVAS_HEIGHT = 600;
