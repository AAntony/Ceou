import assert from 'node:assert/strict';
import { test } from 'node:test';
import { observeSession } from '../../src/features/auth/sessionLifecycle.ts';
const flush = () => new Promise((resolve) => setImmediate(resolve));
function fixture() {
  let receive, resolve, reject, cleared = 0, ready = 0, removed = 0;
  const sessions = [];
  const stop = observeSession({
    read: () => new Promise((yes, no) => { resolve = yes; reject = no; }),
    subscribe: (fn) => { receive = fn; return () => removed++; },
    publish: (session) => sessions.push(session), ready: () => ready++, signedOut: () => cleared++,
  });
  return { receive, resolve, reject, stop, sessions, cleared: () => cleared, ready: () => ready, removed: () => removed };
}

test('a late initial read cannot restore a signed-out account or replace a new one', async () => {
  for (const event of ['SIGNED_OUT', 'SIGNED_IN']) {
    const f = fixture();
    f.receive(event, event === 'SIGNED_OUT' ? null : 'new'); f.resolve('old'); await flush();
    assert.deepEqual(f.sessions, [event === 'SIGNED_OUT' ? null : 'new']); f.stop();
  }
});
test('offline token failures keep the last session and never clear the cache', async () => {
  const f = fixture(); f.resolve('cached'); await flush(); f.receive('TOKEN_REFRESHED', null);
  assert.deepEqual(f.sessions, ['cached']); assert.equal(f.cleared(), 0); f.stop();
});
test('failed reads release startup and unmount ignores late results', async () => {
  const failed = fixture(); failed.reject(new Error('storage unavailable')); await flush();
  assert.equal(failed.ready(), 1); failed.stop();
  const stopped = fixture(); stopped.stop(); stopped.resolve('late'); stopped.receive('SIGNED_OUT', null); await flush();
  assert.equal(stopped.ready(), 0); assert.equal(stopped.cleared(), 0); assert.equal(stopped.removed(), 1);
  assert.deepEqual(stopped.sessions, []);
});
