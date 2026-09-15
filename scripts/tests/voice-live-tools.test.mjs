import assert from 'node:assert/strict';
import { register } from 'node:module';
import { test } from 'node:test';

register('./ts-extensions.mjs', import.meta.url);
const { ToolSession, runTool, spokenPath } = await import('../../src/features/assistant/live/tools.ts');

// Un petit logement : deux pièces, un meuble homonyme dans chacune, une boîte.
const base = { photo_url: null, preset_key: null, habitation_id: 'home', habitation_name: 'Maison' };
const room = (id, name) => ({ ...base, kind: 'piece', id, name, piece_id: id, piece_name: name, parent_label: null });
const storage = (id, name, roomId, roomName) => ({ ...base, kind: 'emplacement', id, name, piece_id: roomId, piece_name: roomName, parent_label: null });
const box = (id, name, roomId, roomName, parent) => ({ ...base, kind: 'conteneur', id, name, piece_id: roomId, piece_name: roomName, parent_label: parent });
const item = (id, name, roomId, roomName, parent) => ({ ...base, kind: 'objet', id, name, piece_id: roomId, piece_name: roomName, parent_label: parent });

const INDEX = [
  room('garage', 'Garage'),
  room('entree', 'Entrée'),
  storage('etabli', 'Établi', 'garage', 'Garage'),
  storage('tiroir-entree', 'Tiroir', 'entree', 'Entrée'),
  storage('tiroir-garage', 'Tiroir', 'garage', 'Garage'),
  box('outils', 'Boîte à outils', 'garage', 'Garage', 'Établi'),
  item('perceuse', 'Perceuse', 'garage', 'Garage', 'Boîte à outils'),
  item('marteau', 'Marteau', 'garage', 'Garage', 'Établi'),
  item('cles-voiture', 'Clés de voiture', 'entree', 'Entrée', 'Tiroir'),
  item('cles-cave', 'Clés de la cave', 'entree', 'Entrée', 'Tiroir'),
];

const LOANS = [
  { id: 'l1', objetId: 'marteau', objetName: 'Marteau', objetPhotoUrl: null, direction: 'pret', counterpartLabel: 'Marc', counterpartUserId: null, counterpartAvatarUrl: null, startedAt: '2026-09-01', dueAt: '2026-09-10T00:00:00Z', returnedAt: null, note: null },
];

function effects(log = []) {
  return {
    log,
    canModify: async () => true,
    move: async (id, destination) => log.push(['move', id, destination.id]),
    undo: async (id) => log.push(['undo', id]),
    isPermissionError: () => false,
  };
}

const call = (session, name, args, fx = effects()) => runTool(name, args, { session, index: INDEX, loans: LOANS, effects: fx });

test('find_objects answers with session refs and spoken paths, never database ids', async () => {
  const session = new ToolSession();
  const { response, event } = await call(session, 'find_objects', { query: 'marteau' });
  assert.equal(response.status, 'found');
  assert.equal(response.items[0].name, 'Marteau');
  assert.equal(response.items[0].location, 'Maison, Garage, Établi');
  assert.equal(response.items[0].loan, 'lent to Marc');
  assert.match(response.items[0].ref, /^r\d+$/);
  assert.ok(!JSON.stringify(response).includes('marteau"'), 'no raw id in the response');
  assert.equal(event.type, 'found');
});

test('the same thing keeps the same ref for the whole conversation', async () => {
  const session = new ToolSession();
  const first = await call(session, 'find_objects', { query: 'perceuse' });
  const again = await call(session, 'find_objects', { query: 'perceuse' });
  assert.equal(first.response.items[0].ref, again.response.items[0].ref);
});

test('find_objects says not_found instead of guessing', async () => {
  const { response } = await call(new ToolSession(), 'find_objects', { query: 'trampoline' });
  assert.equal(response.status, 'not_found');
});

test('list_place lists a box contents, and asks when two places share a name', async () => {
  const session = new ToolSession();
  const inBox = await call(session, 'list_place', { place: 'boîte à outils' });
  assert.equal(inBox.response.status, 'found');
  assert.deepEqual(inBox.response.items, ['Perceuse']);

  const drawers = await call(session, 'list_place', { place: 'tiroir' });
  assert.equal(drawers.response.status, 'ambiguous');
  assert.equal(drawers.response.places.length, 2);

  const picked = drawers.response.places.find((place) => place.location.includes('Entrée'));
  const chosen = await call(session, 'list_place', { place: 'tiroir', place_ref: picked.ref });
  assert.equal(chosen.response.total_items, 2);
});

test('move_object writes at once on a clear, unique match', async () => {
  const fx = effects();
  const { response, event } = await call(new ToolSession(), 'move_object', { object: 'perceuse', destination: 'établi' }, fx);
  assert.equal(response.status, 'moved');
  assert.deepEqual(fx.log, [['move', 'perceuse', 'etabli']]);
  assert.equal(event.type, 'moved');
});

test('move_object never writes on an ambiguous destination, then accepts the chosen ref', async () => {
  const session = new ToolSession();
  const fx = effects();
  const first = await call(session, 'move_object', { object: 'clés de voiture', destination: 'tiroir' }, fx);
  assert.equal(first.response.status, 'ambiguous');
  assert.equal(fx.log.length, 0);

  const garage = first.response.destinations.find((destination) => destination.location.includes('Garage'));
  const second = await call(session, 'move_object', { object: 'clés de voiture', destination: 'tiroir', destination_ref: garage.ref }, fx);
  assert.equal(second.response.status, 'moved');
  assert.deepEqual(fx.log, [['move', 'cles-voiture', 'tiroir-garage']]);
});

test('move_object asks which object when several match', async () => {
  const fx = effects();
  const { response } = await call(new ToolSession(), 'move_object', { object: 'clés', destination: 'établi' }, fx);
  assert.equal(response.status, 'ambiguous');
  assert.equal(response.objects.length, 2);
  assert.equal(fx.log.length, 0);
});

test('move_object refuses without the right to modify, and reports it', async () => {
  const fx = { ...effects(), canModify: async () => false };
  const { response } = await call(new ToolSession(), 'move_object', { object: 'perceuse', destination: 'établi' }, fx);
  assert.equal(response.status, 'forbidden');
});

test('move_object does not write when the object is already there', async () => {
  const fx = effects();
  const { response } = await call(new ToolSession(), 'move_object', { object: 'marteau', destination: 'établi' }, fx);
  assert.equal(response.status, 'already_there');
  assert.equal(fx.log.length, 0);
});

test('undo_last_move puts back the last move of this conversation only', async () => {
  const session = new ToolSession();
  const fx = effects();
  assert.equal((await call(session, 'undo_last_move', {}, fx)).response.status, 'nothing_to_undo');
  await call(session, 'move_object', { object: 'perceuse', destination: 'établi' }, fx);
  const undone = await call(session, 'undo_last_move', {}, fx);
  assert.equal(undone.response.status, 'undone');
  assert.equal(undone.response.back_to, spokenPath(INDEX.find((entry) => entry.id === 'perceuse')));
  assert.deepEqual(fx.log.at(-1), ['undo', 'perceuse']);
});

test('list_loans flags what is overdue; unknown tools answer instead of throwing', async () => {
  const session = new ToolSession();
  const loans = await runTool('list_loans', {}, { session, index: INDEX, loans: LOANS, effects: effects() });
  assert.equal(loans.response.loans[0].overdue, true);
  const unknown = await call(session, 'delete_everything', {});
  assert.equal(unknown.response.status, 'invalid');
});
