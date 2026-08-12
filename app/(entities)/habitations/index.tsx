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

  const handleDelete = (id: string) => {
    Alert.alert(t('inventory.habitations.delete_confirm_title'), t('inventory.habitations.delete_confirm_message'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => deleteHabitation.mutate(id) },
    ]);
  };

  const openCreate = () => {
    setEditingHabitation(null);
    setType('maison');
    setModalOpen(true);
  };

  const openEdit = (habitation: Habitation) => {
    setEditingHabitation(habitation);
    setType(habitation.type as HabitationTypeKey);
    setModalOpen(true);
  };

  const isEmpty = !isLoading && (habitations?.length ?? 0) === 0;

  return (
    <>
      <Stack.Screen options={{ title: t('inventory.habitations.title') }} />
      <View className="flex-1 bg-sand">
        <ScrollView contentContainerClassName="px-6 pb-52 pt-4">
          {isEmpty ? (
            <EmptyState icon="home" title={t('inventory.habitations.empty')} />
          ) : (
            habitations?.map((habitation) => (
              <EntityCard
                key={habitation.id}
                icon={getHabitationIcon(habitation.type)}
                title={habitation.name}
                subtitle={t(`inventory.habitationTypes.${habitation.type}`)}
                onPress={() => router.push(`/habitation/${habitation.id}`)}
                onLongPress={() => handleDelete(habitation.id)}
                onEdit={() => openEdit(habitation)}
              />
            ))
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
          initialName={editingHabitation?.name}
          loading={createHabitation.isPending || updateHabitation.isPending}
          onClose={() => setModalOpen(false)}
          onSubmit={async (name) => {
            const definition = HABITATION_TYPES.find((h) => h.key === type)!;
            if (editingHabitation) {
              await updateHabitation.mutateAsync({ id: editingHabitation.id, name, type, icon: definition.icon });
            } else {
              await createHabitation.mutateAsync({ name, type, icon: definition.icon });
            }
            setModalOpen(false);
          }}
        >
          <PresetPicker
            presets={HABITATION_TYPES}
            selectedKey={type}
            onSelect={(key) => setType(key as HabitationTypeKey)}
            labelFor={(key) => t(`inventory.habitationTypes.${key}`)}
          />
        </CreateEntityModal>
      </View>
    </>
  );
}
