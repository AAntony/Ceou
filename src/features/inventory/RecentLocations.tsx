import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import type { LocationType } from '../../types/database';
import { useSession } from '../auth/SessionProvider';
import { useSearchIndex, type SearchIndexEntry } from '../search/queries';
import { canModify, useHabitationPermission } from '../sharing/queries';

type RecentLocation = { type: LocationType; id: string };

export function useRecentLocations() {
  const { session } = useSession();
  const client = useQueryClient();
  const key = ['recentLocations', session?.user.id];
  // Device history is persisted by the existing query persister and cleared on sign-out.
  const { data = [] } = useQuery<RecentLocation[]>({ queryKey: key, enabled: false, initialData: [] });
  const remember = (type: LocationType, id: string) => {
    if (!session) return;
    client.setQueryData<RecentLocation[]>(key, (previous = []) => [{ type, id }, ...previous.filter((item) => item.id !== id || item.type !== type)].slice(0, 5));
  };
  return { recent: data, remember };
}

function RecentLocationButton({ entry, onSelect }: { entry: SearchIndexEntry; onSelect: (type: LocationType, id: string, name: string) => void }) {
  const { data: permission } = useHabitationPermission(entry.habitation_id);
  if (!canModify(permission) || (entry.kind !== 'conteneur' && entry.kind !== 'emplacement')) return null;
  const type = entry.kind;
  return <Pressable accessibilityRole="button" onPress={() => onSelect(type, entry.id, entry.name)}
    className="mb-2 min-h-[48px] rounded-xl bg-coral-light px-4 py-3 active:opacity-70">
    <Text className="text-body font-semibold text-coral-dark">{entry.name}</Text>
    <Text className="mt-1 text-label text-ink-soft">{entry.piece_name} · {entry.habitation_name}</Text>
  </Pressable>;
}

export function RecentLocations({ onSelect }: { onSelect: (type: LocationType, id: string, name: string) => void }) {
  const { t } = useTranslation();
  const { recent } = useRecentLocations();
  const { data: index } = useSearchIndex();
  // Resolve against today's authorised index, never persisted names from a revoked place.
  const entries = recent.flatMap((item) => {
    const entry = index?.find((candidate) => candidate.id === item.id && candidate.kind === item.type);
    return entry ? [entry] : [];
  });
  if (!entries.length) return null;
  return <View className="mb-5">
    <Text accessibilityRole="header" className="mb-1 text-heading font-semibold text-ink">{t('redesign.recent')}</Text>
    <Text className="mb-3 text-label text-ink-soft">{t('redesign.recentHint')}</Text>
    {entries.map((entry) => <RecentLocationButton key={`${entry.kind}-${entry.id}`} entry={entry} onSelect={onSelect} />)}
  </View>;
}
