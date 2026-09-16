// Local comparison only; no latency threshold in CI and no production data.
// node scripts/benchmark-search.mjs
import { performance } from 'node:perf_hooks';
import { prepareSearchIndex, searchPreparedIndex } from '../src/features/search/rank.ts';
import { rankResults as previousSearch } from './tests/fixtures/search-before-refactor.ts';

const entries = Array.from({ length: 10_000 }, (_, i) => ({
  id: String(i), kind: 'objet', name: `Boîte ${i % 300} ${i % 2 ? 'bleue' : 'rouge'}`,
  habitation_id: `home-${i % 3}`, habitation_name: 'Maison',
  piece_id: `room-${i % 10}`, piece_name: i % 2 ? 'Cuisine' : 'Salon', parent_label: 'Étagère',
}));
const queries = ['', 'boite', 'boite bleue', 'salon', 'zzzx'];
const started = performance.now();
const prepared = prepareSearchIndex(entries);
const prepareMs = performance.now() - started;
const measure = (search) => {
  for (const query of queries) search(query);
  const samples = [];
  for (let i = 0; i < 10; i++) {
    const start = performance.now();
    for (const query of queries) search(query);
    samples.push((performance.now() - start) / queries.length);
  }
  return samples.sort((a, b) => a - b)[Math.floor(samples.length / 2)];
};
const before = measure((query) => previousSearch(entries, query, null, null));
const after = measure((query) => searchPreparedIndex(prepared, query, null, null));
console.log(JSON.stringify({ items: entries.length, prepareMs: +prepareMs.toFixed(2), beforeMedianMs: +before.toFixed(2), afterMedianMs: +after.toFixed(2), ratio: +(before / after).toFixed(1) }, null, 2));
