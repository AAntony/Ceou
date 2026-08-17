import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Button } from '../../src/components/Button';
import { EmptyState } from '../../src/components/EmptyState';
import { EntityCard } from '../../src/components/EntityCard';
import { EntityGrid } from '../../src/components/EntityGrid';
import { Icon } from '../../src/components/Icon';
import { AddFriendModal } from '../../src/features/sharing/AddFriendModal';
import { FriendDetailSheet } from '../../src/features/sharing/FriendDetailSheet';
import { GroupManagerSheet } from '../../src/features/sharing/GroupManagerSheet';
import {
  type FriendshipEntry,
  useAllGroupMemberships,
  useCancelFriendRequest,
  useFriendGroups,
  useFriendships,
  useRespondToFriendship,
} from '../../src/features/sharing/queries';

export default function FriendsScreen() {
  const { t } = useTranslation();
  const { data: friendships, isLoading } = useFriendships();
  const { data: groups } = useFriendGroups();
  const { data: memberships } = useAllGroupMemberships();
  const respond = useRespondToFriendship();
  const cancelRequest = useCancelFriendRequest();

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [groupManagerOpen, setGroupManagerOpen] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<FriendshipEntry | null>(null);

  const incoming = (friendships ?? []).filter((f) => f.status === 'pending' && f.direction === 'incoming');
  const outgoing = (friendships ?? []).filter((f) => f.status === 'pending' && f.direction === 'outgoing');
  const accepted = (friendships ?? []).filter((f) => f.status === 'accepted');

  const groupIdsByFriend = useMemo(() => {
    const map = new Map<string, string[]>();
    (memberships ?? []).forEach((m) => {
      const list = map.get(m.friendUserId) ?? [];
      list.push(m.groupId);
      map.set(m.friendUserId, list);
    });
    return map;
  }, [memberships]);

  const grouped = (groups ?? [])
    .map((g) => ({ group: g, friends: accepted.filter((f) => (groupIdsByFriend.get(f.otherUserId) ?? []).includes(g.id)) }))
    .filter((section) => section.friends.length > 0);

  const hasGroups = (groups ?? []).length > 0;
  const ungrouped = hasGroups ? accepted.filter((f) => (groupIdsByFriend.get(f.otherUserId) ?? []).length === 0) : accepted;

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
        <View className="mb-6 flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-ink">{t('friends.tab_title')}</Text>
          <Pressable onPress={() => setGroupManagerOpen(true)} hitSlop={8} className="h-10 w-10 items-center justify-center rounded-full bg-white">
            <Icon name="group" size={20} color="#2D2A26" />
          </Pressable>
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

        {grouped.map(({ group, friends }) => (
          <View key={group.id} className="mb-6">
            <Text className="mb-2 text-sm font-medium text-ink-soft">{group.name}</Text>
            <EntityGrid>
              {friends.map((f) => (
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
        ))}

        {ungrouped.length > 0 ? (
          <View className="mb-6">
            <Text className="mb-2 text-sm font-medium text-ink-soft">{hasGroups ? t('friends.ungrouped_title') : t('friends.list_title')}</Text>
            <EntityGrid>
              {ungrouped.map((f) => (
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
      <GroupManagerSheet visible={groupManagerOpen} onClose={() => setGroupManagerOpen(false)} />
      <FriendDetailSheet friend={selectedFriend} onClose={() => setSelectedFriend(null)} />
    </>
  );
}
