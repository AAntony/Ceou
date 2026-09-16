import assert from 'node:assert/strict';
import { test } from 'node:test';
import { locationChainFrom } from '../../src/features/inventory/locationChain.ts';

function fixture(containers = []) {
  const conteneurs = new Map(containers.map((row) => [row.id, { name: row.id, ...row }]));
  return {
    conteneur: (id) => conteneurs.get(id),
    emplacement: (id) => id === 'shelf' ? { id, name: 'Étagère', piece_id: 'room', preset_key: 'shelf' } : undefined,
    piece: (id) => id === 'room' ? { id, name: 'Garage', habitation_id: 'home', preset_key: 'garage', is_default: true } : undefined,
    habitation: (id) => id === 'home' ? { id, name: 'Maison' } : undefined,
  };
}

test('nested storage preserves the home-to-inner-box order and default-room metadata', () => {
  const chain = locationChainFrom({ emplacementId: null, conteneurId: 'inner' }, fixture([
    { id: 'inner', parent_conteneur_id: 'outer' }, { id: 'outer', parent_emplacement_id: 'shelf' },
  ]));
  assert.deepEqual(chain.map(({ id }) => id), ['home', 'room', 'shelf', 'outer', 'inner']);
  assert.equal(chain[1].is_default, true);
  assert.equal(chain[2].preset_key, 'shelf');
});

test('missing ancestors return the known path and cyclic containers terminate', () => {
  assert.deepEqual(locationChainFrom({ emplacementId: null, conteneurId: 'missing' }, fixture()), []);
  const cycle = fixture([{ id: 'a', parent_conteneur_id: 'b' }, { id: 'b', parent_conteneur_id: 'a' }]);
  assert.deepEqual(locationChainFrom({ emplacementId: null, conteneurId: 'a' }, cycle).map(({ id }) => id), ['b', 'a']);
  assert.deepEqual(locationChainFrom({ emplacementId: 'shelf', conteneurId: null }, fixture()).map(({ id }) => id), ['home', 'room', 'shelf']);
});
