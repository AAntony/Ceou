import Constants from 'expo-constants';
const config = Constants.expoConfig?.extra?.billing;
export const billingTestMode = config?.mode !== 'live';
export const revenueCatKey: string = config?.revenueCatKey || '';
export const rewardedUnitId = 'ca-app-pub-9364843473034868/9217315316';
