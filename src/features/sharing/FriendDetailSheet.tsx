import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { BottomSheetModal } from '../../components/BottomSheetModal';
import { Button } from '../../components/Button';
import { EntityRow } from '../../components/EntityRow';
import { confirmDelete } from '../../lib/confirmDelete';
import type { HabitationPermission } from '../../types/database';
import { useSession } from '../auth/SessionProvider';
import { getHabitationIcon } from '../inventory/constants';
import { useHabitations } from '../inventory/queries';
import { useFriendCategories, useFriendCategoryMembers, useMoveFriendToCategory } from './categories';
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
  const { data: categories } = useFriendCategories();
  const { data: membership } = useFriendCategoryMembers();
  const moveToCategory = useMoveFriendToCategory();

  if (!friend) return null;

  const currentCategoryId = membership?.get(friend.otherUserId) ?? null;

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
      sheetClassName="rounded-t-3xl bg-surface px-6 pt-6"
      sheetStyle={{ maxHeight: '80%' }}
    >
      <Text className="mb-1 text-heading font-bold text-ink">{friend.otherDisplayName || friend.otherFriendCode}</Text>
      <Text className="mb-4 text-caption text-ink-soft">{friend.otherFriendCode}</Text>

      {/* `flexShrink: 1` et SURTOUT PAS `flex: 1` — les deux extrêmes cassent,
          chacun à sa façon, et ce composant les a connus tous les deux :
          - sans rien : le ScrollView ne se borne pas et déborde sous les
            boutons natifs, "Retirer cet ami" devient inatteignable (retour
            utilisateur du 2026-08-18) ;
          - avec `flex: 1` : `flexBasis` passe à 0, donc le ScrollView ne
            compte plus dans la hauteur mesurée du parent. Or ce parent
            (la feuille) n'a qu'un `maxHeight`, pas de hauteur définie : sa
            hauteur vient de son contenu, il n'y a donc aucun espace libre à
            distribuer et l'enfant reste à 0. Résultat observé sur appareil :
            une pop-up minuscule ne montrant que le nom et le code, tous les
            réglages de partage invisibles (retour utilisateur du
            2026-08-19). ATTENTION, ce cas ne se reproduit PAS dans l'aperçu
            web : react-native-web utilise la flexbox CSS, qui dimensionne ce
            même parent en max-content et donne au ScrollView une hauteur non
            nulle, là où Yoga le laisse à 0.
          `flexShrink: 1` garde `flexBasis: auto` : le ScrollView est mesuré
          à la taille de son contenu (donc visible), et rétrécit seulement
          quand la feuille atteint son maxHeight (donc il défile). */}
      <ScrollView style={{ flexShrink: 1 }} contentContainerClassName="pb-6">
        {sharedByFriend && sharedByFriend.length > 0 ? (
          <View className="mb-6">
            <Text className="mb-3 text-label font-medium text-ink-soft">{t('friends.detail.shared_with_me')}</Text>
            {/* Les MÊMES rangées que la page Habitations, et non plus les
                tuiles en grille d'avant : une Habitation doit avoir la même
                tête partout dans l'app, qu'on la croise chez soi ou dans la
                fiche de l'ami qui l'a partagée. */}
            {sharedByFriend.map((h) => (
              <EntityRow
                key={h.id}
                level="habitation"
                icon={getHabitationIcon(h.type)}
                title={h.name}
                subtitle={t(`inventory.habitationTypes.${h.type}`)}
                photoUri={h.photo_url}
                onPress={() => handleOpenSharedHabitation(h.id)}
              />
            ))}
          </View>
        ) : null}

        {/* Le rangement d'abord : c'est le geste léger et fréquent, alors
            que les droits d'accès en dessous sont la partie sérieuse. Les
            catégories ne changent RIEN aux accès — les deux blocs sont
            volontairement séparés pour qu'on ne les confonde pas. */}
        <Text className="mb-2 text-label font-medium text-ink-soft">{t('friends.categories.move_title')}</Text>
        <View className="mb-6 flex-row flex-wrap gap-2">
          {(categories ?? []).map((category) => {
            const selected = currentCategoryId === category.id;
            return (
              <Pressable
                key={category.id}
                onPress={() => moveToCategory.mutate({ friendUserId: friend.otherUserId, categoryId: category.id })}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                className={`rounded-full border px-4 py-2 active:opacity-70 ${
                  selected ? 'border-2 border-coral bg-coral-light' : 'border-ink/10 bg-surface'
                }`}
              >
                <Text className={selected ? 'text-label font-semibold text-coral-dark' : 'text-label text-ink-soft'}>
                  {category.name}
                </Text>
              </Pressable>
            );
          })}

          {/* « Sans catégorie » est toujours proposé, y compris quand aucune
              catégorie n'existe : c'est la seule façon de faire ressortir un
              ami d'une catégorie. */}
          <Pressable
            onPress={() => moveToCategory.mutate({ friendUserId: friend.otherUserId, categoryId: null })}
            accessibilityRole="button"
            accessibilityState={{ selected: currentCategoryId === null }}
            className={`rounded-full border px-4 py-2 active:opacity-70 ${
              currentCategoryId === null ? 'border-2 border-coral bg-coral-light' : 'border-ink/10 bg-surface'
            }`}
          >
            <Text className={currentCategoryId === null ? 'text-label font-semibold text-coral-dark' : 'text-label text-ink-soft'}>
              {t('friends.categories.move_none')}
            </Text>
          </Pressable>
        </View>

        <Text className="mb-3 text-label font-medium text-ink-soft">{t('friends.detail.shared_habitations')}</Text>
        {myHabitations.length === 0 ? (
          <Text className="mb-4 text-label text-ink-soft">{t('friends.detail.no_habitations')}</Text>
        ) : (
          myHabitations.map((h) => (
            <View key={h.id} className="mb-4">
              <Text className="mb-1.5 text-label text-ink">{h.name}</Text>
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
