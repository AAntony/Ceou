import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { HexBadge } from '../../components/HexBadge';
import { getEmplacementIcon } from '../inventory/constants';
import { HUE_BADGE_FILL, HUE_CARD_BG, hueAt } from './palette';
import type { SearchIndexEntry, SearchKind } from './queries';

const ROUTE_BY_KIND: Record<SearchKind, string> = {
  objet: 'objet',
  conteneur: 'conteneur',
  emplacement: 'emplacement',
  piece: 'piece',
};

function locationLine(entry: SearchIndexEntry): string {
  if (entry.kind === 'piece') return entry.habitation_name;
  if (entry.kind === 'emplacement') return entry.piece_name;
  return `${entry.parent_label} · ${entry.piece_name}`;
}

type ResultCardProps = {
  entry: SearchIndexEntry;
  colorIndex: number;
};

export function ResultCard({ entry, colorIndex }: ResultCardProps) {
  const hue = hueAt(colorIndex);

  return (
    <Pressable
      onPress={() => router.push(`/${ROUTE_BY_KIND[entry.kind]}/${entry.id}`)}
      className={`mb-3 w-[48%] rounded-2xl p-4 active:opacity-70 ${HUE_CARD_BG[hue]}`}
    >
      <View className="mb-3">
        <HexBadge
          icon={entry.kind === 'emplacement' ? getEmplacementIcon(entry.preset_key) : entry.kind}
          fill={HUE_BADGE_FILL[hue]}
          photoUri={entry.photo_url}
          size={52}
        />
      </View>
      <Text numberOfLines={1} className="text-base font-semibold text-ink">
        {entry.name}
      </Text>
      <Text numberOfLines={1} className="mt-0.5 text-xs text-ink-soft">
        {locationLine(entry)}
      </Text>
    </Pressable>
  );
}
