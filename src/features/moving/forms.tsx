import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { showMessage } from '../../lib/dialog';
import { newId } from '../../lib/uuid';
import { useHabitations, usePieces } from '../inventory/queries';
import { Choice, MovingSheet, movingError } from './components';
import { useMovingCommand } from './queries';
import type { MovingBox, MovingProject } from './model';

export function ProjectForm({sourceId,onClose,onCreated,project}:{sourceId?:string;onClose:()=>void;onCreated:(id:string)=>void;project?:MovingProject}) {
 const {t}=useTranslation(); const {data:homes=[]}=useHabitations(); const command=useMovingCommand();
 const id=useRef(newId()); const [name,setName]=useState(''); const [source,setSource]=useState(sourceId??'');
 const [details,setDetails]=useState(false);
 const [destination,setDestination]=useState(project?.destination_id??''); const [newHome,setNewHome]=useState(false); const [homeName,setHomeName]=useState(''); const [date,setDate]=useState('');
 const submit=async()=>{
  if(command.isPending)return;
  if(date && (!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)){showMessage(t('moving.invalidDate'));return;}
  try {const result=await command.mutateAsync({action:project?'destination':'create',payload:{id:id.current,project_id:project?.id,name:name.trim()||t('moving.defaultName',{place:homes.find(h=>h.id===source)?.name??''}).slice(0,160),source_id:source,destination_id:newHome?null:destination||null,destination_name:newHome?homeName:null,planned_date:date||null}});onCreated(result.id);}catch(error){showMessage(t(movingError(error)));}
 };
 return <MovingSheet title={t(project?'moving.destinationEdit':'moving.new')} onClose={()=>{if(!command.isPending)onClose();}}>
  {!project?<>
  <Text className="mb-2 text-body font-semibold text-ink">{t('moving.source')}</Text>
  {homes.map(h=><Choice key={h.id} label={h.name} selected={source===h.id} onPress={()=>{setSource(h.id);if(destination===h.id)setDestination('');}}/>)}</>:null}
  <>{!project?<Button variant="ghost" label={t(details?'moving.hideDetails':'moving.optionalDetails')} accessibilityState={{expanded:details}} onPress={()=>setDetails(!details)}/>:null}{project||details?<><Text className="mb-2 mt-3 text-body font-semibold text-ink">{t('moving.destination')}</Text>
  {!project?<Choice label={t('moving.later')} selected={!destination&&!newHome} onPress={()=>{setDestination('');setNewHome(false);}}/>:null}
  {homes.filter(h=>h.id!==(project?.source_id??source)).map(h=><Choice key={h.id} label={h.name} selected={destination===h.id&&!newHome} onPress={()=>{setDestination(h.id);setNewHome(false);}}/>)}
  <Choice label={t('moving.createHome')} selected={newHome} onPress={()=>setNewHome(!newHome)}/>
  {newHome?<TextField label={t('moving.homeName')} value={homeName} onChangeText={setHomeName} maxLength={160}/>:null}
  {!project?<TextField label={t('moving.name')} value={name} onChangeText={setName} maxLength={160}/>:null}
  {!project?<TextField label={t('moving.date')} value={date} onChangeText={setDate} placeholder="2026-10-01"/>:null}</>:null}</>
  <Text className="mb-3 text-label text-ink-soft">{t('moving.online')}</Text>
  <Button label={t(project?'common.save':'moving.create')} loading={command.isPending} disabled={(!project&&!source)||(newHome&&!homeName.trim())||(!!project&&!newHome&&!destination)} onPress={submit}/>
 </MovingSheet>;
}
export function BoxForm({project,box,previous,onClose,onCreated}:{project:MovingProject;box?:MovingBox;previous?:MovingBox;onClose:()=>void;onCreated:(id:string)=>void}) {
 const {t}=useTranslation(); const command=useMovingCommand(); const id=useRef(newId());
 const {data:rooms=[]}=usePieces(project.destination_id??'');
 const [name,setName]=useState(box?.name??''); const [category,setCategory]=useState(box?.category??previous?.category??''); const [description,setDescription]=useState(box?.description??'');
 const [room,setRoom]=useState(box?.destination_piece_id??previous?.destination_piece_id??'');
 const submit=async()=>{try{const result=await command.mutateAsync({action:box?'box_edit':'box_create',payload:{id:id.current,project_id:project.id,box_id:box?.id,name,category,description,destination_piece_id:room||null}});onCreated(box?.id??result.id);}catch(error){showMessage(t(movingError(error)));}};
 return <MovingSheet title={t(box?'moving.edit':'moving.newBox')} onClose={()=>{if(!command.isPending)onClose();}}>
  <TextField label={t(box?'moving.boxFullName':'moving.boxName')} value={name} onChangeText={setName} maxLength={160}/>
  <TextField label={t('moving.category')} value={category} onChangeText={setCategory}/>
  <TextField label={t('moving.description')} value={description} onChangeText={setDescription} multiline/>
  {!box&&previous?<Text className="mb-3 text-label text-ink-soft">{t('moving.copyPrevious')}</Text>:null}
  <Text className="mb-2 text-body font-semibold text-ink">{t('moving.room')}</Text>
  <Choice label={t('moving.noRoom')} selected={!room} onPress={()=>setRoom('')}/>
  {rooms.map(r=><Choice key={r.id} label={r.name} selected={room===r.id} onPress={()=>setRoom(r.id)}/>)}
  {!rooms.length?<Text className="mb-3 text-label text-ink-soft">{t('moving.noRoomHint')}</Text>:null}
  <View className="mt-3"><Button label={t(box?'common.save':'moving.boxCreate')} loading={command.isPending} disabled={!!box&&!name.trim()} onPress={submit}/></View>
 </MovingSheet>;
}
