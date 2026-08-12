import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { getEmplacementIcon } from '../inventory/constants';
import type { SearchIndexEntry, SearchKind } from './queries';

const ROUTE_BY_KIND: Record<SearchKind, string> = {
  objet: 'objet',
  conteneur: 'conteneur',
  emplacement: 'emplacement',
  piece: 'piece',
};

// Rotation pastel plutôt qu'une couleur fixe par type — variété visuelle
// "ludique" façon maquette, sans dépendre d'une donnée qui n'existe pas.
const CARD_BACKGROUNDS = ['bg-teal-light', 'bg-mustard-light', 'bg-coral-light'];

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
  const background = CARD_BACKGROUNDS[colorIndex % CARD_BACKGROUNDS.length];

  return (
    <Pressable
      onPress={() => router.push(`/${ROUTE_BY_KIND[entry.kind]}/${entry.id}`)}
      className={`mb-3 w-[48%] rounded-2xl p-4 active:opacity-70 ${background}`}
    >
      <View className="mb-3 h-12 w-12 items-center justify-center rounded-full bg-white/70">
        {entry.photo_url ? (
          <Image source={{ uri: entry.photo_url }} style={{ width: 48, height: 48, borderRadius: 24 }} />
        ) : (
          <Icon
            name={entry.kind === 'emplacement' ? getEmplacementIcon(entry.preset_key) : entry.kind}
            size={22}
            color="#2D2A26"
          />
        )}
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
