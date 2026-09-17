export const adsSupported = false;
export async function showRewardAd(_user: string,_challenge: string): Promise<boolean> { throw new Error('billing_native_required'); }
export async function advertisingPrivacyRequired(): Promise<boolean> { return false; }
export async function advertisingPrivacy(): Promise<boolean> { throw new Error('billing_native_required'); }
