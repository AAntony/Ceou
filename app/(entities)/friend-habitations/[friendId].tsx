import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { EmptyState } from '../../../src/components/EmptyState';
import { EntityCard } from '../../../src/components/EntityCard';
import { EntityGrid } from '../../../src/components/EntityGrid';
import { getHabitationIcon } from '../../../src/features/inventory/constants';
import { useHabitationFavorites, useToggleHabitationFavorite } from '../../../src/features/inventory/queries';
import { HUE_BADGE_FILL, HUE_CARD_BG_HEX } from '../../../src/features/search/palette';
import { useHabitationsSharedByFriend } from '../../../src/features/sharing/queries';

// Porte d'entrée équivalente à la section "Partagé avec moi" de
// FriendDetailSheet.tsx (conservée telle quelle, toujours utile depuis
// l'onglet Amis) — celle-ci part de l'onglet "Partagées" de l'écran
// Habitations. friendName vient en query param (comme highlightFormeId sur
// plan/[id].tsx) pour titrer l'écran sans requête réseau supplémentaire.
export default function FriendHabitationsScreen() {
  const { t } = useTranslation();
  const { friendId, friendName } = useLocalSearchParams<{ friendId: string; friendName?: string }>();
  const { data: habitations, isLoading } = useHabitationsSharedByFriend(friendId);
  const { data: favorites } = useHabitationFavorites();
  const toggleFavorite = useToggleHabitationFavorite();

  const favoriteIds = new Set((favorites ?? []).map((f) => f.habitation_id));
  const isEmpty = !isLoading && (habitations?.length ?? 0) === 0;

  return (
    <>
      <Stack.Screen options={{ title: friendName || t('friends.detail.shared_with_me') }} />
      <View className="flex-1 bg-sand">
        <ScrollView contentContainerClassName="px-6 pb-12 pt-4">
          {isEmpty ? (
            <EmptyState icon="home" title={t('friends.detail.friend_no_shared')} />
          ) : (
            <EntityGrid>
              {habitations?.map((h) => (
                <EntityCard
                  key={h.id}
                  icon={getHabitationIcon(h.type)}
                  title={h.name}
                  subtitle={t(`inventory.habitationTypes.${h.type}`)}
                  bgColor={HUE_CARD_BG_HEX.teal}
                  badgeColor={HUE_BADGE_FILL.teal}
                  onPress={() => router.push(`/habitation/${h.id}`)}
                  isFavorite={favoriteIds.has(h.id)}
                  onToggleFavorite={() => toggleFavorite.mutate({ habitationId: h.id, isFavorite: favoriteIds.has(h.id) })}
                />
              ))}
            </EntityGrid>
          )}
        </ScrollView>
      </View>
    </>
  );
}
