import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, View } from 'react-native';
import { Button } from '../../components/Button';
import { CreateEntityModal } from '../../components/CreateEntityModal';
import { EmptyState } from '../../components/EmptyState';
import { EntityCard } from '../../components/EntityCard';
import { PresetPicker } from '../../components/PresetPicker';
import { EMPLACEMENT_PRESETS, getEmplacementIcon, type EmplacementPresetKey } from './constants';
import { useCreateEmplacement, useDeleteEmplacement, useEmplacements } from './queries';

type PieceEmplacementsProps = {
  pieceId: string;
};

export function PieceEmplacements({ pieceId }: PieceEmplacementsProps) {
  const { t } = useTranslation();
  const { data: emplacements, isLoading } = useEmplacements(pieceId);
  const createEmplacement = useCreateEmplacement(pieceId);
  const deleteEmplacement = useDeleteEmplacement(pieceId);
  const [modalOpen, setModalOpen] = useState(false);
  const [presetKey, setPresetKey] = useState<EmplacementPresetKey | null>(null);

  const handleDelete = (id: string) => {
    Alert.alert(t('inventory.emplacements.delete_confirm_title'), t('inventory.emplacements.delete_confirm_message'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => deleteEmplacement.mutate(id) },
    ]);
  };

  const isEmpty = !isLoading && (emplacements?.length ?? 0) === 0;

  return (
    <View className="flex-1 bg-white">
      <ScrollView contentContainerClassName="px-6 pb-28 pt-4">
        {isEmpty ? (
          <EmptyState title={t('inventory.emplacements.empty')} />
        ) : (
          emplacements?.map((emplacement) => (
            <EntityCard
              key={emplacement.id}
              icon={getEmplacementIcon(emplacement.preset_key)}
              title={emplacement.name}
              onPress={() => router.push(`/emplacement/${emplacement.id}`)}
              onLongPress={() => handleDelete(emplacement.id)}
            />
          ))
        )}
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 border-t border-neutral-100 bg-white px-6 py-4">
        <Button label={t('inventory.emplacements.add')} onPress={() => setModalOpen(true)} />
      </View>

      <CreateEntityModal
        visible={modalOpen}
        title={t('inventory.emplacements.create_title')}
        nameLabel={t('inventory.emplacements.name_label')}
        submitLabel={t('common.save')}
        cancelLabel={t('common.cancel')}
        loading={createEmplacement.isPending}
        onClose={() => setModalOpen(false)}
        onSubmit={async (name) => {
          await createEmplacement.mutateAsync({ name, presetKey });
          setModalOpen(false);
          setPresetKey(null);
        }}
      >
        <PresetPicker
          presets={EMPLACEMENT_PRESETS}
          selectedKey={presetKey}
          onSelect={(key) => setPresetKey(key as EmplacementPresetKey)}
          labelFor={(key) => t(`inventory.emplacementPresets.${key}`)}
        />
      </CreateEntityModal>
    </View>
  );
}
