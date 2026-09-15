import { useTranslation } from 'react-i18next';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { BottomSheetModal } from '../../components/BottomSheetModal';
import { Icon } from '../../components/Icon';
import { useThemeColors } from '../../lib/theme';
import type { ReactNode } from 'react';

export function MovingSheet({title,onClose,children,scrollable=true}:{title:string;onClose:()=>void;children:ReactNode;scrollable?:boolean}) {
 const {t}=useTranslation(); const colors=useThemeColors();
 const {height}=useWindowDimensions();
 return <BottomSheetModal visible onClose={onClose} scrollable={scrollable} sheetStyle={!scrollable?{height:height*0.88}:undefined} sheetClassName="rounded-t-3xl bg-surface px-5 py-4">
  <View className="mb-3 flex-row items-center justify-between gap-2"><Text accessibilityRole="header" className="flex-1 text-heading font-bold text-ink">{title}</Text>
  <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={onClose} className="min-h-[48px] min-w-[48px] items-center justify-center"><Icon name="close" color={colors.ink} size={22}/></Pressable></View>{children}
 </BottomSheetModal>;
}
export function Choice({label,detail,selected,onPress,disabled=false,role='checkbox'}:{label:string;detail?:string;selected:boolean;onPress:()=>void;disabled?:boolean;role?:'checkbox'|'radio'|'button'}) {
 return <Pressable accessibilityRole={role} accessibilityLabel={[label,detail].filter(Boolean).join(', ')} accessibilityState={role==='button'?{disabled}:{checked:selected,disabled}} disabled={disabled} onPress={onPress}
  className={`mb-2 min-h-[48px] rounded-xl border px-4 py-3 ${selected?'border-coral bg-coral-light':'border-ink/15 bg-surface'}`}>
  <Text className={`text-body ${selected?'font-semibold text-coral-dark':'text-ink'}`}>{selected?'✓ ':''}{label}</Text>
  {detail?<Text className="mt-1 text-label text-ink-soft">{detail}</Text>:null}
 </Pressable>;
}
export function movingError(error: unknown):string {
 const message=String((error as {message?:string})?.message??error);
 if(message.includes('moving_forbidden')) return 'moving.forbidden';
 if(message.includes('moving_destination')) return 'moving.wrongDestination';
 if(message.includes('moving_object_changed')||message.includes('moving_other_project')) return 'moving.conflict';
 if(message.includes('moving_not_empty')) return 'moving.notEmpty';
 if((error as {code?:string})?.code==='PGRST202') return 'moving.setup';
 return 'moving.error';
}
