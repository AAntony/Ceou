import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Button } from '../../src/components/Button';
import { EmptyState } from '../../src/components/EmptyState';
import { EntityCard } from '../../src/components/EntityCard';
import { EntityGrid } from '../../src/components/EntityGrid';
import { ErrorState } from '../../src/components/ErrorState';
import { Icon } from '../../src/components/Icon';
import { AddFriendModal } from '../../src/features/sharing/AddFriendModal';
import { FriendDetailSheet } from '../../src/features/sharing/FriendDetailSheet';
import { type FriendshipEntry, useCancelFriendRequest, useFriendships, useRespondToFriendship } from '../../src/features/sharing/queries';

export default function FriendsScreen() {
  const { t } = useTranslation();
  const { data: friendships, isLoading, isError, refetch } = useFriendships();
  const respond = useRespondToFriendship();
  const cancelRequest = useCancelFriendRequest();

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<FriendshipEntry | null>(null);

  const incoming = (friendships ?? []).filter((f) => f.status === 'pending' && f.direction === 'incoming');
  const outgoing = (friendships ?? []).filter((f) => f.status === 'pending' && f.direction === 'outgoing');
  // Groupes retirés (Phase 9a) : plus de sections par groupe, une seule
  // liste triée alphabétiquement — même liste réutilisée par l'onglet
  // "Partagées" de l'écran Habitations (Phase 9c).
  const accepted = (friendships ?? [])
    .filter((f) => f.status === 'accepted')
    .sort((a, b) => (a.otherDisplayName || a.otherFriendCode).localeCompare(b.otherDisplayName || b.otherFriendCode));

  if (isError) {
    return (
      <View className="flex-1 bg-sand">
        <ErrorState onRetry={() => refetch()} />
      </View>
    );
  }

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-sand">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <>
      <ScrollView className="flex-1 bg-sand" contentContainerClassName="px-6 pb-40 pt-16">
        <View className="mb-6">
          <Text className="text-2xl font-bold text-ink">{t('friends.tab_title')}</Text>
        </View>

        <View className="mb-6">
          <Button label={t('friends.add.entry')} onPress={() => setAddModalOpen(true)} />
        </View>

        {incoming.length > 0 ? (
          <View className="mb-6">
            <Text className="mb-2 text-sm font-medium text-ink-soft">{t('friends.requests.incoming_title')}</Text>
            {incoming.map((f) => (
              <View key={f.id} className="mb-2 flex-row items-center justify-between rounded-xl border border-coral/30 bg-coral-light px-4 py-3">
                <Text numberOfLines={1} className="flex-1 pr-2 text-sm font-medium text-ink">
                  {f.otherDisplayName || f.otherFriendCode}
                </Text>
                <View className="flex-row gap-3">
                  <Pressable onPress={() => respond.mutate({ friendshipId: f.id, accept: true })} hitSlop={8}>
                    <Icon name="included" size={24} color="#4CAF50" />
                  </Pressable>
                  <Pressable onPress={() => respond.mutate({ friendshipId: f.id, accept: false })} hitSlop={8}>
                    <Icon name="close" size={24} color="#A39C8F" />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {outgoing.length > 0 ? (
          <View className="mb-6">
            <Text className="mb-2 text-sm font-medium text-ink-soft">{t('friends.requests.outgoing_title')}</Text>
            {outgoing.map((f) => (
              <View key={f.id} className="mb-2 flex-row items-center justify-between rounded-xl border border-ink/10 px-4 py-3">
                <Text numberOfLines={1} className="flex-1 pr-2 text-sm text-ink">
                  {f.otherDisplayName || f.otherFriendCode}
                </Text>
                <Pressable onPress={() => cancelRequest.mutate(f.id)} hitSlop={8}>
                  <Text className="text-xs font-semibold text-ink-soft">{t('friends.requests.cancel')}</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        {accepted.length === 0 && incoming.length === 0 && outgoing.length === 0 ? (
          <EmptyState icon="friends" title={t('friends.empty')} />
        ) : null}

        {accepted.length > 0 ? (
          <View className="mb-6">
            <Text className="mb-2 text-sm font-medium text-ink-soft">{t('friends.list_title')}</Text>
            <EntityGrid>
              {accepted.map((f) => (
                <EntityCard
                  key={f.id}
                  icon="profile"
                  imageUri={f.otherAvatarUrl}
                  title={f.otherDisplayName || f.otherFriendCode}
                  onPress={() => setSelectedFriend(f)}
                />
              ))}
            </EntityGrid>
          </View>
        ) : null}
      </ScrollView>

      <AddFriendModal visible={addModalOpen} onClose={() => setAddModalOpen(false)} />
      <FriendDetailSheet friend={selectedFriend} onClose={() => setSelectedFriend(null)} />
    </>
  );
}
