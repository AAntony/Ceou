import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { supabase } from '../../lib/supabase/client';
import { billingTestMode, revenueCatKey } from './config';
import type { StoreOffer } from './types';

export const storeSupported = Platform.OS === 'android' && !!revenueCatKey && (billingTestMode || revenueCatKey.startsWith('goog_'));
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(operation: () => Promise<T>): Promise<T> {
  const next = queue.then(operation,operation); queue=next.catch(()=>{}); return next;
}
async function identify(userId: string) {
  if (!storeSupported) throw new Error('billing_configuration_pending');
  const {data} = await supabase.auth.getSession();
  if (data.session?.user.id!==userId || data.session.user.is_anonymous) throw new Error('unauthorized');
  if (!(await Purchases.isConfigured())) {
    Purchases.setLogLevel(LOG_LEVEL.ERROR);
    Purchases.configure({apiKey:revenueCatKey,appUserID:userId});
  } else if (await Purchases.getAppUserID()!==userId) {
    await Purchases.logIn(userId);
  }
}
export function offers(userId: string): Promise<StoreOffer[]> {
  return serial(async()=>{
    await identify(userId);
    const offering = (await Purchases.getOfferings()).current;
    return (offering?.availablePackages || []).map(p=>({id:p.identifier,title:p.product.title,price:p.product.priceString,period:p.product.subscriptionPeriod}));
  });
}
export function purchase(userId: string, offerId: string): Promise<void> {
  return serial(async()=>{
    await identify(userId);
    const offer = (await Purchases.getOfferings()).current?.availablePackages.find(p=>p.identifier===offerId);
    if (!offer) throw new Error('billing_offer_unavailable');
    await Purchases.purchasePackage(offer);
  });
}
export function restore(userId: string): Promise<void> { return serial(async()=>{await identify(userId);await Purchases.restorePurchases();}); }
export function managementUrl(userId: string): Promise<string | null> { return serial(async()=>{await identify(userId);return (await Purchases.getCustomerInfo()).managementURL;}); }
export function disconnectStore(): Promise<void> {
  return serial(async()=>{if (await Purchases.isConfigured() && !(await Purchases.isAnonymous())) await Purchases.logOut();});
}
