import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Icon, type IconName } from '../../components/Icon';
import { useMediaSource } from '../../lib/images/media';
import { useTextScale } from '../../lib/textScale';
import { useThemeColors } from '../../lib/theme';
import type { SearchIndexEntry, SearchKind } from './queries';

const ICONS: Record<SearchKind, IconName> = { objet: 'objet', piece: 'piece', emplacement: 'conteneur', conteneur: 'conteneur' };

export function ResultCard({ entry, columns }: { entry: SearchIndexEntry; columns: number }) {
  const photo = useMediaSource(entry.photo_url);
  const colors = useThemeColors();
  const { textScale } = useTextScale();
  const row = columns === 1;
  const location = entry.parent_label || (entry.kind === 'piece' ? entry.habitation_name : entry.piece_name);
  const context = [entry.piece_name, entry.habitation_name].filter((part, i, all) => part && part !== location && all.indexOf(part) === i).join(' · ');
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={[entry.name, location, context].filter(Boolean).join(', ')}
      onPress={() => router.push(`/${entry.kind}/${entry.id}`)}
      style={row ? undefined : { width: '48%' }}
      className={`mb-3 overflow-hidden rounded-2xl bg-surface active:opacity-70 ${row ? 'w-full flex-row items-center p-3' : ''}`}>
      {textScale < 2 ? <View style={row ? { width: 68, height: 76 } : { width: '100%', aspectRatio: 4 / 3 }}
        className="items-center justify-center overflow-hidden rounded-xl bg-coral-light">
        {photo ? <Image source={photo} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : <Icon name={ICONS[entry.kind]} size={30} color={colors.accentDark} />}
      </View> : null}
      <View className={row ? 'min-w-0 flex-1 px-3 py-1' : 'p-3'}>
        <Text className="text-body font-semibold text-ink">{entry.name}</Text>
        <Text className="mt-1 text-label font-semibold text-coral-dark">{location}</Text>
        {context ? <Text className="mt-1 text-caption text-ink-soft">{context}</Text> : null}
      </View>
      {row && textScale < 1.3 ? <Icon name="chevron" size={18} color={colors.inkSoft} /> : null}
    </Pressable>
  );
}
