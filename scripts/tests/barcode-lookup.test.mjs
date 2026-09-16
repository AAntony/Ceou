import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lookupBarcode } from '../../src/lib/barcode/lookupBarcode.ts';

test('barcode lookup validates external fields and only accepts web image URLs', async (t) => {
  const payloads = [
    { code: 'OK', items: [{ title: 'Livre', images: ['https://example.com/book.jpg'] }] },
    { code: 'OK', items: [{ title: 42, images: ['file:///private'] }] },
    null, { code: 'OK', items: 'unexpected' }, { code: 'OK', items: [] },
  ];
  t.mock.method(globalThis, 'fetch', async () => Response.json(payloads.shift()));
  assert.deepEqual(await lookupBarcode('123'), { title: 'Livre', imageUrl: 'https://example.com/book.jpg' });
  assert.deepEqual(await lookupBarcode('123'), { title: null, imageUrl: null });
  for (let i = 0; i < 3; i++) assert.equal(await lookupBarcode('123'), null);
});
test('closing the form cancels the request; a stuck service falls back after ten seconds', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const fetch = t.mock.method(globalThis, 'fetch', (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  }));
  const controller = new AbortController();
  const request = lookupBarcode('123', controller.signal); controller.abort();
  assert.equal(await request, null);
  const stalled = lookupBarcode('123'); t.mock.timers.tick(10_000);
  assert.equal(await stalled, null);
  const calls = fetch.mock.callCount();
  assert.equal(await lookupBarcode('123', controller.signal), null);
  assert.equal(fetch.mock.callCount(), calls);
});
test('server failures and malformed JSON preserve manual entry fallback', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('down', { status: 503 }));
  assert.equal(await lookupBarcode('123'), null);
  t.mock.method(globalThis, 'fetch', async () => new Response('invalid JSON'));
  assert.equal(await lookupBarcode('123'), null);
});
