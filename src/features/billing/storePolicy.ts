export function canInitializeStore(platform: string, apiKey: string, testMode: boolean, development: boolean): boolean {
  if (platform !== 'android') return false;
  // RevenueCat terminates release apps configured with a Test Store key.
  // Keep this runtime guard: an OTA can also supply an incompatible key.
  if (apiKey.startsWith('test_')) return testMode && development;
  return apiKey.startsWith('goog_');
}
