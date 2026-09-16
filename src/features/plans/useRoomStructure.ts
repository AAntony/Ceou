import { useMemo } from 'react';
import { buildRoomStructure } from './roomStructure';

export function useRoomStructure(...[rooms, geometry, doors]: Parameters<typeof buildRoomStructure>) {
  return useMemo(() => buildRoomStructure(rooms, geometry, doors), [rooms, geometry, doors]);
}
