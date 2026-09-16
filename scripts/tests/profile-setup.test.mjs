import test from 'node:test';
import assert from 'node:assert/strict';
import { needsProfileSetup } from '../../src/features/profile/setupRules.ts';

const firstLogin = { signedIn: true, anonymous: false, profileLoaded: true, name: null, pathname: '/' };
test('a first login with a missing or blank name requires completion', () => {
  for (const name of [null, undefined, '', '   ']) assert.equal(needsProfileSetup({ ...firstLogin, name }), true);
});
test('existing profiles, guests and password recovery remain accessible', () => {
  for (const patch of [{ name: 'Agathe' }, { anonymous: true }, { signedIn: false }, { profileLoaded: false }, { pathname: '/reset-password' }]) {
    assert.equal(needsProfileSetup({ ...firstLogin, ...patch }), false);
  }
});
