import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Stack, router } from 'expo-router';
import { ActivityIndicator, Linking, Platform, ScrollView, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { showMessage } from '../../lib/dialog';
import { useSession } from '../auth/SessionProvider';
import { billingRequest } from './api';
import { adsSupported, advertisingPrivacy, advertisingPrivacyRequired, showRewardAd } from './ads';
import { billingTestMode, revenueCatKey } from './config';
import { useBilling } from './useBilling';
import * as store from './store';
import { resetDate } from './format';

function Meter({label,used,limit}: {label: string;used: number;limit: number}) {
  const {i18n}=useTranslation();
  const value=`${used.toLocaleString(i18n.language)} / ${limit.toLocaleString(i18n.language)}`;
  return <View className="mb-4" accessible accessibilityLabel={`${label} : ${value}`}>
    <View className="mb-2 flex-row justify-between gap-2"><Text className="flex-1 text-body text-ink">{label}</Text><Text className="text-body font-semibold text-ink">{value}</Text></View>
    <View className="h-1.5 overflow-hidden rounded-full bg-ink/10"><View className="h-full rounded-full bg-coral" style={{width:`${Math.min(100,used/Math.max(1,limit)*100)}%`}} /></View>
  </View>;
}
export function BillingScreen() {
  const {t,i18n} = useTranslation();
  const {session} = useSession();
  const userId=session?.user.id;
  const billing=useBilling();
  const [busy,setBusy]=useState(false);
  const running=useRef(false);
  const alive=useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  const configuration=useQuery({queryKey:['billing-configuration',userId],queryFn:()=>billingRequest<{ready:boolean}>('billing-sync',{action:'status'}),enabled:!!userId && store.storeSupported,retry:false,staleTime:60000});
  const ready=configuration.data?.ready===true;
  const offers=useQuery({queryKey:['billing-offers',userId],queryFn:()=>store.offers(userId!),enabled:!!userId && store.storeSupported && ready, retry:false,staleTime:60000});
  const privacy = useQuery({
    queryKey: ['advertising-privacy', userId],
    queryFn: advertisingPrivacyRequired,
    enabled: !!userId && adsSupported,
    meta: { persist: false },
    retry: false,
    // A full-screen ad can change app focus; refresh explicitly after it closes.
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const run=async(action:()=>Promise<void>)=>{
    if(running.current) return;
    running.current=true;setBusy(true);
    try {await action();}
    catch(error) {
      if(!(error as {userCancelled?: boolean})?.userCancelled) {
        const code=(error as Error)?.message;
        showMessage(t(i18n.exists(`billing.${code}`)?`billing.${code}`:'billing.error'));
      }
    } finally {running.current=false;if(alive.current) setBusy(false);}
  };
  const sync=async()=>{await billingRequest('billing-sync');await billing.refetch();};
  const refreshPrivacy = async () => { if (adsSupported) await privacy.refetch(); };
  const editPrivacy = async () => {
    try {
      const shown = await advertisingPrivacy();
      if (!shown) showMessage(t('billing.privacy_not_required'));
    } finally {
      await refreshPrivacy();
    }
  };
  const refresh=async()=>{await billing.refetch();await refreshPrivacy();if(store.storeSupported) {const result=await configuration.refetch();if(result.data?.ready) {await sync();await offers.refetch();}}};
  const watch=async()=>{
    const {id}=await billingRequest<{id:string}>('billing-ad',{action:'prepare',test:billingTestMode});
    let earned=false;
    try {
      earned=await showRewardAd(userId!,id);
      if(!earned) {showMessage(t('billing.ad_skipped'));return;}
      if(billingTestMode) await billingRequest('billing-ad',{action:'test_complete',id});
      let credited=false;
      for(let attempt=0;attempt<6;attempt++) {
        const result=await billingRequest<{credited:boolean}>('billing-ad',{action:'status',id});
        if(result.credited) {credited=true;break;}
        await new Promise(resolve=>setTimeout(resolve,1500));
      }
      await billing.refetch();showMessage(t(credited?'billing.ad_done':'billing.ad_pending'));
    } finally {
      if(!earned) await billingRequest('billing-ad',{action:'cancel',id}).catch(()=>{});
      await billing.refetch();
      await refreshPrivacy();
    }
  };
  const data=billing.data;
  const caps=data?.plans[data.plan];
  const pendingStoreMessage = Platform.OS === 'web' ? 'billing.web'
    : billingTestMode && !store.storeSupported ? 'billing.test_store_pending' : 'billing.store_pending';
  return <>
    <Stack.Screen options={{title:t('billing.title')}} />
    <ScrollView className="flex-1 bg-sand" contentContainerStyle={{padding:20,paddingBottom:40,width:'100%',maxWidth:760,alignSelf:'center'}}>
      <View className="mb-5"><Text className="text-title font-bold text-ink">{t(data?.plan==='plus'?'billing.plus':'billing.free')}</Text><Text className="mt-2 text-body text-ink-soft">{t('billing.intro')}</Text></View>
      {billingTestMode ? <Text className="mb-3 text-caption font-semibold text-coral-dark">{t('billing.test')}</Text>:null}
      {billing.isLoading ? <ActivityIndicator />:null}
      {billing.isError ? <View className="mb-4 gap-3"><Text className="text-body text-ink">{t('billing.loading_error')}</Text><Button label={t('billing.refresh')} onPress={()=>void billing.refetch()} /></View>:null}
      {data && caps ? <>
        {!data.enforced ? <Text className="mb-4 rounded-xl bg-coral-light p-3 text-caption text-ink">{t('billing.observation')}</Text>:null}
        <View className="mb-4 rounded-2xl border border-ink/10 bg-surface p-4">
          <Text className="mb-4 text-body font-bold text-ink">{t('billing.inventory')}</Text>
          <Meter label={t('billing.homes')} used={data.inventory.homes} limit={caps.homes}/><Meter label={t('billing.objects')} used={data.inventory.objects} limit={caps.objects}/>
          <Text className="text-caption text-ink-soft">{t('billing.shared')}</Text>
        </View>
        <View className="mb-4 rounded-2xl border border-ink/10 bg-surface p-4">
          <Text className="mb-4 text-body font-bold text-ink">{t('billing.monthly')}</Text>
          <Meter label={t('billing.photos')} used={data.photos_used} limit={caps.photos}/><Meter label={t('billing.voice')} used={Math.round(data.voice_seconds_used/6)/10} limit={caps.voice_seconds/60}/>
          <Text className="text-caption text-ink-soft">{t('billing.renewal',{date:resetDate(data.resets_at,i18n.language)})}</Text>
        </View>
        <View className="mb-4 gap-3 rounded-2xl border border-ink/10 bg-surface p-4">
          <View className="flex-row items-center gap-2"><Icon name="star" size={22}/><Text className="flex-1 text-body font-bold text-ink">{t('billing.compare')}</Text></View>
          {(['free','plus'] as const).map(plan=><View key={plan} className={`rounded-xl p-3 ${plan==='plus'?'bg-coral-light':'bg-sand'}`}>
            <Text className="mb-2 text-body font-semibold text-ink">{t(`billing.${plan}`)}{data.plan===plan?` · ${t('billing.current')}`:''}</Text>
            <Text className="text-caption leading-6 text-ink">{t('billing.limits',{...data.plans[plan],minutes:data.plans[plan].voice_seconds/60})}</Text>
          </View>)}
          {(offers.data || []).map(offer=><Button key={offer.id} disabled={busy || !ready} label={t('billing.choose',{price:offer.price,period:offer.period==='P1M'?t('billing.month'):offer.period==='P1Y'?t('billing.year'):''})}
            onPress={()=>void run(async()=>{await sync();await store.purchase(userId!,offer.id);await sync();showMessage(t('billing.synced'));})} />)}
          {!offers.data?.length ? <Text className="text-caption text-ink-soft">{t(pendingStoreMessage)}</Text>:null}
          {billingTestMode && revenueCatKey.startsWith('goog_') && offers.data?.length ? <Text className="text-caption text-ink-soft">{t('billing.play_test_notice')}</Text>:null}
          <Text className="text-caption text-ink-soft">{t('billing.preserved')}</Text>
          {offers.data?.length ? <Text className="text-caption text-ink-soft">{t('billing.renew_terms')}</Text>:null}
          {store.storeSupported && ready ? <>
            <Button variant="ghost" disabled={busy} label={t('billing.restore')} onPress={()=>void run(async()=>{await store.restore(userId!);await sync();showMessage(t('billing.synced'));})}/>
            <Button variant="ghost" disabled={busy} label={t('billing.manage')} onPress={()=>void run(async()=>{const url=await store.managementUrl(userId!);if(url?.startsWith('https://')) await Linking.openURL(url);else if(!billingTestMode) await Linking.openURL('https://play.google.com/store/account/subscriptions');})}/>
          </>:null}
        </View>
        <View className="mb-4 gap-3 rounded-2xl border border-ink/10 bg-surface p-4">
          <Text className="text-body font-bold text-ink">{t('billing.bonus')}</Text><Text className="text-body text-ink-soft">{t('billing.bonus_hint',{reward:data.reward_photos,max:data.ads_per_day})}</Text>
          <Text className="text-body font-semibold text-coral-dark">{t('billing.bonus_count',{count:data.bonus_remaining})}</Text>
          <Text className="text-caption text-ink-soft">{t('billing.bonus_expiry')}</Text>
          <Button label={t(billingTestMode?'billing.simulate':'billing.watch',{count:data.reward_photos})} disabled={busy || privacy.isFetching || !adsSupported || data.ads_today>=data.ads_per_day || (billingTestMode?!data.tester:!data.ads_enabled)} onPress={()=>void run(watch)}/>
          {data.ads_today>=data.ads_per_day ? <Text className="text-caption text-ink-soft">{t('billing.ad_limit')}</Text>:null}
          {billingTestMode && !data.tester ? <Text className="text-caption text-ink-soft">{t('billing.test_account')}</Text>:null}
          {!billingTestMode && !data.ads_enabled ? <Text className="text-caption text-ink-soft">{t('billing.ads_disabled')}</Text>:null}
          {adsSupported && privacy.data === true ? <Button variant="ghost" disabled={busy || privacy.isFetching} label={t('billing.privacy')} onPress={()=>void run(editPrivacy)}/>:null}
          {adsSupported && !privacy.isError && privacy.data === false ? <Text className="text-caption text-ink-soft">{t('billing.privacy_not_required')}</Text>:null}
          {adsSupported && privacy.isError ? <>
            <Text className="text-caption text-ink-soft">{t('billing.privacy_check_failed')}</Text>
            <Button variant="ghost" disabled={busy || privacy.isFetching} label={t('billing.privacy_retry')} onPress={()=>void run(refreshPrivacy)}/>
          </>:null}
        </View>
        <Button variant="ghost" disabled={busy} loading={busy} label={t('billing.refresh')} onPress={()=>void run(refresh)}/>
        <Button variant="ghost" label={t('billing.legal')} onPress={()=>router.push('/privacy-policy')}/>
      </>:null}
    </ScrollView>
  </>;
}
