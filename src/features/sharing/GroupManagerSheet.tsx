import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { BottomSheetModal } from '../../components/BottomSheetModal';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { TextField } from '../../components/TextField';
import { confirmDelete } from '../../lib/confirmDelete';
import type { FriendGroup, HabitationPermission } from '../../types/database';
import { useSession } from '../auth/SessionProvider';
import { useHabitations } from '../inventory/queries';
import { PermissionPicker } from './PermissionPicker';
import {
  useAddGroupMember,
  useCreateFriendGroup,
  useDeleteFriendGroup,
  useDeleteHabitationShare,
  useFriendGroups,
  useFriendships,
  useGroupMembers,
  useRemoveGroupMember,
  useSharesForGroup,
  useUpdateFriendGroup,
  useUpsertHabitationShare,
} from './queries';

type GroupManagerSheetProps = {
  visible: boolean;
  onClose: () => void;
};

// Une seule feuille, contenu qui bascule entre la liste des groupes et le
// détail d'un groupe sélectionné — évite d'empiler un second Modal RN
// par-dessus (comportement flou avec deux fonds semi-transparents cumulés).
export function GroupManagerSheet({ visible, onClose }: GroupManagerSheetProps) {
  const { t } = useTranslation();
  const { data: groups } = useFriendGroups();
  const createGroup = useCreateFriendGroup();
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState('');

  useEffect(() => {
    if (visible) {
      setSelectedGroupId(null);
      setNewGroupName('');
    }
  }, [visible]);

  const selectedGroup = (groups ?? []).find((g) => g.id === selectedGroupId) ?? null;

  const handleCreate = async () => {
    if (!newGroupName.trim()) return;
    try {
      await createGroup.mutateAsync(newGroupName.trim());
      setNewGroupName('');
    } catch {
      Alert.alert(t('common.error_generic'));
    }
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      sheetClassName="rounded-t-3xl bg-white px-6 pt-6"
      sheetStyle={{ maxHeight: '85%' }}
    >
      {selectedGroup ? (
        <GroupDetailView group={selectedGroup} onBack={() => setSelectedGroupId(null)} onDeleted={() => setSelectedGroupId(null)} />
      ) : (
        <>
          <Text className="mb-4 text-xl font-bold text-ink">{t('friends.groups.title')}</Text>
          <ScrollView contentContainerClassName="pb-6">
            {(groups ?? []).map((g) => (
              <Pressable
                key={g.id}
                onPress={() => setSelectedGroupId(g.id)}
                className="mb-2 flex-row items-center justify-between rounded-xl border border-ink/10 px-4 py-3 active:opacity-70"
              >
                <Text className="text-base text-ink">{g.name}</Text>
                <Icon name="chevron" size={18} color="#A39C8F" />
              </Pressable>
            ))}
            {(groups ?? []).length === 0 ? <Text className="mb-2 text-sm text-ink-soft">{t('friends.groups.empty')}</Text> : null}

            <View className="mt-3 flex-row items-end gap-2">
              <View className="flex-1">
                <TextField label={t('friends.groups.name_label')} value={newGroupName} onChangeText={setNewGroupName} />
              </View>
            </View>
            <Button label={t('friends.groups.add')} variant="ghost" onPress={handleCreate} loading={createGroup.isPending} disabled={!newGroupName.trim()} />
          </ScrollView>
        </>
      )}
    </BottomSheetModal>
  );
}

function GroupDetailView({ group, onBack, onDeleted }: { group: FriendGroup; onBack: () => void; onDeleted: () => void }) {
  const { t } = useTranslation();
  const { session } = useSession();
  const [name, setName] = useState(group.name);
  const updateGroup = useUpdateFriendGroup();
  const deleteGroup = useDeleteFriendGroup();
  const { data: friendships } = useFriendships();
  const { data: memberIds } = useGroupMembers(group.id);
  const addMember = useAddGroupMember(group.id);
  const removeMember = useRemoveGroupMember(group.id);
  const { data: habitations } = useHabitations();
  const { data: shares } = useSharesForGroup(group.id);
  const upsertShare = useUpsertHabitationShare();
  const deleteShare = useDeleteHabitationShare();

  const acceptedFriends = (friendships ?? []).filter((f) => f.status === 'accepted');
  const memberIdSet = new Set(memberIds ?? []);
  const myHabitations = (habitations ?? []).filter((h) => h.user_id === session?.user.id);
  const shareByHabitation = new Map((shares ?? []).map((s) => [s.habitationId, s]));

  const handleRename = () => {
    if (!name.trim() || name.trim() === group.name) return;
    updateGroup.mutate({ id: group.id, name: name.trim() });
  };

  const handleDelete = () => {
    confirmDelete(t, 'friends.groups.delete_confirm_title', 'friends.groups.delete_confirm_message', async () => {
      await deleteGroup.mutateAsync(group.id);
      onDeleted();
    });
  };

  const handleShareChange = (habitationId: string, permission: HabitationPermission | null) => {
    const existing = shareByHabitation.get(habitationId);
    if (permission === null) {
      if (existing) deleteShare.mutate({ shareId: existing.id, habitationId, target: { groupId: group.id } });
      return;
    }
    upsertShare.mutate({ habitationId, target: { groupId: group.id }, permission });
  };

  return (
    <ScrollView keyboardShouldPersistTaps="handled">
      <Pressable onPress={onBack} hitSlop={8} className="mb-3 flex-row items-center gap-1 self-start">
        <Icon name="back" size={16} color="#6B6459" />
        <Text className="text-sm font-medium text-ink-soft">{t('common.back')}</Text>
      </Pressable>

      <TextField label={t('friends.groups.name_label')} value={name} onChangeText={setName} onBlur={handleRename} />

      <Text className="mb-2 mt-2 text-sm font-medium text-ink-soft">{t('friends.groups.members')}</Text>
      {acceptedFriends.length === 0 ? (
        <Text className="mb-4 text-sm text-ink-soft">{t('friends.groups.no_friends')}</Text>
      ) : (
        acceptedFriends.map((f) => {
          const isMember = memberIdSet.has(f.otherUserId);
          return (
            <Pressable
              key={f.id}
              onPress={() => (isMember ? removeMember.mutate(f.otherUserId) : addMember.mutate(f.otherUserId))}
              className="mb-2 flex-row items-center justify-between rounded-xl border border-ink/10 px-4 py-2.5"
            >
              <Text className="text-sm text-ink">{f.otherDisplayName || f.otherFriendCode}</Text>
              <Icon name={isMember ? 'included' : 'excluded'} size={20} color={isMember ? '#4CAF50' : '#A39C8F'} />
            </Pressable>
          );
        })
      )}

      <Text className="mb-2 mt-4 text-sm font-medium text-ink-soft">{t('friends.detail.shared_habitations')}</Text>
      {myHabitations.length === 0 ? (
        <Text className="mb-4 text-sm text-ink-soft">{t('friends.detail.no_habitations')}</Text>
      ) : (
        myHabitations.map((h) => (
          <View key={h.id} className="mb-4">
            <Text className="mb-1.5 text-sm text-ink">{h.name}</Text>
            <PermissionPicker value={shareByHabitation.get(h.id)?.permission ?? null} onChange={(perm) => handleShareChange(h.id, perm)} />
          </View>
        ))
      )}

      <View className="mb-8 mt-4">
        <Button label={t('friends.groups.delete')} variant="danger" onPress={handleDelete} />
      </View>
    </ScrollView>
  );
}
