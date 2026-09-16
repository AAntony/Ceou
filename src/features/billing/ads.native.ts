import { Platform } from 'react-native';
import mobileAds, { AdsConsent, AdEventType, RewardedAd, RewardedAdEventType, TestIds } from 'react-native-google-mobile-ads';
import { billingTestMode, rewardedUnitId } from './config';
export const adsSupported = Platform.OS==='android';
let active = false;

export async function advertisingPrivacy(): Promise<void> {
  await AdsConsent.requestInfoUpdate();
  await AdsConsent.showPrivacyOptionsForm();
}
export async function showRewardAd(user: string, challenge: string): Promise<boolean> {
  if (!adsSupported || active) throw new Error('billing_ad_unavailable');
  active=true;
  try {
    // UMP refreshes before each request; refusal is respected without blocking the app.
    await AdsConsent.gatherConsent();
    if (!(await AdsConsent.getConsentInfo()).canRequestAds) throw new Error('billing_consent_required');
    await mobileAds().initialize();
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
        void ad.show().catch(finish);
      }));
      removers.push(ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD,()=>{earned=true;}));
      removers.push(ad.addAdEventListener(AdEventType.CLOSED,()=>finish()));
      removers.push(ad.addAdEventListener(AdEventType.ERROR,finish));
      ad.load();
    });
  } finally {active=false;}
}
