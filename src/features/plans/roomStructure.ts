import type { DoorEdge, ShapeGeometry } from './types';
import { doorJambs, wallSegments } from './walls';

type DoorSpan = { edge: DoorEdge; position: number };
type RoomStructure = { walls: ReturnType<typeof wallSegments>; jambs: ReturnType<typeof doorJambs> };

/** Structural geometry is independent of labels, colour, selection and drawing order. */
export function buildRoomStructure(
  rooms: readonly { id: string }[],
  geometry: Record<string, ShapeGeometry>,
  doors: Record<string, DoorSpan[]>,
): Record<string, RoomStructure> {
  const neighbours = rooms.map(({ id }) => ({ id, geo: geometry[id], doors: doors[id] ?? [] }));
  const result: Record<string, RoomStructure> = {};
  for (const room of neighbours) {
    const others = neighbours.filter(({ id }) => id !== room.id);
    result[room.id] = {
      walls: wallSegments(room.geo, room.doors, others),
      jambs: doorJambs(room.geo, room.doors, others),
    };
  }
  return result;
}
