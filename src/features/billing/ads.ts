export const adsSupported = false;
export async function showRewardAd(_user: string,_challenge: string): Promise<boolean> { throw new Error('billing_native_required'); }
export async function advertisingPrivacy(): Promise<void> { throw new Error('billing_native_required'); }
