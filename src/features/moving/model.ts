export type MovingPhase = 'preparation' | 'moving' | 'unpacking' | 'completed';
export type ItemOutcome = 'packed' | 'installed' | 'stored' | 'lost' | 'given' | 'sold' | 'discarded' | 'removed';
export type MovingProject = { id: string; name: string; source_id: string | null; destination_id: string | null; planned_date: string | null; status: MovingPhase; created_at: string; editable?: boolean };
export type MovingBox = { id: string; project_id: string; container_id: string | null; number: number; name: string; category: string | null; description: string | null; photo_url: string | null; destination_piece_id: string | null; destination_name: string | null; status: 'packing' | 'ready' | 'transported' | 'stored' };
export type MovingItem = { project_id: string; object_id: string; box_id: string; name: string; origin_type: string | null; origin_id: string | null; origin_label: string | null; outcome: ItemOutcome; packed_at: string; resolved_at: string | null };
export type MovingObject = { id: string; name: string; photo_url: string | null; parent_type: 'emplacement' | 'conteneur'; parent_id: string; parent_label: string; habitation_id: string; piece_name: string };
export type MovingSnapshot = { project: MovingProject; editable: boolean; boxes: MovingBox[]; items: MovingItem[]; objects: MovingObject[] };
export type BoxFilter = 'all' | 'packing' | 'ready' | 'transported' | 'done';
export function boxState(box: MovingBox, items: MovingItem[]): BoxFilter | 'stored' {
  if (box.status === 'stored') return 'stored';
  const history = items.filter(item => item.box_id === box.id);
  if (history.length && history.every(item => item.outcome !== 'packed')) return 'done';
  return box.status;
}
export function movingProgress(items: MovingItem[]) {
  const installed = items.filter(i => i.outcome === 'installed').length;
  const stored = items.filter(i => i.outcome === 'stored').length;
  const packed = items.filter(i => i.outcome === 'packed').length;
  const resolved = items.length - packed;
  return { total: items.length, installed, stored, packed, resolved,
    percent: items.length ? Math.round(resolved * 100 / items.length) : 0 };
}
export const movingQr = (boxId: string) => `ceou://moving-box/${boxId}`;
export function parseMovingQr(value: string): string | null {
  return /^ceou:\/\/moving-box\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(value.trim())?.[1] ?? null;
}
export function normalizeName(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }
export function matchingObjects(name: string, objects: MovingObject[]) {
  const terms = normalizeName(name).split(/\s+/).filter(term => term.length > 2);
  if (!terms.length) return [];
  return objects.map(object => ({ object, score: normalizeName(object.name) === normalizeName(name) ? 100 : terms.filter(term => normalizeName(object.name).includes(term)).length / terms.length }))
    .filter(row => row.score >= 0.5).sort((a,b) => b.score-a.score || a.object.name.localeCompare(b.object.name)).slice(0,4).map(row => row.object);
}
