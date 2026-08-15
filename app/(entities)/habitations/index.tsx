import { Stack, router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, Text, View } from 'react-native';
import { BottomActionBar } from '../../../src/components/BottomActionBar';
import { Button } from '../../../src/components/Button';
import { CreateEntityModal } from '../../../src/components/CreateEntityModal';
import { EmptyState } from '../../../src/components/EmptyState';
import { EntityCard } from '../../../src/components/EntityCard';
import { PresetPicker } from '../../../src/components/PresetPicker';
import { HABITATION_TYPES, getHabitationIcon, type HabitationTypeKey } from '../../../src/features/inventory/constants';
import { useCreateHabitation, useDeleteHabitation, useHabitations, useUpdateHabitation } from '../../../src/features/inventory/queries';
import { HUE_BADGE_FILL, HUE_CARD_BG_HEX } from '../../../src/features/search/palette';
import type { Habitation } from '../../../src/types/database';

export default function HabitationsScreen() {
  const { t } = useTranslation();
  const { data: habitations, isLoading } = useHabitations();
  const createHabitation = useCreateHabitation();
  const updateHabitation = useUpdateHabitation();
  const deleteHabitation = useDeleteHabitation();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingHabitation, setEditingHabitation] = useState<Habitation | null>(null);
  const [type, setType] = useState<HabitationTypeKey>('maison');
  const [name, setName] = useState('');

  const handleDelete = (id: string) => {
    Alert.alert(t('inventory.habitations.delete_confirm_title'), t('inventory.habitations.delete_confirm_message'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => deleteHabitation.mutate(id) },
    ]);
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

  const isEmpty = !isLoading && (habitations?.length ?? 0) === 0;

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
          {isEmpty ? (
            <EmptyState icon="home" title={t('inventory.habitations.empty')} />
          ) : (
            <View className="flex-row flex-wrap justify-between">
              {habitations?.map((habitation) => (
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
                />
              ))}
            </View>
          )}
        </ScrollView>

        <BottomActionBar extraBottomOffset={88}>
          <View className="flex-1">
            <Button label={t('inventory.habitations.add')} onPress={openCreate} />
          </View>
        </BottomActionBar>

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
