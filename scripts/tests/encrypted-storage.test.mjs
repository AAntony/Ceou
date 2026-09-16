import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { register } from 'node:module';
import { test } from 'node:test';
import aes from 'aes-js';
register('./ts-extensions.mjs', import.meta.url);
const { createEncryptedStorage } = await import('../../src/lib/supabase/encryptedStorage.ts');
const { createSerialTasks } = await import('../../src/lib/serialTasks.ts');
function memory() {
  const data = new Map();
  return { data, getItem: async (key) => data.get(key) ?? null, setItem: async (key, value) => { data.set(key, value); }, removeItem: async (key) => { data.delete(key); } };
}

test('sessions and PKCE strings round-trip, with fresh ciphertext on every write', async () => {
  const payloads = memory(), keys = memory(), storage = createEncryptedStorage(payloads, keys, randomBytes);
  const value = JSON.stringify({ token: 'test-only', displayName: 'Céoù 🏡', extra: 'a'.repeat(5000) });
  await storage.setItem('session', value);
  const first = payloads.data.get('session');
  await storage.setItem('session', value);
  assert.notEqual(payloads.data.get('session'), first);
  assert.ok(!payloads.data.get('session').includes('test-only'));
  assert.equal(await storage.getItem('session'), value);
  await storage.setItem('pkce', 'plain-verifier');
  assert.equal(await storage.getItem('pkce'), 'plain-verifier');
});

test('legacy sessions remain readable and upgrade on the next write', async () => {
  const payloads = memory(), keys = memory(), key = randomBytes(32);
  const cipher = new aes.ModeOfOperation.ctr(key, new aes.Counter(1));
  await keys.setItem('session-key', aes.utils.hex.fromBytes(key));
  await payloads.setItem('session', aes.utils.hex.fromBytes(cipher.encrypt(aes.utils.utf8.toBytes('existing-session'))));
  const storage = createEncryptedStorage(payloads, keys, randomBytes);
  assert.equal(await storage.getItem('session'), 'existing-session');
  await storage.setItem('session', 'refreshed-session');
  assert.ok(payloads.data.get('session').startsWith('v2:'));
  assert.equal(await storage.getItem('session'), 'refreshed-session');
});

test('missing keys and malformed records fail closed without generating keys on read', async () => {
  const payloads = memory(), keys = memory(), storage = createEncryptedStorage(payloads, keys, randomBytes);
  await payloads.setItem('session', '1234');
  assert.equal(await storage.getItem('session'), null);
  assert.equal(keys.data.size, 0);
  await keys.setItem('session-key', 'ab'.repeat(32));
  for (const value of ['v2:abc:aa', 'v3:abc:aa', 'not-hex', 'v2:' + 'aa'.repeat(16) + ':z1']) {
    await payloads.setItem('session', value);
    assert.equal(await storage.getItem('session'), null);
  }
});

test('overlapping saves and sign-out cannot leave a payload behind its deleted key', async () => {
  const payloads = memory(), keys = memory(), storage = createEncryptedStorage(payloads, keys, randomBytes);
  await Promise.all([storage.setItem('session', 'first'), storage.setItem('session', 'last')]);
  assert.equal(await storage.getItem('session'), 'last');
  await Promise.all([storage.setItem('session', 'refresh'), storage.removeItem('session')]);
  assert.equal(await storage.getItem('session'), null);
  assert.equal(keys.data.size, 0);
  assert.equal(payloads.data.size, 0);
});

test('serialized work recovers from failure and independent keys remain independent', async () => {
  const run = createSerialTasks(), events = [];
  let release;
  const blocked = run('a', () => new Promise((resolve) => { release = resolve; }));
  await run('b', async () => events.push('b'));
  assert.deepEqual(events, ['b']);
  release(); await blocked;
  await assert.rejects(run('a', async () => { throw new Error('offline'); }));
  assert.equal(await run('a', async () => 'recovered'), 'recovered');
});
