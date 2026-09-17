const TEST_STORE_KEY = 'test_kdAWkKfnPoHDUbxFHDPVuopebrZ';

function resolveBillingConfig(env) {
  const mode = env.EXPO_PUBLIC_BILLING_MODE === 'live' ? 'live' : 'test';
  const useTestStore = env.EXPO_PUBLIC_REVENUECAT_TEST_STORE === 'true';
  const releaseBuild = env.EAS_BUILD_PROFILE === 'preview' || env.EAS_BUILD_PROFILE === 'production';
  if (useTestStore && (mode === 'live' || releaseBuild)) {
    throw new Error('RevenueCat Test Store requires a development build. Use the Google Play SDK key for preview and production.');
  }
  const androidKey = (env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || '').trim();
  if (androidKey && !androidKey.startsWith('goog_')) {
    throw new Error('EXPO_PUBLIC_REVENUECAT_ANDROID_KEY must be a public Google Play SDK key (goog_).');
  }
  if (mode === 'live' && !androidKey) {
    throw new Error('Configure EXPO_PUBLIC_REVENUECAT_ANDROID_KEY before building or updating live billing.');
  }
  return { mode, revenueCatKey: useTestStore ? TEST_STORE_KEY : androidKey };
}

module.exports = { resolveBillingConfig };
