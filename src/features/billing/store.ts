import type { StoreOffer } from './types';
export const storeSupported = false;
export async function offers(_userId: string): Promise<StoreOffer[]> { return []; }
export async function purchase(_userId: string, _offerId: string): Promise<void> { throw new Error('billing_native_required'); }
export async function restore(_userId: string): Promise<void> { throw new Error('billing_native_required'); }
export async function managementUrl(_userId: string): Promise<string | null> { return null; }
export async function disconnectStore(): Promise<void> {}
