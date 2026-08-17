import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetModal } from '../../components/BottomSheetModal';
import { Button } from '../../components/Button';
import { confirmDelete } from '../../lib/confirmDelete';
import type { HabitationPermission } from '../../types/database';
import { useSession } from '../auth/SessionProvider';
import { useHabitations } from '../inventory/queries';
import { PermissionPicker } from './PermissionPicker';
import { type FriendshipEntry, useDeleteHabitationShare, useRemoveFriend, useSharesForUser, useUpsertHabitationShare } from './queries';

type FriendDetailSheetProps = {
  friend: FriendshipEntry | null;
  onClose: () => void;
};

// Simplification v1 assumée : ne propose que MES Habitations possédées en
// direct (owner_id), pas celles où je ne suis que 'proprietaire' via un
// partage — cette dernière capacité existe déjà côté RLS/RPC (upsert_
// habitation_share vérifie can_manage_habitation_sharing, pas juste
// user_id), juste pas encore exposée dans CETTE liste. À élargir si le
// besoin de repartage en cascade se confirme.
export function FriendDetailSheet({ friend, onClose }: FriendDetailSheetProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const { data: habitations } = useHabitations();
  const { data: shares } = useSharesForUser(friend?.otherUserId);
  const upsertShare = useUpsertHabitationShare();
  const deleteShare = useDeleteHabitationShare();
  const removeFriend = useRemoveFriend();

  if (!friend) return null;

  const myHabitations = (habitations ?? []).filter((h) => h.user_id === session?.user.id);
  const shareByHabitation = new Map((shares ?? []).map((s) => [s.habitationId, s]));

  const handleChange = (habitationId: string, permission: HabitationPermission | null) => {
    const existing = shareByHabitation.get(habitationId);
    if (permission === null) {
      if (existing) deleteShare.mutate({ shareId: existing.id, habitationId });
      return;
    }
    upsertShare.mutate({ habitationId, target: { userId: friend.otherUserId }, permission });
  };

  const handleRemove = () => {
    confirmDelete(t, 'friends.detail.remove_confirm_title', 'friends.detail.remove_confirm_message', async () => {
      await removeFriend.mutateAsync(friend.otherUserId);
      onClose();
    });
  };

  return (
    <BottomSheetModal
      visible={!!friend}
      onClose={onClose}
      sheetClassName="rounded-t-3xl bg-white px-6 pt-6"
      sheetStyle={{ maxHeight: '80%' }}
    >
      <Text className="mb-1 text-xl font-bold text-ink">{friend.otherDisplayName || friend.otherFriendCode}</Text>
      <Text className="mb-4 text-xs text-ink-soft">{friend.otherFriendCode}</Text>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <Text className="mb-3 text-sm font-medium text-ink-soft">{t('friends.detail.shared_habitations')}</Text>
        {myHabitations.length === 0 ? (
          <Text className="mb-4 text-sm text-ink-soft">{t('friends.detail.no_habitations')}</Text>
        ) : (
          myHabitations.map((h) => (
            <View key={h.id} className="mb-4">
              <Text className="mb-1.5 text-sm text-ink">{h.name}</Text>
              <PermissionPicker value={shareByHabitation.get(h.id)?.permission ?? null} onChange={(perm) => handleChange(h.id, perm)} />
            </View>
          ))
        )}

        <View className="mt-2">
          <Button label={t('friends.detail.remove')} variant="ghost" onPress={handleRemove} />
        </View>
      </ScrollView>
    </BottomSheetModal>
  );
}
