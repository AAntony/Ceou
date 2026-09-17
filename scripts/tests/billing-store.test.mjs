import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { canInitializeStore } from '../../src/features/billing/storePolicy.ts';

const require = createRequire(import.meta.url);
const { resolveBillingConfig } = require('../../billing.config.js');
const profiles = JSON.parse(readFileSync(new URL('../../eas.json', import.meta.url), 'utf8')).build;

test('Test Store never initializes in a release bundle, even with test mode enabled', () => {
  assert.equal(canInitializeStore('android', 'test_example', true, false), false);
  assert.equal(canInitializeStore('android', 'test_example', false, true), false);
  assert.equal(canInitializeStore('android', 'test_example', true, true), true);
});

test('native billing rejects missing, private and unsupported-platform keys', () => {
  for (const key of ['', 'sk_private', 'appl_example', 'amazon_example']) {
    assert.equal(canInitializeStore('android', key, true, true), false);
  }
  for (const platform of ['web', 'ios']) {
    assert.equal(canInitializeStore(platform, 'goog_example', false, false), false);
  }
  assert.equal(canInitializeStore('android', 'goog_example', false, false), true);
  assert.equal(canInitializeStore('android', 'goog_example', true, false), true);
});

test('EAS preview contains no Test Store key; development explicitly opts in', () => {
  const config = profile => resolveBillingConfig({ ...profiles[profile].env, EAS_BUILD_PROFILE: profile });
  assert.equal(config('preview').revenueCatKey, '');
  assert.match(config('development').revenueCatKey, /^test_/);
  assert.equal(resolveBillingConfig({}).revenueCatKey, '');
  assert.throws(() => config('production'), /Configure EXPO_PUBLIC_REVENUECAT_ANDROID_KEY/);
});

test('invalid release configuration fails before a build or OTA is published', () => {
  for (const profile of ['preview', 'production']) {
    assert.throws(() => resolveBillingConfig({
      EAS_BUILD_PROFILE: profile, EXPO_PUBLIC_REVENUECAT_TEST_STORE: 'true',
    }), /requires a development build/);
  }
  assert.throws(() => resolveBillingConfig({
    EXPO_PUBLIC_BILLING_MODE: 'live', EXPO_PUBLIC_REVENUECAT_TEST_STORE: 'true',
  }), /requires a development build/);
  for (const key of ['test_example', 'sk_private']) {
    assert.throws(() => resolveBillingConfig({ EXPO_PUBLIC_REVENUECAT_ANDROID_KEY: key }), /public Google Play/);
  }
  assert.deepEqual(resolveBillingConfig({
    ...profiles.production.env, EXPO_PUBLIC_REVENUECAT_ANDROID_KEY: 'goog_example',
  }), { mode: 'live', revenueCatKey: 'goog_example' });
});
