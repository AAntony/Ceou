import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createScannerSession } from '../../src/components/scannerSession.ts';

test('a burst of camera events delivers one result, even with reentrant callbacks', () => {
  const session = createScannerSession();
  const results = [];
  const accept = value => { results.push(value); session.accept('second', accept); };
  assert.equal(session.accept('first', accept), true);
  assert.equal(session.accept('first', accept), false);
  assert.deepEqual(results, ['first']);
});

test('closing ignores queued detections; reopening accepts the same code again', () => {
  const oldSession = createScannerSession();
  oldSession.cancel();
  const results = [];
  assert.equal(oldSession.accept('qr', value => results.push(value)), false);
  const reopened = createScannerSession();
  assert.equal(reopened.accept('qr', value => results.push(value)), true);
  assert.deepEqual(results, ['qr']);
});

test('empty detections do not consume a session and a failed handler is not replayed', () => {
  const session = createScannerSession();
  assert.equal(session.accept('  ', () => assert.fail('empty result')), false);
  assert.throws(() => session.accept('qr', () => { throw new Error('handler failed'); }), /handler failed/);
  assert.equal(session.accept('qr', () => assert.fail('duplicate')), false);
});
