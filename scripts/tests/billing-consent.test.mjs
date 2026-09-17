import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adErrorCode, openAdvertisingPrivacy, privacyOptionsRequired, requireAdConsent } from '../../src/features/billing/adConsent.ts';

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

function privacyConsent({ status = 'OBTAINED', requirement = 'REQUIRED', refreshError, formError } = {}) {
  const calls = [];
  return {
    calls,
    info: { status, privacyOptionsRequirementStatus: requirement },
    async requestInfoUpdate() {
      calls.push('refresh');
      if (refreshError) throw refreshError;
      return this.info;
    },
    async loadAndShowConsentFormIfRequired() {
      calls.push('initial-form');
      if (formError) throw formError;
    },
    async showPrivacyOptionsForm() {
      calls.push('privacy-form');
      if (formError) throw formError;
    },
  };
}

test('privacy choices stay hidden when UMP says no form is required, including on tap', async () => {
  const provider = privacyConsent({ status: 'NOT_REQUIRED', requirement: 'NOT_REQUIRED' });
  assert.equal(privacyOptionsRequired(provider.info), false);
  assert.equal(await openAdvertisingPrivacy(provider), false);
  assert.deepEqual(provider.calls, ['refresh']);
});

test('a previous consent response, whether accepted or refused, can be edited', async () => {
  const provider = privacyConsent(); // OBTAINED means a response, not acceptance.
  assert.equal(privacyOptionsRequired(provider.info), true);
  assert.equal(await openAdvertisingPrivacy(provider), true);
  assert.deepEqual(provider.calls, ['refresh', 'privacy-form']);
});

test('the initial consent form is shown once if a first response is still required', async () => {
  const provider = privacyConsent({ status: 'REQUIRED' });
  assert.equal(await openAdvertisingPrivacy(provider), true);
  assert.deepEqual(provider.calls, ['refresh', 'initial-form']);
});

test('a changed requirement is rechecked before opening privacy choices', async () => {
  const provider = privacyConsent();
  assert.equal(privacyOptionsRequired(provider.info), true);
  provider.info.privacyOptionsRequirementStatus = 'NOT_REQUIRED';
  assert.equal(await openAdvertisingPrivacy(provider), false);
  assert.deepEqual(provider.calls, ['refresh']);
});

test('unknown privacy requirements remain retryable errors instead of silently hiding choices', async () => {
  for (const requirement of ['UNKNOWN', undefined, '']) {
    const provider = privacyConsent();
    provider.info.privacyOptionsRequirementStatus = requirement;
    assert.throws(() => privacyOptionsRequired(provider.info), /billing_consent_unavailable/);
    await assert.rejects(openAdvertisingPrivacy(provider), /billing_consent_unavailable/);
    assert.deepEqual(provider.calls, ['refresh']);
  }
});

test('a privacy refresh failure does not try to open a form or claim it is unnecessary', async () => {
  const failure = new Error('Network error');
  const provider = privacyConsent({ refreshError: failure });
  await assert.rejects(openAdvertisingPrivacy(provider), failure);
  assert.deepEqual(provider.calls, ['refresh']);
});

test('real failures to present either form are still reported', async () => {
  for (const status of ['REQUIRED', 'OBTAINED']) {
    const failure = new Error('Privacy options form is still being preloaded');
    await assert.rejects(openAdvertisingPrivacy(privacyConsent({ status, formError: failure })), failure);
  }
});
