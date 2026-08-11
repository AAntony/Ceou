import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, View } from 'react-native';
import { BottomActionBar } from '../../components/BottomActionBar';
import { Button } from '../../components/Button';
import { CreateEntityModal } from '../../components/CreateEntityModal';
import { EmptyState } from '../../components/EmptyState';
import { EntityCard } from '../../components/EntityCard';
import { PresetPicker } from '../../components/PresetPicker';
import type { Emplacement } from '../../types/database';
import { EMPLACEMENT_PRESETS, getEmplacementIcon, type EmplacementPresetKey } from './constants';
import { useCreateEmplacement, useDeleteEmplacement, useEmplacements, useUpdateEmplacement } from './queries';

type PieceEmplacementsProps = {
  pieceId: string;
};

export function PieceEmplacements({ pieceId }: PieceEmplacementsProps) {
  const { t } = useTranslation();
  const { data: emplacements, isLoading } = useEmplacements(pieceId);
  const createEmplacement = useCreateEmplacement(pieceId);
  const updateEmplacement = useUpdateEmplacement(pieceId);
  const deleteEmplacement = useDeleteEmplacement(pieceId);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmplacement, setEditingEmplacement] = useState<Emplacement | null>(null);
  const [presetKey, setPresetKey] = useState<EmplacementPresetKey | null>(null);

  const handleDelete = (id: string) => {
    Alert.alert(t('inventory.emplacements.delete_confirm_title'), t('inventory.emplacements.delete_confirm_message'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => deleteEmplacement.mutate(id) },
    ]);
  };

  const openCreate = () => {
    setEditingEmplacement(null);
    setPresetKey(null);
    setModalOpen(true);
  };

  const openEdit = (emplacement: Emplacement) => {
    setEditingEmplacement(emplacement);
    setPresetKey((emplacement.preset_key as EmplacementPresetKey) ?? null);
    setModalOpen(true);
  };

  const isEmpty = !isLoading && (emplacements?.length ?? 0) === 0;

  return (
    <View className="flex-1 bg-sand">
      <ScrollView contentContainerClassName="px-6 pb-28 pt-4">
        {isEmpty ? (
          <EmptyState icon="etagere" title={t('inventory.emplacements.empty')} />
        ) : (
          emplacements?.map((emplacement) => (
            <EntityCard
              key={emplacement.id}
              icon={getEmplacementIcon(emplacement.preset_key)}
              title={emplacement.name}
              onPress={() => router.push(`/emplacement/${emplacement.id}`)}
              onLongPress={() => handleDelete(emplacement.id)}
              onEdit={() => openEdit(emplacement)}
            />
          ))
        )}
      </ScrollView>

      <BottomActionBar>
        <View className="flex-1">
          <Button label={t('inventory.emplacements.add')} onPress={openCreate} />
        </View>
      </BottomActionBar>

      <CreateEntityModal
        visible={modalOpen}
        title={editingEmplacement ? t('inventory.emplacements.edit_title') : t('inventory.emplacements.create_title')}
        nameLabel={t('inventory.emplacements.name_label')}
        submitLabel={t('common.save')}
        cancelLabel={t('common.cancel')}
        initialName={editingEmplacement?.name}
        loading={createEmplacement.isPending || updateEmplacement.isPending}
        onClose={() => setModalOpen(false)}
        onSubmit={async (name) => {
          if (editingEmplacement) {
            await updateEmplacement.mutateAsync({ id: editingEmplacement.id, name, presetKey });
          } else {
            await createEmplacement.mutateAsync({ name, presetKey });
          }
          setModalOpen(false);
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
