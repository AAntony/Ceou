import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Icon, type IconName } from '../../components/Icon';
import { useMediaSource } from '../../lib/images/media';
import { useThemeColors } from '../../lib/theme';
import { STACK_SCALE, useTextScale } from '../../lib/textScale';
import type { MovingBox } from './model';

export function MovingTimeline({ status }: { status: string }) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const steps = ['preparation', 'moving', 'unpacking', 'completed'];
  const current = steps.indexOf(status);
  const { textScale } = useTextScale();
  const vertical = textScale >= STACK_SCALE;
  const announcement = t('moving.stepAnnouncement', { step: current + 1, total: steps.length, name: t('moving.' + status) });
  if (vertical) return <View accessible accessibilityLabel={announcement} className="mb-3 gap-2">
    {steps.map((step, index) => <View key={step} className="flex-row items-center gap-3">
      <Icon name={index < current ? 'validate' : 'chevron'} size={20} color={index === current ? colors.accentDark : colors.inkSoft} />
      <Text className={`flex-1 text-label ${index === current ? 'font-bold text-coral-dark' : 'text-ink-soft'}`}>{index + 1}. {t('moving.' + step)}</Text>
    </View>)}
  </View>;
  return <View accessible className="mb-3 flex-row" accessibilityLabel={announcement}>
    {steps.map((step, index) => <View key={step} className="flex-1 items-center">
      <View className="w-full flex-row items-center">
        <View className={`h-0.5 flex-1 ${index === 0 ? 'bg-transparent' : index <= current ? 'bg-coral' : 'bg-ink/15'}`} />
        <View className={`h-7 w-7 items-center justify-center rounded-full ${index === current ? 'border-2 border-coral bg-coral-light' : 'bg-surface'}`}>
          {index < current ? <Icon name="validate" size={16} color={colors.accentDark} /> : <Text className="text-label font-bold text-ink">{index + 1}</Text>}
        </View>
        <View className={`h-0.5 flex-1 ${index === steps.length - 1 ? 'bg-transparent' : index < current ? 'bg-coral' : 'bg-ink/15'}`} />
      </View>
      <Text className={`mt-1 text-center text-caption ${index === current ? 'font-bold text-coral-dark' : 'text-ink-soft'}`}>{t('moving.' + step)}</Text>
    </View>)}
  </View>;
}

export type MovingAction = { label: string; icon: IconName; onPress: () => void; disabled?: boolean; primary?: boolean };
export function MovingActions({ actions }: { actions: MovingAction[] }) {
  const colors = useThemeColors();
  const { textScale } = useTextScale();
  return <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ flexGrow: 1, justifyContent: 'space-evenly', gap: 8, paddingBottom: 8 }} className="mb-2">
    {actions.map(action => <Pressable key={action.label} accessibilityRole="button" accessibilityLabel={action.label}
      accessibilityState={{ disabled: !!action.disabled }} disabled={action.disabled} onPress={action.onPress}
      style={{ flexGrow: 1, flexBasis: 0, minWidth: 88 * textScale, opacity: action.disabled ? 0.45 : 1 }} className="items-center px-1 py-2">
      <View className={`mb-1 h-12 w-12 items-center justify-center rounded-2xl ${action.primary ? 'bg-coral-light' : 'bg-surface'}`}>
        <Icon name={action.icon} size={24} color={action.primary ? colors.accentDark : colors.ink} />
      </View>
      <Text style={{ maxWidth: 150 * textScale }} className="text-center text-caption font-medium text-ink">{action.label}</Text>
    </Pressable>)}
  </ScrollView>;
}

export function MovingBoxRow({ box, detail, onOpen, onPhoto, busy }: {
  box: MovingBox; detail: string; onOpen: () => void; onPhoto?: () => void; busy: boolean;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const source = useMediaSource(box.photo_url);
  return <View className="mb-3 flex-row items-center gap-3 rounded-2xl bg-surface p-3">
    <Pressable accessibilityRole="button" accessibilityLabel={onPhoto ? t('moving.photo') + ' · ' + box.name : box.name}
      accessibilityState={{ disabled: busy }} disabled={busy} onPress={onPhoto ?? onOpen}
      className="h-20 w-20 items-center justify-center overflow-hidden rounded-xl bg-sand">
      {source ? <Image source={source} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : <Icon name="camera" size={26} color={colors.inkSoft} />}
      {onPhoto ? <View className="absolute bottom-0 right-0 rounded-tl-lg bg-surface p-1"><Icon name="addPhoto" size={16} color={colors.accentDark} /></View> : null}
    </Pressable>
    <Pressable accessibilityRole="button" onPress={onOpen} className="min-h-[80px] flex-1 justify-center">
      <Text className="text-body font-bold text-ink">{box.name}</Text>
      <Text className="mt-1 text-label text-coral-dark">{box.destination_name ?? t('moving.noRoom')}</Text>
      <Text className="mt-1 text-label text-ink-soft">{detail}</Text>
    </Pressable>
    <Icon name="chevron" size={18} color={colors.inkSoft} />
  </View>;
}
