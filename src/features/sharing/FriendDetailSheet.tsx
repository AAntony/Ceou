import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';
import { BottomSheetModal } from '../../components/BottomSheetModal';
import { Button } from '../../components/Button';
import { EntityCard } from '../../components/EntityCard';
import { EntityGrid } from '../../components/EntityGrid';
import { confirmDelete } from '../../lib/confirmDelete';
import { HUE_BADGE_FILL, HUE_CARD_BG_HEX } from '../search/palette';
import type { HabitationPermission } from '../../types/database';
import { useSession } from '../auth/SessionProvider';
import { getHabitationIcon } from '../inventory/constants';
import { useHabitations } from '../inventory/queries';
import { PermissionPicker } from './PermissionPicker';
import {
  type FriendshipEntry,
  useDeleteHabitationShare,
  useHabitationsSharedByFriend,
  useRemoveFriend,
  useSharesForUser,
  useUpsertHabitationShare,
} from './queries';

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
  const { session } = useSession();
  const { data: habitations } = useHabitations();
  const { data: shares } = useSharesForUser(friend?.otherUserId);
  const { data: sharedByFriend } = useHabitationsSharedByFriend(friend?.otherUserId);
  const upsertShare = useUpsertHabitationShare();
  const deleteShare = useDeleteHabitationShare();
  const removeFriend = useRemoveFriend();

  if (!friend) return null;

  const myHabitations = (habitations ?? []).filter((h) => h.user_id === session?.user.id);
  const shareByHabitation = new Map((shares ?? []).map((s) => [s.habitationId, s]));

  const handleChange = (habitationId: string, permission: HabitationPermission | null) => {
    const existing = shareByHabitation.get(habitationId);
    if (permission === null) {
      if (existing) deleteShare.mutate({ shareId: existing.id, habitationId, sharedWithUserId: friend.otherUserId });
      return;
    }
    upsertShare.mutate({ habitationId, sharedWithUserId: friend.otherUserId, permission });
  };

  const handleRemove = () => {
    confirmDelete(t, 'friends.detail.remove_confirm_title', 'friends.detail.remove_confirm_message', async () => {
      await removeFriend.mutateAsync(friend.otherUserId);
      onClose();
    });
  };

  const handleOpenSharedHabitation = (habitationId: string) => {
    onClose();
    router.push(`/habitation/${habitationId}`);
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

      {/* style flex:1 indispensable ici : sans lui, un ScrollView enfant
          direct d'un conteneur à maxHeight (pas de flex/height fixe) ne se
          borne pas et déborde du bas de l'écran au lieu de défiler en
          interne — c'est ce qui rendait "Supprimer" inatteignable derrière
          les boutons natifs quand la liste d'Habitations est longue (retour
          utilisateur du 2026-08-18). */}
      <ScrollView style={{ flex: 1 }} contentContainerClassName="pb-6">
        {sharedByFriend && sharedByFriend.length > 0 ? (
          <View className="mb-6">
            <Text className="mb-3 text-sm font-medium text-ink-soft">{t('friends.detail.shared_with_me')}</Text>
            <EntityGrid>
              {sharedByFriend.map((h) => (
                <EntityCard
                  key={h.id}
                  icon={getHabitationIcon(h.type)}
                  title={h.name}
                  subtitle={t(`inventory.habitationTypes.${h.type}`)}
                  bgColor={HUE_CARD_BG_HEX.teal}
                  badgeColor={HUE_BADGE_FILL.teal}
                  onPress={() => handleOpenSharedHabitation(h.id)}
                />
              ))}
            </EntityGrid>
          </View>
        ) : null}

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

        <View className="mb-2 mt-4 items-center">
          <Button label={t('friends.detail.remove')} variant="danger" onPress={handleRemove} />
        </View>
      </ScrollView>
    </BottomSheetModal>
  );
}
