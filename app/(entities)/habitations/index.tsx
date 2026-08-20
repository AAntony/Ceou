import { Stack, router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { CreateEntityModal } from '../../../src/components/CreateEntityModal';
import { EmptyState } from '../../../src/components/EmptyState';
import { EntityCard } from '../../../src/components/EntityCard';
import { EntityGrid } from '../../../src/components/EntityGrid';
import { ErrorState } from '../../../src/components/ErrorState';
import { HeaderAddButton } from '../../../src/components/HeaderAddButton';
import { SegmentedTabs } from '../../../src/components/SegmentedTabs';
import { PresetPicker } from '../../../src/components/PresetPicker';
import { useIsAnonymous, useSession } from '../../../src/features/auth/SessionProvider';
import { HABITATION_TYPES, getHabitationIcon, type HabitationTypeKey } from '../../../src/features/inventory/constants';
import { GuestHabitationSection } from '../../../src/features/inventory/GuestHabitationSection';
import {
  useCreateHabitation,
  useDeleteHabitation,
  useHabitationFavorites,
  useHabitations,
  useToggleHabitationFavorite,
  useUpdateHabitation,
} from '../../../src/features/inventory/queries';
import { HUE_BADGE_FILL, HUE_CARD_BG_HEX } from '../../../src/features/search/palette';
import { useFriendships } from '../../../src/features/sharing/queries';
import { confirmDelete } from '../../../src/lib/confirmDelete';
import type { Habitation } from '../../../src/types/database';

type Tab = 'personal' | 'shared';

export default function HabitationsScreen() {
  const { t } = useTranslation();
  const { session } = useSession();
  const { data: habitations, isLoading, isError, refetch } = useHabitations();
  const { data: favorites } = useHabitationFavorites();
  const toggleFavorite = useToggleHabitationFavorite();
  const { data: friendships } = useFriendships();
  const createHabitation = useCreateHabitation();
  const updateHabitation = useUpdateHabitation();
  const deleteHabitation = useDeleteHabitation();
  const isGuest = useIsAnonymous();
  const [tab, setTab] = useState<Tab>('personal');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingHabitation, setEditingHabitation] = useState<Habitation | null>(null);
  const [type, setType] = useState<HabitationTypeKey>('maison');
  const [name, setName] = useState('');

  const favoriteIds = new Set((favorites ?? []).map((f) => f.habitation_id));
  // Ciblé sur l'Habitation réellement en cours de bascule (et pas sur
  // `isPending` seul) : une seule étoile se verrouille, pas toute la grille.
  const isFavoritePending = (habitationId: string) =>
    toggleFavorite.isPending && toggleFavorite.variables?.habitationId === habitationId;
  const myHabitations = (habitations ?? []).filter((h) => h.user_id === session?.user.id);
  // Un visiteur ne possede aucune habitation : tout ce que la RLS lui renvoie
  // est, par construction, ce qui lui a ete partage via son code.
  const guestHabitations = habitations ?? [];
  const acceptedFriends = (friendships ?? [])
    .filter((f) => f.status === 'accepted')
    .sort((a, b) => (a.otherDisplayName || a.otherFriendCode).localeCompare(b.otherDisplayName || b.otherFriendCode));

  const handleDelete = (id: string) => {
    confirmDelete(t, 'inventory.habitations.delete_confirm_title', 'inventory.habitations.delete_confirm_message', () =>
      deleteHabitation.mutate(id),
    );
  };

  const openCreate = () => {
    setEditingHabitation(null);
    setType('maison');
    setName(t('inventory.habitationTypes.maison'));
    setModalOpen(true);
  };

  const openEdit = (habitation: Habitation) => {
    setEditingHabitation(habitation);
    setType(habitation.type as HabitationTypeKey);
    setName(habitation.name);
    setModalOpen(true);
  };

  // Le préremplissage nom <- catégorie n'a lieu qu'à la création : en
  // édition, écraser un nom déjà personnalisé au moindre changement de
  // catégorie serait une perte de donnée, pas un raccourci.
  const handleSelectType = (key: HabitationTypeKey) => {
    setType(key);
    if (!editingHabitation) setName(t(`inventory.habitationTypes.${key}`));
  };

  const isPersonalEmpty = !isLoading && myHabitations.length === 0;

  const openFriendHabitations = (friendId: string, friendName: string) => {
    router.push(`/friend-habitations/${friendId}?friendName=${encodeURIComponent(friendName)}`);
  };

  return (
    <>
      {/* Atteint uniquement via le bouton "Habitations" de la barre du bas,
          jamais poussé depuis un autre écran de cette pile — la flèche de
          retour native n'a donc aucune destination pertinente ("précédent"
          n'existe pas dans ce modèle de navigation, seuls Céoù/Profil le
          sont, déjà dans la barre du bas). */}
      <Stack.Screen
        options={{
          title: t('inventory.habitations.title'),
          headerBackVisible: false,
          // Seul l'onglet Personnelles peut recevoir une creation : l'onglet
          // Partagees liste des amis, pas des habitations a soi.
          headerRight: () =>
            tab === 'personal' && !isGuest ? (
              <HeaderAddButton onPress={openCreate} label={t('inventory.habitations.add')} />
            ) : null,
        }}
      />
      <View className="flex-1 bg-sand">
        <ScrollView contentContainerClassName="px-6 pb-28 pt-4">
          {/* Un visiteur ne voit ni onglets ni creation : les deux onglets lui
              seraient vides par construction (il ne possede rien et n’a aucun
              ami). Il voit directement ce a quoi son code lui donne acces. */}
          {isGuest ? (
            isError ? (
              <ErrorState onRetry={() => refetch()} />
            ) : guestHabitations.length === 0 ? (
              <EmptyState icon="home" title={t('guest.no_habitation')} />
            ) : (
              guestHabitations.map((habitation) => (
                <GuestHabitationSection key={habitation.id} habitation={habitation} />
              ))
            )
          ) : (
            <>
          <SegmentedTabs
            options={[
              { value: 'personal', label: t('inventory.habitations.tab_personal') },
              { value: 'shared', label: t('inventory.habitations.tab_shared') },
            ]}
            value={tab}
            onChange={setTab}
          />

          {tab === 'personal' ? (
            // L'échec passe AVANT l'état vide : sans lui, une lecture ratée
            // affichait "Aucune habitation", ce qui laisse croire à une perte
            // de données alors que rien n'a été lu.
            isError ? (
              <ErrorState onRetry={() => refetch()} />
            ) : isPersonalEmpty ? (
              <EmptyState icon="home" title={t('inventory.habitations.empty')} />
            ) : (
              <EntityGrid>
                {myHabitations.map((habitation) => (
                  <EntityCard
                    key={habitation.id}
                    icon={getHabitationIcon(habitation.type)}
                    title={habitation.name}
                    subtitle={t(`inventory.habitationTypes.${habitation.type}`)}
                    bgColor={HUE_CARD_BG_HEX.teal}
                    badgeColor={HUE_BADGE_FILL.teal}
                    onPress={() => router.push(`/habitation/${habitation.id}`)}
                    onLongPress={() => handleDelete(habitation.id)}
                    onEdit={() => openEdit(habitation)}
                    isFavorite={favoriteIds.has(habitation.id)}
                    onToggleFavorite={() => toggleFavorite.mutate({ habitationId: habitation.id, isFavorite: favoriteIds.has(habitation.id) })}
                    favoriteDisabled={isFavoritePending(habitation.id)}
                  />
                ))}
              </EntityGrid>
            )
          ) : acceptedFriends.length === 0 ? (
            <EmptyState icon="friends" title={t('friends.empty')} />
          ) : (
            <EntityGrid>
              {acceptedFriends.map((f) => (
                <EntityCard
                  key={f.id}
                  icon="profile"
                  imageUri={f.otherAvatarUrl}
                  title={f.otherDisplayName || f.otherFriendCode}
                  onPress={() => openFriendHabitations(f.otherUserId, f.otherDisplayName || f.otherFriendCode)}
                />
              ))}
            </EntityGrid>
          )}
            </>
          )}
        </ScrollView>

        <CreateEntityModal
          visible={modalOpen}
          title={editingHabitation ? t('inventory.habitations.edit_title') : t('inventory.habitations.create_title')}
          nameLabel={t('inventory.habitations.name_label')}
          submitLabel={t('common.save')}
          cancelLabel={t('common.cancel')}
          name={name}
          onNameChange={setName}
          loading={createHabitation.isPending || updateHabitation.isPending}
          onClose={() => setModalOpen(false)}
          onSubmit={async (submittedName) => {
            const definition = HABITATION_TYPES.find((h) => h.key === type)!;
            if (editingHabitation) {
              await updateHabitation.mutateAsync({ id: editingHabitation.id, name: submittedName, type, icon: definition.icon });
            } else {
              await createHabitation.mutateAsync({ name: submittedName, type, icon: definition.icon });
            }
            setModalOpen(false);
          }}
        >
          <PresetPicker
            presets={HABITATION_TYPES}
            selectedKey={type}
            onSelect={(key) => handleSelectType(key as HabitationTypeKey)}
            labelFor={(key) => t(`inventory.habitationTypes.${key}`)}
          />
        </CreateEntityModal>
      </View>
    </>
  );
}
