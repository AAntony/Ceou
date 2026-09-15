export type LabelRect = { x: number; y: number; width: number; height: number };

export function overlaps(a: LabelRect, b: LabelRect, gap = 4): boolean {
  return a.x < b.x + b.width + gap && a.x + a.width + gap > b.x &&
    a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;
}

/** Labels stay inside their room; never fall back to an occupied position. */
export function placeRoomLabel(room: LabelRect, size: { width: number; height: number }, occupied: LabelRect[]): LabelRect | null {
  const padding = 6;
  if (size.width + padding * 2 > room.width || size.height + padding * 2 > room.height) return null;
  for (const fraction of [0.5, 0, 1]) {
    const candidate = { x: room.x + (room.width - size.width) / 2,
      y: room.y + padding + (room.height - size.height - padding * 2) * fraction, ...size };
    if (!occupied.some((other) => overlaps(candidate, other))) return candidate;
  }
  return null;
}

/** Stable numbering shared by the canvas and its readable legend. */
export function orderedRooms<T extends { id: string; x: number; y: number }>(rooms: T[]): T[] {
  return [...rooms].sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
}

export function orderedPins<T extends { id: string; rel_x: number; rel_y: number }>(pins: T[]): T[] {
  return [...pins].sort((a, b) => a.rel_y - b.rel_y || a.rel_x - b.rel_x || a.id.localeCompare(b.id));
}
