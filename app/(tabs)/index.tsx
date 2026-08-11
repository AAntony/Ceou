import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, Text, View } from 'react-native';
import { Button } from '../../src/components/Button';
import { CreateEntityModal } from '../../src/components/CreateEntityModal';
import { EmptyState } from '../../src/components/EmptyState';
import { EntityCard } from '../../src/components/EntityCard';
import { PresetPicker } from '../../src/components/PresetPicker';
import { HABITATION_TYPES, type HabitationTypeKey } from '../../src/features/inventory/constants';
import { useCreateHabitation, useDeleteHabitation, useHabitations } from '../../src/features/inventory/queries';

export default function HabitationsScreen() {
  const { t } = useTranslation();
  const { data: habitations, isLoading } = useHabitations();
  const createHabitation = useCreateHabitation();
  const deleteHabitation = useDeleteHabitation();
  const [modalOpen, setModalOpen] = useState(false);
  const [type, setType] = useState<HabitationTypeKey>('maison');

  const handleDelete = (id: string) => {
    Alert.alert(t('inventory.habitations.delete_confirm_title'), t('inventory.habitations.delete_confirm_message'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => deleteHabitation.mutate(id) },
    ]);
  };

  const isEmpty = !isLoading && (habitations?.length ?? 0) === 0;

  return (
    <View className="flex-1 bg-white">
      <ScrollView contentContainerClassName="px-6 pb-28 pt-16">
        <Text className="mb-6 text-3xl font-bold text-neutral-900">{t('inventory.habitations.title')}</Text>
        {isEmpty ? (
          <EmptyState icon="🏠" title={t('inventory.habitations.empty')} />
        ) : (
          habitations?.map((habitation) => (
            <EntityCard
              key={habitation.id}
              icon={habitation.icon ?? undefined}
              title={habitation.name}
              subtitle={t(`inventory.habitationTypes.${habitation.type}`)}
              onPress={() => router.push(`/habitation/${habitation.id}`)}
              onLongPress={() => handleDelete(habitation.id)}
            />
          ))
        )}
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 border-t border-neutral-100 bg-white px-6 py-4">
        <Button label={t('inventory.habitations.add')} onPress={() => setModalOpen(true)} />
      </View>

      <CreateEntityModal
        visible={modalOpen}
        title={t('inventory.habitations.create_title')}
        nameLabel={t('inventory.habitations.name_label')}
        submitLabel={t('common.save')}
        cancelLabel={t('common.cancel')}
        loading={createHabitation.isPending}
        onClose={() => setModalOpen(false)}
        onSubmit={async (name) => {
          const definition = HABITATION_TYPES.find((h) => h.key === type)!;
          await createHabitation.mutateAsync({ name, type, icon: definition.icon });
          setModalOpen(false);
          setType('maison');
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
  );
}
