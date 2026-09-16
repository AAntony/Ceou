import assert from 'node:assert/strict';
import { register } from 'node:module';
import { test } from 'node:test';
register('./ts-extensions.mjs', import.meta.url);
const { applyHandle, clampZoomState, handleAnchor } = await import('../../src/features/plans/canvasGeometry.ts');
const { buildRoomStructure } = await import('../../src/features/plans/roomStructure.ts');
const { wallSegments, doorJambs } = await import('../../src/features/plans/walls.ts');

test('all resize handles keep the opposite edges anchored, including minimum sizes', () => {
  const original = { x: 100, y: 200, width: 100, height: 80 };
  for (const handle of ['nw','n','ne','e','se','s','sw','w']) {
    for (const delta of [-1000, -20, 0, 20, 1000]) {
      const result = applyHandle(original, handle, delta, delta);
      assert.ok(result.width >= 30 && result.width <= 300);
      assert.ok(result.height >= 30 && result.height <= 300);
      assert.equal(handle.includes('w') ? result.x + result.width : result.x, handle.includes('w') ? 200 : 100);
      assert.equal(handle.includes('n') ? result.y + result.height : result.y, handle.includes('n') ? 280 : 200);
    }
  }
  assert.deepEqual(handleAnchor(original, 'se'), { x: 200, y: 280 });
  assert.deepEqual(original, { x: 100, y: 200, width: 100, height: 80 });
});

test('zoom contains the sheet and exploration remains bounded', () => {
  assert.deepEqual(clampZoomState({ scale: 0.1, translateX: 999, translateY: -999 }, 390, 844, 0.325), { scale: 0.325, translateX: 0, translateY: 227 });
  for (const explore of [false, true]) {
    const zoom = clampZoomState({ scale: 10, translateX: -99999, translateY: 99999 }, 390, 844, 0.325, explore);
    assert.equal(zoom.scale, 3);
    assert.equal(zoom.translateY, explore ? 422 : 0);
    assert.equal(zoom.translateX, explore ? 195 - 3600 : 390 - 3600);
  }
});

test('structural extraction preserves shared walls and door gaps regardless of draw order', () => {
  const rooms = Array.from({ length: 12 }, (_, i) => ({ id: String(i) }));
  const geometry = Object.fromEntries(rooms.map(({ id }, i) => [id, { x: (i % 4)*100, y: Math.floor(i/4)*80, width: 100, height: 80 }]));
  const doors = { '0': [{ edge: 'e', position: 0.5 }], '5': [{ edge: 's', position: 0.35 }] };
  const structure = buildRoomStructure(rooms, geometry, doors);
  for (const room of rooms) {
    const neighbours = rooms.filter(({ id }) => id !== room.id).map(({ id }) => ({ geo: geometry[id], doors: doors[id] ?? [] }));
    assert.deepEqual(structure[room.id], { walls: wallSegments(geometry[room.id], doors[room.id] ?? [], neighbours), jambs: doorJambs(geometry[room.id], doors[room.id] ?? [], neighbours) });
  }
  assert.deepEqual(buildRoomStructure([...rooms].reverse(), geometry, doors), structure);
  assert.deepEqual(buildRoomStructure([], {}, {}), {});
});
