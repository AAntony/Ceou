import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text } from 'react-native';
import { Button } from '../../components/Button';
import { showMessage } from '../../lib/dialog';
import { Choice, MovingSheet, movingError } from './components';
import { useMovingCommand, useMovingProjects, useMovingSnapshot } from './queries';

function ProjectBoxes({projectId,objectId,onClose}:{projectId:string;objectId:string;onClose:()=>void}) {
 const {t}=useTranslation();const snapshot=useMovingSnapshot(projectId);const command=useMovingCommand();
 if(snapshot.isPending)return <ActivityIndicator/>;
 if(snapshot.isError)return <Text className="text-body text-ink">{t('moving.loadError')}</Text>;
 const boxes=(snapshot.data?.boxes??[]).filter(b=>b.container_id&&b.status!=='stored');
 return <>{!boxes.length?<Text className="text-body text-ink-soft">{t('moving.noBoxes')}</Text>:null}{boxes.map(box=><Choice key={box.id} label={box.name} selected={false} disabled={command.isPending} onPress={async()=>{
  try{await command.mutateAsync({action:'pack',payload:{project_id:projectId,box_id:box.id,items:[{id:objectId}]}});onClose();}catch(error){showMessage(t(movingError(error)));}
 }}/>)}</>;
}
export function PackObjectButton({objectId,homeId}:{objectId:string;homeId?:string|null}) {
 const {t}=useTranslation();const [open,setOpen]=useState(false);
 return <><Button label={t('moving.objectPack')} variant="outline" onPress={()=>setOpen(true)}/>{open?<PackObjectSheet objectId={objectId} homeId={homeId} onClose={()=>setOpen(false)}/>:null}</>;
}
function PackObjectSheet({objectId,homeId,onClose}:{objectId:string;homeId?:string|null;onClose:()=>void}) {
 const {t}=useTranslation();const projects=useMovingProjects();const [chosen,setChosen]=useState('');
 const available=(projects.data??[]).filter(p=>p.editable&&p.status!=='completed'&&(p.source_id===homeId||p.destination_id===homeId));
 return <MovingSheet title={t('moving.selectBox')} onClose={onClose}>
  {projects.isPending?<ActivityIndicator/>:projects.isError?<Text className="text-body text-ink">{t('moving.loadError')}</Text>:!available.length?<Text className="text-body text-ink-soft">{t('moving.noBoxes')}</Text>:null}
  {available.map(p=><Choice key={p.id} label={p.name} selected={chosen===p.id} onPress={()=>setChosen(p.id)}/>)}
  {chosen?<ProjectBoxes projectId={chosen} objectId={objectId} onClose={onClose}/>:null}
 </MovingSheet>;
}
