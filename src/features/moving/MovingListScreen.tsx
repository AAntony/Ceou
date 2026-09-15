import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { useThemeColors } from '../../lib/theme';
import { useSpaceForAppTabBar } from '../../components/AppTabBar';
import { useIsOffline } from '../../lib/network';
import { showMessage } from '../../lib/dialog';
import { QrScanner } from '../sharing/QrScanner';
import { ProjectForm } from './forms';
import { useMovingProjects } from './queries';
import { parseMovingQr } from './model';
import { Choice } from './components';

export function MovingListScreen() {
 const colors=useThemeColors();
 const {sourceId,archive:archiveParam}=useLocalSearchParams<{sourceId?:string;archive?:string}>();const {t}=useTranslation();const projects=useMovingProjects();const bottom=useSpaceForAppTabBar();const offline=useIsOffline();
 const [create,setCreate]=useState(false);const [archive,setArchive]=useState(archiveParam === '1');const [scan,setScan]=useState(false);
 const scoped=(projects.data??[]).filter(p=>!sourceId||p.source_id===sourceId||p.destination_id===sourceId);
 const hasActive=scoped.some(p=>p.status!=='completed');
 const hasArchives=scoped.some(p=>p.status==='completed');
 const list=scoped.filter(p=>archive?p.status==='completed':p.status!=='completed');
 return <View className="flex-1 bg-sand">
  <Stack.Screen options={{headerShown:true,title:t('moving.title'),headerRight:()=>null}}/>
  <FlatList data={list} keyExtractor={p=>p.id} contentContainerStyle={{padding:20,paddingBottom:bottom+24}}
   refreshing={projects.isRefetching} onRefresh={()=>{void projects.refetch();}}
   ListHeaderComponent={<View className="mb-4 gap-2">
    <Text className="mb-2 text-body text-ink-soft">{t('moving.startHint')}</Text>
    <Button label={t('moving.entry')} onPress={()=>setCreate(true)} disabled={offline}/>
    <View className="flex-row flex-wrap items-center justify-between gap-x-4">
     {hasActive&&!archive?<Pressable accessibilityRole="button" onPress={()=>setScan(true)} className="min-h-[48px] flex-row items-center gap-2 py-2">
      <Icon name="camera" size={20} color={colors.inkSoft}/><Text className="text-label text-ink-soft">{t('moving.scan')}</Text>
     </Pressable>:null}
     {hasArchives||archive?<Pressable accessibilityRole="button" onPress={()=>setArchive(!archive)} className="min-h-[48px] justify-center py-2">
      <Text className="text-label text-ink-soft">{t(archive?'moving.active':'moving.seeArchives')}</Text>
     </Pressable>:null}
    </View>
    {offline?<Text className="text-label text-ink-soft">{t('moving.online')}</Text>:null}</View>}
   renderItem={({item})=><Choice role="button" selected={false} label={item.name} detail={[t('moving.'+item.status),item.planned_date].filter(Boolean).join(' · ')} onPress={()=>router.push(`/moving/${item.id}`)}/>}
   ListEmptyComponent={projects.isPending?<ActivityIndicator/>:projects.isError?<View className="gap-3"><Text className="text-body text-ink">{t((projects.error as {code?:string}).code==='PGRST202'?'moving.setup':'moving.loadError')}</Text><Button label={t('common.retry')} onPress={()=>{void projects.refetch();}}/></View>:<View className="py-8"><Text className="text-heading font-bold text-ink">{t('moving.empty')}</Text><Text className="mt-2 text-body text-ink-soft">{t('moving.emptyHint')}</Text></View>}/>
  {create?<ProjectForm sourceId={sourceId} onClose={()=>setCreate(false)} onCreated={id=>{setCreate(false);router.push(`/moving/${id}`);}}/>:null}
  <QrScanner visible={scan} onClose={()=>setScan(false)} hint={t('moving.scan')} onScanned={value=>{setScan(false);const id=parseMovingQr(value);if(id)router.push(`/moving-box/${id}`);else showMessage(t('moving.invalidQr'));}}/>
 </View>;
}
