import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { useSpaceForAppTabBar } from '../../components/AppTabBar';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { QrCode } from '../../components/QrCode';
import { useMediaSource } from '../../lib/images/media';
import { pickImage, uploadImage } from '../../lib/images/pickAndUploadImage';
import { showDialog, showMessage } from '../../lib/dialog';
import { newId } from '../../lib/uuid';
import { useIsOffline } from '../../lib/network';
import { useSession } from '../auth/SessionProvider';
import { LocationTreePicker } from '../inventory/LocationTreePicker';
import { QrScanner } from '../sharing/QrScanner';
import { Choice, MovingSheet, movingError } from './components';
import { BoxForm, ProjectForm } from './forms';
import { PackPicker, MovingPhotoFlow } from './packing';
import { movingProgress, boxState, movingQr, parseMovingQr, type MovingBox, type MovingObject, type BoxFilter } from './model';
import { useMovingCommand, useMovingSnapshot } from './queries';
import { printMovingLabels } from './labels';
import { MovingActions, MovingBoxRow, MovingTimeline, type MovingAction } from './DashboardParts';
import type { Json } from '../../types/supabase';

function BoxPhoto({uri}:{uri:string|null}) {
 const source=useMediaSource(uri);
 return source?<Image source={source} style={{height:180,width:'100%',borderRadius:16}} contentFit="cover"/>:null;
}
export function MovingScreen({id,boxId}:{id:string;boxId?:string}) {
 const {t}=useTranslation();const {session}=useSession();const query=useMovingSnapshot(id);const command=useMovingCommand();const bottom=useSpaceForAppTabBar();const offline=useIsOffline();
 const quickBoxId=useRef(newId());
 const [modal,setModal]=useState<'box'|'edit'|'pack'|'photo'|'qr'|'unpack'|'store'|'transfer'|'dispose'|'destination'|'actions'|'projectActions'|null>(null);
 const [filter,setFilter]=useState<BoxFilter>('all');const [roomFilter,setRoomFilter]=useState('');const [boxSearch,setBoxSearch]=useState('');const [selected,setSelected]=useState<string[]>([]);const [scan,setScan]=useState(false);const [photoBusy,setPhotoBusy]=useState(false);
 const data=query.data;const project=data?.project;const box=data?.boxes.find(b=>b.id===boxId);const writable=!!data?.editable&&project?.status!=='completed'&&!offline;
 const perform=async(action:string,payload:Record<string,Json|undefined>={})=>{
  if(!project||command.isPending)return false;
  try{await command.mutateAsync({action,payload:{project_id:project.id,box_id:box?.id,...payload}});setSelected([]);setModal(null);return true;}catch(error){showMessage(t(movingError(error)));return false;}
 };
 const createNext=async()=>{
  if(!project||!box||command.isPending)return;
  try{const result=await command.mutateAsync({action:'box_create',payload:{id:quickBoxId.current,project_id:project.id,category:box.category,destination_piece_id:box.destination_piece_id}});quickBoxId.current=newId();setModal(null);router.push(`/moving-box/${result.id}`);}catch(error){showMessage(t(movingError(error)));}
 };
 const close=()=>{if(!command.isPending&&!photoBusy)setModal(null);};
 const print=async(boxes:MovingBox[])=>{try{await printMovingLabels(boxes);}catch{showMessage(t('moving.error'));}};
 if(query.isPending&&!offline)return <View className="flex-1 items-center justify-center bg-sand"><ActivityIndicator/></View>;
 if(query.isError||!data||!project||(boxId&&!box))return <View className="flex-1 gap-4 bg-sand p-6"><Stack.Screen options={{headerShown:true,title:t('moving.title')}}/><Text className="text-body text-ink">{t(offline?'moving.offlineEmpty':'moving.loadError')}</Text><Button label={t('common.retry')} disabled={offline||query.isFetching} onPress={()=>{void query.refetch();}}/></View>;
 const progress=movingProgress(data.items);const members=box?data.objects.filter(o=>o.parent_id===box.container_id):[];
 const history=box?data.items.filter(i=>i.box_id===box.id):[];
 const selection=selected.filter(id=>members.some(o=>o.id===id));
 const actionable=selection.length?selection:members.map(o=>o.id);
 const state=box?boxState(box,data.items):null;
 const boxes=data.boxes.filter(b=>(filter==='all'||(filter==='done'?['done','stored'].includes(boxState(b,data.items)):boxState(b,data.items)===filter))&&(!roomFilter||b.destination_piece_id===roomFilter)&&b.name.toLowerCase().includes(boxSearch.toLowerCase()));
 const roomChoices=[...new Map(data.boxes.filter(b=>b.destination_piece_id).map(b=>[b.destination_piece_id!,b.destination_name??t('moving.noRoom')])).entries()];
 const toggle=(id:string)=>setSelected(old=>old.includes(id)?old.filter(x=>x!==id):[...old,id]);
 const updatePhoto=async(target:MovingBox|undefined=box)=>{
  if(photoBusy||!session||!target?.container_id)return;setPhotoBusy(true);
  try{const uri=await pickImage([1,1]);if(!uri)return;const url=await uploadImage(uri,{bucket:'objets',path:`${session.user.id}/conteneur-${target.container_id}.jpg`});await perform('box_photo',{box_id:target.id,photo_url:url});}
  catch{showMessage(t('moving.photoFailed'));}finally{setPhotoBusy(false);}
 };
 const actionButton=(label:string,action:()=>void,disabled=false)=><Button label={t(label)} variant="outline" onPress={action} disabled={disabled||command.isPending}/>;
 const boxFooter=box?<View>     {writable&&state!=='stored'&&members.length?<View className="my-4 gap-2">
      <Button label={t(selection.length?'moving.unpack':'moving.unpackAll')} disabled={command.isPending} onPress={()=>{if(!project.destination_id){setModal('destination');return;}setModal('unpack');}}/>
      {actionButton('moving.moveBox',()=>setModal('transfer'))}
      {actionButton('moving.storedAction',()=>{if(!project.destination_id){setModal('destination');return;}setModal('store');})}
      {actionButton('moving.dispose',()=>setModal('dispose'))}
     </View>:null}
     {history.filter(i=>i.outcome!=='packed').length?<><Text accessibilityRole="header" className="mb-2 mt-5 text-heading font-semibold text-ink">{t('moving.history')}</Text>{history.filter(i=>i.outcome!=='packed').map(i=><View key={i.object_id} className="mb-2 rounded-xl bg-surface p-3"><Text className="text-body font-semibold text-ink">{i.name} · {t('moving.'+i.outcome)}</Text>{i.origin_label?<Text className="mt-1 text-label text-ink-soft">{t('moving.origin',{place:i.origin_label})}</Text>:null}</View>)}</>:null}
</View>:null;
 return <View className="flex-1 bg-sand">
  <Stack.Screen options={{headerShown:true,title:box?.name??project.name}}/>
  <FlatList<MovingBox | MovingObject> data={box?members:boxes} keyExtractor={b=>b.id} contentContainerStyle={{padding:20,paddingBottom:bottom+24}}
   refreshing={query.isRefetching} onRefresh={()=>{void query.refetch();}}
   ListHeaderComponent={<View>
    {offline?<Text className="mb-3 text-label text-ink-soft">{t('moving.online')}</Text>:null}
    {!data.editable?<Text className="mb-3 text-label text-ink-soft">{t('moving.readOnly')}</Text>:null}
    {box?<>
     <BoxPhoto uri={box.photo_url}/>
     <View className="mb-4 rounded-2xl bg-coral-light p-4"><Text className="text-heading font-bold text-coral-dark">{t('moving.destinationHint',{room:box.destination_name??t('moving.noRoom')})}</Text><Text className="mt-1 text-body text-ink">{t(state==='stored'?'moving.boxStored':'moving.'+state)} · {members.length} {t('moving.objectsLabel')}</Text></View>
     {box.description?<Text className="mb-4 text-body text-ink-soft">{box.description}</Text>:null}
     <View className="mb-4 gap-2">
      {writable&&state!=='stored'?<><Button label={t('moving.addObjects')} onPress={()=>setModal('pack')} disabled={command.isPending}/>{actionButton('moving.photoAI',()=>setModal('photo'))}</>:null}
      <View className="flex-row gap-2"><View className="flex-1">{actionButton('moving.qr',()=>setModal('qr'))}</View>{writable?<View className="flex-1">{actionButton('moving.manage',()=>setModal('actions'))}</View>:null}</View>
     </View>
     <Text accessibilityRole="header" className="mb-2 text-heading font-bold text-ink">{t('moving.content')} · {members.length}</Text>
     {!members.length?<Text className="mb-4 text-body text-ink-soft">{t('moving.noObjects')}</Text>:null}
     {writable&&state!=='stored'&&members.length?<Button variant="ghost" label={t(selection.length?'moving.clear':'moving.selectAll')} onPress={()=>setSelected(selection.length?[]:members.map(o=>o.id))}/>:null}
    </>:<>
     <MovingTimeline status={project.status}/>{project.status!=='completed'?<Text className="mb-2 text-label text-ink-soft">{t(project.status==='preparation'?'moving.prepareHint':project.status==='moving'?'moving.transportHint':'moving.unpackHint')}</Text>:null}
     <View className="mb-2 flex-row items-center justify-between gap-2">
      <Text className="flex-1 text-label text-ink-soft">{data.boxes.length} {t('moving.boxes')} · {progress.packed} {t('moving.packed')}</Text>
      <Pressable accessibilityRole="button" onPress={()=>showMessage([
       t('moving.progress',{percent:progress.percent}),
       `${progress.installed} ${t('moving.installed')} · ${progress.stored} ${t('moving.stored')}`,
       `${t('moving.readyCount')} : ${data.boxes.filter(b=>boxState(b,data.items)==='ready').length}`,
       `${t('moving.transportedCount')} : ${data.boxes.filter(b=>boxState(b,data.items)==='transported').length}`,
       `${t('moving.doneCount')} : ${data.boxes.filter(b=>boxState(b,data.items)==='done').length}`,
       t('moving.progressHint'), project.planned_date??''
      ].filter(Boolean).join('\n'))} className="min-h-[48px] justify-center px-2">
       <Text className="text-label font-semibold text-coral-dark">{t('moving.progress',{percent:progress.percent})} ⓘ</Text>
      </Pressable>
     </View>
     <MovingActions actions={[
      ...(writable?[
       {label:t('moving.newBox'),icon:'conteneur',primary:true,onPress:()=>setModal('box'),disabled:command.isPending},
       
       ...(project.status!=='unpacking'?[{label:t(project.status==='preparation'?'moving.startMoving':'moving.startUnpacking'),icon:'move',onPress:()=>{void perform('phase',{status:project.status==='preparation'?'moving':'unpacking'});},disabled:command.isPending}] as MovingAction[]:[]),
      ] as MovingAction[]:[]),
      {label:t('moving.scan'),icon:'camera',onPress:()=>setScan(true)},
      {label:t('moving.moreActions'),icon:'dots',onPress:()=>setModal('projectActions')}
     ]}/>
     <TextField label={t('moving.boxes')} value={boxSearch} onChangeText={setBoxSearch}/>
     <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8}} className="mb-3">{(['all','packing','ready','transported','done'] as BoxFilter[]).map(value=><Pressable key={value} accessibilityRole="button" accessibilityState={{selected:filter===value}} onPress={()=>setFilter(value)} className={`min-h-[48px] justify-center rounded-full px-3 ${filter===value?'bg-coral-light':'bg-surface'}`}><Text className="text-label text-coral-dark">{t('moving.'+value)}</Text></Pressable>)}</ScrollView>
     {roomChoices.length?<View className="mb-4 flex-row flex-wrap gap-2"><Choice role="radio" label={t('moving.all')} selected={!roomFilter} onPress={()=>setRoomFilter('')}/>{roomChoices.map(([id,name])=><Choice role="radio" key={id} label={name} selected={roomFilter===id} onPress={()=>setRoomFilter(id)}/>)}</View>:null}
    </>}
   </View>}
   renderItem={({item})=> 'parent_id' in item ? <View className="mb-2">
     {writable&&state!=='stored'?<Choice label={item.name} selected={selection.includes(item.id)} onPress={()=>toggle(item.id)} disabled={command.isPending}/>:<Pressable accessibilityRole="button" onPress={()=>router.push(`/objet/${item.id}`)} className="min-h-[48px] rounded-xl bg-surface p-4"><Text className="text-body text-ink">{item.name}</Text></Pressable>}
    </View>:<MovingBoxRow box={item} busy={photoBusy||command.isPending} onOpen={()=>router.push(`/moving-box/${item.id}`)}
     onPhoto={writable?()=>{void updatePhoto(item);}:undefined}
     detail={`${t(boxState(item,data.items)==='stored'?'moving.boxStored':'moving.'+boxState(item,data.items))} · ${data.items.filter(i=>i.box_id===item.id&&i.outcome==='packed').length} ${t('moving.objectsLabel')}`} />}
   ListFooterComponent={box?boxFooter:writable?<View className="mt-5"><Button variant="outline" label={t('moving.finish')} disabled={command.isPending||progress.packed>0} onPress={()=>showDialog({title:t('moving.finishTitle'),message:t('moving.finishHint'),actions:[{label:t('common.cancel'),cancel:true},{label:t('moving.finish'),onPress:()=>{void perform('finish');}}]})}/></View>:null}/>
  {modal==='projectActions'?<MovingSheet title={t('moving.moreActions')} onClose={close}><View className="gap-2">
   {writable?<>{actionButton('moving.destinationEdit',()=>setModal('destination'))}{project.status!=='preparation'?actionButton('moving.backPreparation',()=>{void perform('phase',{status:'preparation'});}):null}</>:null}
   {data.boxes.length?actionButton('moving.printAll',()=>{void print(data.boxes);}):null}
  </View></MovingSheet>:null}
  {box&&modal==='actions'?<MovingSheet title={box.name} onClose={close}><View className="gap-3">
    {actionButton('moving.edit',()=>setModal('edit'))}{actionButton('moving.photo',()=>{void updatePhoto();},photoBusy)}
    {state!=='stored'?actionButton(box.status==='packing'?'moving.markReady':box.status==='ready'?'moving.markTransported':'moving.reopen',()=>{void perform('box_status',{status:box.status==='packing'?'ready':box.status==='ready'?'transported':'packing'});}):null}
    {actionButton('moving.quickBox',()=>{void createNext();})}
   </View></MovingSheet>:null}
  {modal==='box'||modal==='edit'?<BoxForm project={project} box={modal==='edit'?box:undefined} previous={data.boxes[data.boxes.length-1]} onClose={close} onCreated={id=>{setModal(null);if(modal==='box')router.push(`/moving-box/${id}`);}}/>:null}
  {modal==='destination'?<ProjectForm project={project} onClose={close} onCreated={()=>setModal(null)}/>:null}
  {box&&modal==='pack'?<PackPicker snapshot={data} box={box} onClose={close}/>:null}
  {box&&modal==='photo'?<MovingPhotoFlow snapshot={data} box={box} onClose={close}/>:null}
  {box&&modal==='qr'?<MovingSheet title={box.name} onClose={close}><View className="items-center py-4"><QrCode value={movingQr(box.id)}/></View><Text className="mb-4 text-body text-ink-soft">{t('moving.qrPrivate')}</Text><Button label={t('moving.print')} onPress={()=>{void print([box]);}}/></MovingSheet>:null}
  {box&&(modal==='unpack'||modal==='store')?<MovingSheet title={t('moving.choosePlace')} onClose={close}><LocationTreePicker active confirmLabel={t('moving.confirm')} loading={command.isPending} onChoose={(type,id)=>{void perform(modal==='store'?'store':'unpack',{to_type:type,to_id:id,items:actionable.map(id=>({id}))});}}/></MovingSheet>:null}
  {box&&modal==='transfer'?<MovingSheet title={t('moving.selectBox')} onClose={close}>{data.boxes.filter(b=>b.id!==box.id&&b.status!=='stored'&&b.container_id).map(b=><Choice role="button" key={b.id} label={b.name} selected={false} disabled={command.isPending} onPress={()=>{void perform('pack',{box_id:b.id,items:actionable.map(id=>({id}))});}}/>)}</MovingSheet>:null}
  {box&&modal==='dispose'?<MovingSheet title={t('moving.dispose')} onClose={close}>{(['lost','given','sold','discarded'] as const).map(outcome=><Button key={outcome} label={t('moving.'+outcome)} variant="ghost" disabled={command.isPending} onPress={()=>showDialog({title:t('moving.disposeTitle'),message:t('moving.disposeHint'),actions:[{label:t('common.cancel'),cancel:true},{label:t('moving.confirm'),destructive:true,onPress:()=>{void perform('dispose',{outcome,items:actionable.map(id=>({id}))});}}]})}/>)}</MovingSheet>:null}
  <QrScanner visible={scan} hint={t('moving.scan')} onClose={()=>setScan(false)} onScanned={value=>{setScan(false);const id=parseMovingQr(value);if(id)router.push(`/moving-box/${id}`);else showMessage(t('moving.invalidQr'));}}/>
 </View>;
}
