import type { IconName } from '../../components/Icon';

export type PlanShapeType = 'rectangle' | 'circle' | 'triangle';

export const PLAN_SHAPE_TYPES: { key: PlanShapeType; icon: IconName }[] = [
  { key: 'rectangle', icon: 'rectangle' },
  { key: 'circle', icon: 'circle' },
  { key: 'triangle', icon: 'triangle' },
];

export const DEFAULT_SHAPE_SIZE = 80;
export const MIN_SHAPE_SIZE = 30;
export const MAX_SHAPE_SIZE = 300;
export const CANVAS_WIDTH = 340;
export const CANVAS_HEIGHT = 600;
