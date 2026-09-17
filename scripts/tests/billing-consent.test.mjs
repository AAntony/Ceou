import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adErrorCode, requireAdConsent } from '../../src/features/billing/adConsent.ts';

function consent({ canRequestAds = false, refreshError, readError } = {}) {
  const calls = [];
  return {
    calls,
    async gatherConsent() { calls.push('refresh'); if (refreshError) throw refreshError; },
    async getConsentInfo() { calls.push('status'); if (readError) throw readError; return { canRequestAds }; },
  };
}

test('a consent refresh failure can use a choice that UMP still authorizes', async () => {
  const failure = new Error('Network error');
  const provider = consent({ canRequestAds: true, refreshError: failure });
  const recovered = [];
  await requireAdConsent(provider, error => recovered.push(error));
  assert.deepEqual(provider.calls, ['refresh', 'status']);
  assert.deepEqual(recovered, [failure]);
});

test('a missing AdMob message blocks ads with an actionable error and keeps its cause', async () => {
  const failure = new Error('Publisher misconfiguration: no valid consent messages found');
  const provider = consent({ refreshError: failure });
  await assert.rejects(requireAdConsent(provider), error => {
    assert.equal(error.message, 'billing_ads_configuration');
    assert.equal(error.cause, failure);
    return true;
  });
});

test('successful form dismissal does not authorize ads when UMP says no', async () => {
  await assert.rejects(requireAdConsent(consent()), /billing_consent_required/);
  await requireAdConsent(consent({ canRequestAds: true }));
});

test('network failure without a valid choice never falls back to displaying an ad', async () => {
  await assert.rejects(requireAdConsent(consent({ refreshError: new Error('Network error') })), /billing_ad_network/);
});

test('failure to read current permission blocks ads instead of assuming consent', async () => {
  const error = new Error('Native consent unavailable');
  await assert.rejects(requireAdConsent(consent({ canRequestAds: true, readError: error })), error);
});

test('native errors map to translated codes by stage without displaying raw SDK details', () => {
  assert.equal(adErrorCode({ code: 'googleMobileAds/consent-update-failed', message: 'Unexpected response' }, 'consent'), 'billing_consent_unavailable');
  assert.equal(adErrorCode({ code: 'googleMobileAds/network-error' }, 'load'), 'billing_ad_network');
  assert.equal(adErrorCode({ code: 'googleMobileAds/no-fill' }, 'load'), 'billing_ad_unavailable');
  assert.equal(adErrorCode(new Error('billing_ad_unavailable'), 'show'), 'billing_ad_unavailable');
  assert.equal(adErrorCode(null, 'initialization'), 'billing_ad_unavailable');
});
