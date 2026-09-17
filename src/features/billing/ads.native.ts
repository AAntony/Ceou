import { Platform } from 'react-native';
import mobileAds, { AdsConsent, AdEventType, RewardedAd, RewardedAdEventType, TestIds } from 'react-native-google-mobile-ads';
import { billingTestMode, rewardedUnitId } from './config';
import { logClientError } from '../../lib/errorLogging';
import { adErrorCode, openAdvertisingPrivacy, privacyOptionsRequired, requireAdConsent } from './adConsent';
import type { AdStage } from './adConsent';
export const adsSupported = Platform.OS==='android';
let active = false;

export async function advertisingPrivacyRequired(): Promise<boolean> {
  try {
    return privacyOptionsRequired(await AdsConsent.requestInfoUpdate());
  } catch (error) {
    throw reportAdFailure(error, 'privacy');
  }
}
export async function advertisingPrivacy(): Promise<boolean> {
  try {
    return await openAdvertisingPrivacy(AdsConsent);
  } catch (error) {
    throw reportAdFailure(error, 'privacy');
  }
}
function reportAdFailure(error: unknown, stage: AdStage): Error {
  const code = adErrorCode(error, stage);
  void logClientError(error instanceof Error && error.cause ? error.cause : error, {
    source: 'billing.ads', stage, code, test: billingTestMode,
  });
  return new Error(code, { cause: error });
}
export async function showRewardAd(user: string, challenge: string): Promise<boolean> {
  if (!adsSupported || active) throw new Error('billing_ad_unavailable');
  active=true;
  let stage: AdStage = 'consent';
  try {
    await requireAdConsent(AdsConsent, error => {
      void logClientError(error, { source: 'billing.ads', stage: 'consent', recovered: true, test: billingTestMode });
    });
    stage = 'initialization';
    await mobileAds().initialize();
    stage = 'load';
    const ad = RewardedAd.createForAdRequest(billingTestMode ? TestIds.REWARDED : rewardedUnitId, {
      serverSideVerificationOptions:{userId:user,customData:challenge},
    });
    return await new Promise<boolean>((resolve,reject)=>{
      let earned=false,finished=false;
      const removers: (()=>void)[]=[];
      let timeout: ReturnType<typeof setTimeout>;
      const finish=(error?: unknown)=>{
        if(finished) return; finished=true; clearTimeout(timeout);removers.forEach(remove=>remove());
        if(error) reject(error); else resolve(earned);
      };
      timeout=setTimeout(()=>finish(new Error('billing_ad_unavailable')),30000);
      removers.push(ad.addAdEventListener(RewardedAdEventType.LOADED,()=>{
        clearTimeout(timeout); // Never remove listeners while a full-screen ad is still visible.
        stage = 'show';
        void ad.show().catch(finish);
      }));
      removers.push(ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD,()=>{earned=true;}));
      removers.push(ad.addAdEventListener(AdEventType.CLOSED,()=>finish()));
      removers.push(ad.addAdEventListener(AdEventType.ERROR,finish));
      try { ad.load(); } catch (error) { finish(error); }
    });
  } catch (error) {
    throw reportAdFailure(error, stage);
  } finally {active=false;}
}
