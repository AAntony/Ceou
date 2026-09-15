import assert from 'node:assert/strict';
import { test } from 'node:test';
import { placeRoomLabel, overlaps, orderedRooms, orderedPins } from '../../src/features/plans/exploreLayout.ts';

test('long names and large fonts fall back instead of overflowing a narrow room', () => {
  const room = { x: 0, y: 0, width: 75, height: 120 };
  assert.equal(placeRoomLabel(room, { width: 140, height: 20 }, []), null);
  assert.equal(placeRoomLabel(room, { width: 65, height: 40 }, []), null);
  assert.ok(placeRoomLabel(room, { width: 24, height: 24 }, []));
});

test('a crowded room never places text on top of a storage marker', () => {
  const room = { x: 0, y: 0, width: 140, height: 100 };
  const marker = { x: 50, y: 35, width: 24, height: 24 };
  const result = placeRoomLabel(room, { width: 100, height: 20 }, [marker]);
  assert.ok(result);
  assert.equal(overlaps(result, marker), false);
  assert.equal(placeRoomLabel(room, { width: 100, height: 20 }, [room]), null);
});

test('every returned label is contained and avoids previously placed labels at different zooms', () => {
  for (const scale of [0.2, 0.5, 1, 3]) {
    const occupied = [];
    for (const [x, y, width, height] of [[0,0,140,90],[140,0,100,90],[0,90,70,45],[70,90,170,45]]) {
      const room = { x: x*scale, y: y*scale, width: width*scale, height: height*scale };
      const result = placeRoomLabel(room, { width: 72, height: 22 }, occupied);
      if (!result) continue;
      assert.ok(result.x >= room.x && result.y >= room.y);
      assert.ok(result.x + result.width <= room.x + room.width);
      assert.ok(result.y + result.height <= room.y + room.height);
      assert.ok(occupied.every((other) => !overlaps(result, other)));
      occupied.push(result);
    }
  }
});

test('legend numbering remains stable regardless of selection or API ordering', () => {
  const rooms = [{id:'b',x:100,y:0},{id:'c',x:0,y:100},{id:'a',x:0,y:0}];
  const original = structuredClone(rooms);
  assert.deepEqual(orderedRooms(rooms).map((r)=>r.id), ['a','b','c']);
  assert.deepEqual(rooms, original);
  assert.deepEqual(orderedRooms([...rooms].reverse()), orderedRooms(rooms));
});

test('storage numbers follow their positions and stay identical in the map and list', () => {
  const pins = [{id:'lower',rel_x:0.9,rel_y:0.9},{id:'right',rel_x:0.9,rel_y:0.1},{id:'left',rel_x:0.1,rel_y:0.1}];
  assert.deepEqual(orderedPins(pins).map((p)=>p.id), ['left','right','lower']);
  assert.deepEqual(orderedPins([...pins].reverse()), orderedPins(pins));
});
