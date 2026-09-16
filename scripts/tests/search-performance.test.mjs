import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prepareSearchIndex, searchPreparedIndex } from '../../src/features/search/rank.ts';
import { rankResults as previousSearch } from './fixtures/search-before-refactor.ts';

export const inventory = Array.from({ length: 2000 }, (_, i) => ({
  id: String(i), kind: ['objet', 'piece', 'emplacement', 'conteneur'][i % 4],
  name: ['Clés', 'Boîte', 'Coussin bleu', 'Étui', 'Étagère', 'Tiroir'][i % 6] + ` ${i % 17}`,
  habitation_id: `home-${i % 3}`, habitation_name: ['Maison', 'Appart', 'Bureau'][i % 3],
  piece_id: `room-${i % 7}`, piece_name: ['Cuisine', 'Salon', 'Chambre'][i % 3],
  parent_label: i % 5 ? 'Grand placard' : null,
}));

test('prepared search retains the previous ranking across queries and intersecting filters', () => {
  const before = structuredClone(inventory);
  const prepared = prepareSearchIndex(inventory);
  for (const query of ['', '   ', 'cles', 'ÉTUI 2', 'un coussin bleu', 'boite cuisine', 'dans', 'zzzx', 'grand placard', 'salon']) {
    for (const home of [null, 'home-1', 'missing']) {
      for (const room of [null, 'room-2', 'missing']) {
        assert.deepEqual(searchPreparedIndex(prepared, query, home, room), previousSearch(inventory, query, home, room));
      }
    }
  }
  assert.deepEqual(inventory, before);
});

test('rebuilding after edits changes the results without mutating an existing index', () => {
  const prepared = prepareSearchIndex(inventory);
  const changed = inventory.map((entry, i) => i === 0 ? { ...entry, name: 'Parapluie' } : entry);
  assert.equal(searchPreparedIndex(prepared, 'parapluie', null, null).length, 0);
  assert.equal(searchPreparedIndex(prepareSearchIndex(changed), 'parapluie', null, null).length, 1);
});
