import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { showMessage } from '../../lib/dialog';
import { uploadImage } from '../../lib/images/pickAndUploadImage';
import { newId } from '../../lib/uuid';
import { useSession } from '../auth/SessionProvider';
import { AiPhotoScanFlow, type CollectedScanItem } from '../inventory/AiPhotoScanFlow';
import { Choice, MovingSheet, movingError } from './components';
import { matchingObjects, normalizeName, type MovingBox, type MovingSnapshot } from './model';
import { useMovingCommand } from './queries';

export function PackPicker({snapshot,box,onClose}:{snapshot:MovingSnapshot;box:MovingBox;onClose:()=>void}) {
 const {t}=useTranslation();const command=useMovingCommand();const [query,setQuery]=useState('');const [selected,setSelected]=useState<string[]>([]);
 const objects=snapshot.objects.filter(o=>o.parent_id!==box.container_id&&normalizeName(o.name+' '+o.parent_label+' '+o.piece_name).includes(normalizeName(query)));
 const toggle=(id:string)=>setSelected(old=>old.includes(id)?old.filter(x=>x!==id):[...old,id]);
 const submit=async()=>{try{await command.mutateAsync({action:'pack',payload:{project_id:snapshot.project.id,box_id:box.id,items:selected.map(id=>({id}))}});onClose();}catch(error){showMessage(t(movingError(error)));}};
 return <MovingSheet title={t('moving.addObjects')} onClose={()=>{if(!command.isPending)onClose();}} scrollable={false}>
  <View style={{flex:1}}>
   <TextField label={t('moving.search')} value={query} onChangeText={setQuery}/>
   <Button variant="ghost" label={t(selected.length?'moving.clear':'moving.selectAll')} onPress={()=>setSelected(selected.length?[]:objects.map(o=>o.id))}/>
   <FlatList data={objects} keyExtractor={o=>o.id} keyboardShouldPersistTaps="handled" renderItem={({item})=><Choice label={item.name} detail={item.parent_label+' · '+item.piece_name} selected={selected.includes(item.id)} onPress={()=>toggle(item.id)} disabled={command.isPending}/>}
    ListEmptyComponent={<Text className="py-4 text-body text-ink-soft">{t('moving.noEligible')}</Text>}/>
   <Button label={t('moving.pack',{count:selected.length})} loading={command.isPending} disabled={!selected.length} onPress={submit}/>
  </View>
 </MovingSheet>;
}
type ScanChoice=CollectedScanItem & {id:string;existingId:string|null};
export function MovingPhotoFlow({snapshot,box,onClose}:{snapshot:MovingSnapshot;box:MovingBox;onClose:()=>void}) {
 const {t}=useTranslation(); const {session}=useSession(); const command=useMovingCommand();
 const [items,setItems]=useState<ScanChoice[]|null>(null); const [busy,setBusy]=useState(false);
 const choose=(index:number,existingId:string|null)=>setItems(old=>old?.map((item,i)=>i===index?{...item,existingId}:item)??null);
 const submit=async()=>{
  if(busy||!items||!session)return;
  const ids=items.flatMap(i=>i.existingId?[i.existingId]:[]);
  if(new Set(ids).size!==ids.length){showMessage(t('moving.duplicateChoice'));return;}
  setBusy(true);
  try {
   const prepared=[];
   for(const item of items){
    if(item.existingId)prepared.push({id:item.existingId});
    else {const photo_url=await uploadImage(item.localPhotoUri,{bucket:'objets',path:`${session.user.id}/${item.id}.jpg`});prepared.push({id:item.id,create:true,name:item.name,photo_url});}
   }
   await command.mutateAsync({action:'scan',payload:{project_id:snapshot.project.id,box_id:box.id,items:prepared}});onClose();
  }catch(error){showMessage(t(movingError(error)));}finally{setBusy(false);}
 };
 return <MovingSheet title={t(items?'moving.reviewMatches':'moving.photoAI')} onClose={()=>{if(!busy)onClose();}} scrollable={!!items}>
  {!items?<View style={{flex:1}}><AiPhotoScanFlow active onCancel={onClose} onDone={onClose} onCollected={list=>setItems(list.map(item=>({...item,id:newId(),existingId:null})))}/></View>:<>
   <Text className="mb-4 text-body text-ink-soft">{t('moving.scanHint')}</Text>
   {items.map((item,index)=><View key={item.id} className="mb-5"><Text className="mb-2 text-body font-bold text-ink">{item.name}</Text>
    <Choice role="radio" label={t('moving.newObject')} selected={!item.existingId} onPress={()=>choose(index,null)} disabled={busy}/>
    {matchingObjects(item.name,snapshot.objects).map(o=><Choice role="radio" key={o.id} label={o.name} detail={o.parent_label+' · '+o.piece_name} selected={item.existingId===o.id} onPress={()=>choose(index,o.id)} disabled={busy}/>)}</View>)}
   <Button label={t('moving.scanCommit',{count:items.length})} loading={busy} disabled={!items.length} onPress={submit}/>
  </>}
 </MovingSheet>;
}
