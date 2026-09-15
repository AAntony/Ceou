import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCommandGuard } from '../../src/features/moving/commandGuard.ts';
import { movingError } from '../../src/features/moving/errors.ts';

test('rapid second commands are rejected, never queued or sent twice', async () => {
  const run = createCommandGuard();
  let finish;
  let calls = 0;
  const first = run(() => true, () => { calls++; return new Promise(resolve => { finish = resolve; }); });
  await assert.rejects(run(() => true, async () => { calls++; }), /moving_busy/);
  assert.equal(calls, 1);
  finish('saved');
  assert.equal(await first, 'saved');
  assert.equal(await run(() => true, async () => 'next'), 'next');
});

test('offline commands do not send and failed commands can be manually retried', async () => {
  const run = createCommandGuard();
  let calls = 0;
  await assert.rejects(run(() => false, async () => { calls++; }), /moving_offline/);
  assert.equal(calls, 0);
  await assert.rejects(run(() => true, async () => { calls++; throw new Error('connection lost'); }), /connection lost/);
  assert.equal(calls, 1);
  assert.equal(await run(() => true, async () => { calls++; return 'saved'; }), 'saved');
  assert.equal(calls, 2);
});

test('server conflicts, offline and uncertain results have distinct messages', () => {
  assert.equal(movingError(new Error('moving_offline')), 'moving.online');
  assert.equal(movingError(new Error('moving_busy')), 'moving.busy');
  assert.equal(movingError({ message: 'moving_object_missing' }), 'moving.conflict');
  assert.equal(movingError({ message: 'moving_forbidden' }), 'moving.forbidden');
  assert.equal(movingError(new TypeError('Network request failed')), 'moving.error');
});
