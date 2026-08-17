import { Stack, router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { BottomActionBar } from '../../../src/components/BottomActionBar';
import { Button } from '../../../src/components/Button';
import { CreateEntityModal } from '../../../src/components/CreateEntityModal';
import { EmptyState } from '../../../src/components/EmptyState';
import { EntityCard } from '../../../src/components/EntityCard';
import { EntityGrid } from '../../../src/components/EntityGrid';
import { PresetPicker } from '../../../src/components/PresetPicker';
import { useSession } from '../../../src/features/auth/SessionProvider';
import { HABITATION_TYPES, getHabitationIcon, type HabitationTypeKey } from '../../../src/features/inventory/constants';
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
  const { data: habitations, isLoading } = useHabitations();
  const { data: favorites } = useHabitationFavorites();
  const toggleFavorite = useToggleHabitationFavorite();
  const { data: friendships } = useFriendships();
  const createHabitation = useCreateHabitation();
  const updateHabitation = useUpdateHabitation();
  const deleteHabitation = useDeleteHabitation();
  const [tab, setTab] = useState<Tab>('personal');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingHabitation, setEditingHabitation] = useState<Habitation | null>(null);
  const [type, setType] = useState<HabitationTypeKey>('maison');
  const [name, setName] = useState('');

  const favoriteIds = new Set((favorites ?? []).map((f) => f.habitation_id));
  const myHabitations = (habitations ?? []).filter((h) => h.user_id === session?.user.id);
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
      <Stack.Screen options={{ title: t('inventory.habitations.title'), headerBackVisible: false }} />
      <View className="flex-1 bg-sand">
        <ScrollView contentContainerClassName="px-6 pb-52 pt-4">
          <View className="mb-4 flex-row gap-2">
            <Pressable
              onPress={() => setTab('personal')}
              className={`flex-1 items-center rounded-xl border px-4 py-3 ${tab === 'personal' ? 'border-coral bg-coral-light' : 'border-ink/10'}`}
            >
              <Text className={tab === 'personal' ? 'font-semibold text-coral-dark' : 'text-ink-soft'}>
                {t('inventory.habitations.tab_personal')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setTab('shared')}
              className={`flex-1 items-center rounded-xl border px-4 py-3 ${tab === 'shared' ? 'border-coral bg-coral-light' : 'border-ink/10'}`}
            >
              <Text className={tab === 'shared' ? 'font-semibold text-coral-dark' : 'text-ink-soft'}>
                {t('inventory.habitations.tab_shared')}
              </Text>
            </Pressable>
          </View>

          {tab === 'personal' ? (
            isPersonalEmpty ? (
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
        </ScrollView>

        {tab === 'personal' ? (
          <BottomActionBar extraBottomOffset={88}>
            <View className="flex-1">
              <Button label={t('inventory.habitations.add')} onPress={openCreate} />
            </View>
          </BottomActionBar>
        ) : null}

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
