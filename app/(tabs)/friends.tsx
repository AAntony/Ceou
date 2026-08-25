import { useFocusEffect, useNavigation } from 'expo-router';
import { useCallback, useLayoutEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { EmptyState } from '../../src/components/EmptyState';
import { ErrorState } from '../../src/components/ErrorState';
import { HeaderAddButton } from '../../src/components/HeaderAddButton';
import { Icon } from '../../src/components/Icon';
import { usePullToRefresh } from '../../src/components/usePullToRefresh';
import { AddFriendModal } from '../../src/features/sharing/AddFriendModal';
import {
  buildFriendSections,
  useFriendCategories,
  useFriendCategoryMembers,
  useFriendSharedHabitationCounts,
  type FriendCategory,
} from '../../src/features/sharing/categories';
import { FriendCategorySheet } from '../../src/features/sharing/FriendCategorySheet';
import { FriendDetailSheet } from '../../src/features/sharing/FriendDetailSheet';
import { FriendRow } from '../../src/features/sharing/FriendRow';
import { type FriendshipEntry, useCancelFriendRequest, useFriendships, useRespondToFriendship } from '../../src/features/sharing/queries';
import { useThemeColors } from '../../src/lib/theme';

export default function FriendsScreen() {
  const refreshControl = usePullToRefresh();
  const colors = useThemeColors();
  const { t } = useTranslation();
  const { data: friendships, isLoading, isError, refetch } = useFriendships();

  // L'onglet reste MONTÉ quand on le quitte : sans ce rappel, revenir dessus
  // ne redemande rien et on relit l'état d'il y a une heure. C'est l'écran de
  // l'app dont le contenu dépend le plus de ce que font les autres — une
  // demande reçue, un ami qui vous retire — donc celui où une liste périmée
  // se remarque le plus.
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );
  const respond = useRespondToFriendship();
  const cancelRequest = useCancelFriendRequest();

  const { data: categories } = useFriendCategories();
  const { data: membership } = useFriendCategoryMembers();
  const { data: sharedCounts } = useFriendSharedHabitationCounts();

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<FriendshipEntry | null>(null);
  // `undefined` = feuille fermee ; `null` = creation ; une categorie =
  // modification. Un seul etat plutot que deux booleens, les trois cas
  // s'excluent.
  const [categorySheet, setCategorySheet] = useState<FriendCategory | null | undefined>(undefined);

  const navigation = useNavigation();
  const openAddModal = useCallback(() => setAddModalOpen(true), []);
  // Le bouton est posé sur l'en-tête natif déclaré par (tabs)/_layout.tsx.
  // Il ne peut pas l'être depuis le layout, qui n'a pas accès à l'état de la
  // modale ; useLayoutEffect plutôt que useEffect pour qu'il soit peint dans
  // la même frame que l'écran, sans apparition différée.
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => <HeaderAddButton onPress={openAddModal} label={t('friends.add.entry')} />,
    });
  }, [navigation, openAddModal, t]);

  const incoming = (friendships ?? []).filter((f) => f.status === 'pending' && f.direction === 'incoming');
  const outgoing = (friendships ?? []).filter((f) => f.status === 'pending' && f.direction === 'outgoing');
  const accepted = (friendships ?? []).filter((f) => f.status === 'accepted');

  // Les catégories ne sont QU'UN RANGEMENT : elles n'existent que dans cette
  // liste, l'ami concerné ne les voit pas et elles ne changent rien à qui a
  // accès à quoi. À ne pas confondre avec les Groupes retirés le 17/08, qui
  // étaient eux une unité de partage traversant la RLS.
  const sections = buildFriendSections(accepted, categories ?? [], membership ?? new Map());

  // Le zéro est traité à part : le français range 0 avec le singulier, donc
  // une pluralisation seule afficherait « Vous partagez 1 habitation ».
  const sharedLabel = (friendUserId: string) => {
    if (!sharedCounts) return undefined;
    const count = sharedCounts.get(friendUserId) ?? 0;
    return count === 0 ? t('friends.shared_count_zero') : t('friends.shared_count', { count });
  };

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
      {/* Mêmes retraits que app/(entities)/habitations/index.tsx : le titre
          et le bouton d'ajout vivent maintenant dans l'en-tête natif, donc
          plus de pt-16 pour compenser son absence. */}
      <ScrollView className="flex-1 bg-sand" contentContainerClassName="px-6 pb-28 pt-4" refreshControl={refreshControl}>
        {incoming.length > 0 ? (
          <View className="mb-6">
            <Text className="mb-2 text-label font-medium text-ink-soft">{t('friends.requests.incoming_title')}</Text>
            {incoming.map((f) => (
              <View key={f.id} className="mb-2 flex-row items-center justify-between rounded-xl border border-coral/30 bg-coral-light px-4 py-3">
                <Text numberOfLines={1} className="flex-1 pr-2 text-label font-medium text-ink">
                  {f.otherDisplayName || f.otherFriendCode}
                </Text>
                <View className="flex-row gap-3">
                  {/* Deux icônes que seule la COULEUR distinguait — coche
                      verte contre croix grise. Sans libellé, rien ne disait
                      laquelle accepte, pour une action irréversible. */}
                  <Pressable
                    onPress={() => respond.mutate({ friendshipId: f.id, accept: true })}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={t('a11y.accept_friend', { name: f.otherDisplayName || f.otherFriendCode })}
                  >
                    <Icon name="included" size={24} color="#4CAF50" />
                  </Pressable>
                  <Pressable
                    onPress={() => respond.mutate({ friendshipId: f.id, accept: false })}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={t('a11y.decline_friend', { name: f.otherDisplayName || f.otherFriendCode })}
                  >
                    <Icon name="close" size={24} color={colors.inkFaint} />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {outgoing.length > 0 ? (
          <View className="mb-6">
            <Text className="mb-2 text-label font-medium text-ink-soft">{t('friends.requests.outgoing_title')}</Text>
            {outgoing.map((f) => (
              <View key={f.id} className="mb-2 flex-row items-center justify-between rounded-xl border border-ink/10 px-4 py-3">
                <Text numberOfLines={1} className="flex-1 pr-2 text-label text-ink">
                  {f.otherDisplayName || f.otherFriendCode}
                </Text>
                <Pressable onPress={() => cancelRequest.mutate(f.id)} hitSlop={8} accessibilityRole="button">
                  <Text className="text-caption font-semibold text-ink-soft">{t('friends.requests.cancel')}</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        {accepted.length === 0 && incoming.length === 0 && outgoing.length === 0 ? (
          <EmptyState icon="friends" title={t('friends.empty')} />
        ) : null}

        {sections.map((section) => (
          <View key={section.category?.id ?? 'unfiled'} className="mb-5">
            <View className="mb-2 flex-row items-center gap-2">
              {/* `label` et non `caption` : c'est le sommaire de l'ecran,
                  il etait jusqu'ici son texte le plus petit. */}
              <Text numberOfLines={1} className="shrink text-label font-semibold uppercase tracking-wide text-ink-soft">
                {section.category?.name ?? t('friends.unfiled')}
              </Text>
              <View className="rounded-full bg-ink/5 px-2 py-0.5">
                <Text className="text-label text-ink-soft">{section.friends.length}</Text>
              </View>
              <View className="flex-1" />
              {/* Pas de menu sur « Sans catégorie » : ce n'est pas une
                  catégorie mais l'absence de rangement — rien à renommer ni
                  à supprimer. */}
              {section.category ? (
                <Pressable
                  onPress={() => setCategorySheet(section.category)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={t('a11y.category_options', { name: section.category.name })}
                  className="rounded-full border border-ink/10 p-1.5 active:opacity-60"
                >
                  <Icon name="dots" size={20} color={colors.inkSoft} />
                </Pressable>
              ) : null}
            </View>

            {/* Une catégorie vide reste affichée : elle vient d'être créée,
                la faire disparaître ferait croire à un échec. */}
            {section.friends.length === 0 ? (
              <Text className="mb-1 text-caption text-ink-soft">{t('friends.categories.empty_hint')}</Text>
            ) : (
              section.friends.map((f) => (
                <FriendRow
                  key={f.id}
                  id={f.otherUserId}
                  name={f.otherDisplayName || f.otherFriendCode}
                  subtitle={sharedLabel(f.otherUserId)}
                  avatarUrl={f.otherAvatarUrl}
                  onPress={() => setSelectedFriend(f)}
                />
              ))
            )}
          </View>
        ))}

        {accepted.length > 0 || (categories ?? []).length > 0 ? (
          <Pressable
            onPress={() => setCategorySheet(null)}
            accessibilityRole="button"
            className="mb-6 flex-row items-center justify-center gap-2 rounded-2xl border border-dashed border-ink/25 px-3 py-3.5 active:opacity-70"
          >
            <Icon name="add" size={20} color={colors.accent} />
            <Text className="shrink text-body font-semibold text-coral">{t('friends.categories.new')}</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <AddFriendModal visible={addModalOpen} onClose={() => setAddModalOpen(false)} />
      <FriendCategorySheet
        visible={categorySheet !== undefined}
        category={categorySheet ?? null}
        onClose={() => setCategorySheet(undefined)}
      />
      <FriendDetailSheet friend={selectedFriend} onClose={() => setSelectedFriend(null)} />
    </>
  );
}
