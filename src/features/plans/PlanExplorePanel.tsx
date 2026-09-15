import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { useThemeColors } from '../../lib/theme';
import type { Piece, PlanForme, PlanPin } from '../../types/database';
import { useEmplacements } from '../inventory/queries';
import { orderedPins, orderedRooms } from './exploreLayout';

export function PlanExplorePanel({ formes, pieces, selected, pins, counts, onSelect, onClose }: {
  formes: PlanForme[]; pieces: Piece[]; selected: PlanForme | null; pins: PlanPin[];
  counts?: Record<string, number>; onSelect: (forme: PlanForme) => void; onClose: () => void;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { data: storage, isPending, isError, refetch } = useEmplacements(selected?.piece_id ?? '');
  const piece = pieces.find((p) => p.id === selected?.piece_id);
  const roomPins = orderedPins(pins.filter((p) => p.forme_id === selected?.id));
  const numberedIndex = (id: string) => {
    const index = roomPins.findIndex((pin) => pin.emplacement_id === id);
    return index < 0 ? Infinity : index;
  };
  const orderedStorage = [...(storage ?? [])].sort((a, b) => numberedIndex(a.id) - numberedIndex(b.id) || a.name.localeCompare(b.name));
  return <View style={{ height: '38%' }} className="mt-2 overflow-hidden rounded-2xl border border-ink/10 bg-surface">
    <ScrollView contentContainerClassName="p-4" nestedScrollEnabled>
      <View className="flex-row items-center gap-2">
        <Text className="flex-1 text-body font-semibold text-ink" accessibilityRole="header">
          {selected ? piece?.name ?? t('plans.unassigned_room') : t('plans.explore.choose_room')}
        </Text>
        {selected ? <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')}
          className="min-h-[48px] min-w-[48px] items-center justify-center"><Icon name="close" size={20} color={colors.inkSoft} /></Pressable> : null}
      </View>
      {selected ? <>
        {piece ? <Pressable onPress={() => router.push(`/piece/${piece.id}`)} accessibilityRole="button"
          className="min-h-[48px] flex-row items-center gap-2 py-2">
          <Text className="flex-1 text-label font-semibold text-coral-dark">{t('plans.room_sheet.open')}</Text>
          <Icon name="chevron" size={18} color={colors.accentDark} />
        </Pressable> : null}
        {isPending && piece ? <Text className="text-label text-ink-soft">{t('common.loading')}</Text> : null}
        {isError ? <Pressable accessibilityRole="button" onPress={() => refetch()} className="min-h-[48px] justify-center"><Text className="text-label text-ink">{t('common.retry')}</Text></Pressable> : null}
        {!isPending && !isError && !storage?.length ? <Text className="text-label text-ink-soft">{t('plans.room_sheet.empty')}</Text> : null}
        {orderedStorage.map((item) => {
          const index = roomPins.findIndex((pin) => pin.emplacement_id === item.id);
          return <Pressable key={item.id} onPress={() => router.push(`/emplacement/${item.id}`)} accessibilityRole="button"
            accessibilityLabel={`${index >= 0 ? `${index + 1}, ` : ''}${item.name}`}
            className="min-h-[48px] flex-row items-center gap-3 border-t border-ink/10 py-3">
            <View className="h-8 w-8 items-center justify-center rounded-full bg-coral-light">
              {index >= 0 ? <Text className="text-label font-semibold text-coral-dark">{index + 1}</Text> : <Icon name="location" size={16} color={colors.accentDark} />}
            </View>
            <Text className="flex-1 text-body text-ink">{item.name}</Text>
            <Icon name="chevron" size={16} color={colors.inkSoft} />
          </Pressable>;
        })}
      </> : <View className="mt-2">
        {orderedRooms(formes).map((forme, index) => {
          const room = pieces.find((p) => p.id === forme.piece_id);
          return <Pressable key={forme.id} onPress={() => onSelect(forme)} accessibilityRole="button"
            className="min-h-[48px] flex-row items-center gap-3 py-2">
            <View className="h-7 w-7 items-center justify-center rounded-full bg-sand-dark"><Text className="text-label font-semibold text-ink">{index + 1}</Text></View>
            <View className="flex-1"><Text className="text-label font-semibold text-ink">{room?.name ?? t('plans.unassigned_room')}</Text>
              {room && counts?.[room.id] !== undefined ? <Text className="text-caption text-ink-soft">{t('plans.room_sheet.objects', { count: counts[room.id] })}</Text> : null}
            </View>
            <Icon name="chevron" size={16} color={colors.inkSoft} />
          </Pressable>;
        })}
      </View>}
    </ScrollView>
  </View>;
}
