import assert from 'node:assert/strict';
import { test } from 'node:test';
import { observeAsyncState } from '../../src/lib/observeAsyncState.ts';
const flush = () => new Promise((resolve) => setImmediate(resolve));

function fixture() {
  const reads = [], values = [];
  let event, refresh, removed = 0;
  const stop = observeAsyncState({
    read: () => new Promise((resolve, reject) => reads.push({ resolve, reject })),
    subscribe: (fn) => { event = fn; return () => removed++; },
    subscribeRefresh: (fn) => { refresh = fn; return () => removed++; },
    publish: (value) => values.push(value), fallback: true,
  });
  return { reads, values, event, refresh, stop, removed: () => removed };
}

test('a network event wins over an older initial read or failure', async () => {
  for (const fails of [false, true]) {
    const f = fixture();
    f.event(false);
    if (fails) f.reads[0].reject(new Error('unavailable')); else f.reads[0].resolve(true);
    await flush();
    assert.deepEqual(f.values, [false]);
    f.stop();
  }
});

test('newer refresh wins and unsubscription suppresses pending reads', async () => {
  const f = fixture(); f.refresh();
  f.reads[1].resolve(false); await flush();
  f.reads[0].resolve(true); await flush();
  assert.deepEqual(f.values, [false]);
  f.refresh(); f.stop(); f.reads[2].resolve(true); f.event(true); await flush();
  assert.deepEqual(f.values, [false]);
  assert.equal(f.removed(), 2);
});

test('partially installed subscriptions are removed when a native API is missing', () => {
  let removed = 0;
  const values = [];
  const stop = observeAsyncState({
    read: async () => false,
    subscribe: () => () => removed++,
    subscribeRefresh: () => { throw new Error('native module unavailable'); },
    publish: (value) => values.push(value), fallback: true,
  });
  assert.equal(removed, 1);
  assert.deepEqual(values, [true]);
  stop(); assert.equal(removed, 1);
});

test('read failures retain the online fallback so the write queue can retry', async () => {
  const f = fixture(); f.reads[0].reject(new Error('network lookup failed')); await flush();
  assert.deepEqual(f.values, [true]); f.stop();
});
