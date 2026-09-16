import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { useMediaSource } from '../../lib/images/media';
import { useThemeColors } from '../../lib/theme';
import { useObjet, useObjetLocationChain } from '../inventory/queries';

/** Object context stays outside the map so labels never cover its destination. */
export function PlanObjectFocus({ objetId, marker, onClose }: {
  objetId: string; marker?: number; onClose: () => void;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { data: objet, isError } = useObjet(objetId);
  const { data: chain } = useObjetLocationChain(objetId);
  const photo = useMediaSource(objet?.photo_url);
  return <View style={{ maxHeight: '42%' }} className="mt-2 rounded-2xl border border-coral/30 bg-surface">
    <ScrollView contentContainerClassName="p-4">
      <View className="flex-row items-center gap-3">
        <View style={{ width: 64, height: 72 }} className="items-center justify-center overflow-hidden rounded-xl bg-coral-light">
          {photo ? <Image source={photo} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : <Icon name="objet" size={28} color={colors.accentDark} />}
        </View>
        <View className="flex-1">
          <Text className="text-caption font-semibold text-coral-dark">{t('plans.object_focus.title')}</Text>
          <Text accessibilityRole="header" className="text-body font-bold text-ink">{objet?.name ?? t(isError ? 'plans.object_focus.unavailable' : 'common.loading')}</Text>
        </View>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('plans.object_focus.close')}
          className="min-h-[48px] min-w-[48px] items-center justify-center"><Icon name="close" size={20} color={colors.inkSoft} /></Pressable>
      </View>
      <View className="mt-3 flex-row items-start gap-3">
        <View className="min-h-[32px] min-w-[32px] items-center justify-center rounded-full bg-coral">
          {marker ? <Text className="text-label font-bold text-white">{marker}</Text> : <Icon name="location" size={18} color="#fff" />}
        </View>
        <View className="flex-1">
          <Text className="text-label font-semibold text-ink">{t(marker ? 'plans.object_focus.marker' : 'plans.object_focus.room', { number: marker })}</Text>
          <Text className="mt-1 text-label text-ink-soft">{(chain ?? []).filter((node) => node.kind !== 'habitation' && !node.is_default).map((node) => node.name).join(' › ')}</Text>
        </View>
      </View>
    </ScrollView>
  </View>;
}
