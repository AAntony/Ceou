import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { BottomActionBar } from '../../components/BottomActionBar';
import { Button } from '../../components/Button';
import { CreateEntityModal } from '../../components/CreateEntityModal';
import { EmptyState } from '../../components/EmptyState';
import { EntityCard } from '../../components/EntityCard';
import { EntityGrid } from '../../components/EntityGrid';
import { PresetPicker } from '../../components/PresetPicker';
import { confirmDelete } from '../../lib/confirmDelete';
import { HUE_BADGE_FILL, HUE_CARD_BG_HEX } from '../search/palette';
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
  const [name, setName] = useState('');

  const handleDelete = (id: string) => {
    confirmDelete(t, 'inventory.emplacements.delete_confirm_title', 'inventory.emplacements.delete_confirm_message', () =>
      deleteEmplacement.mutate(id),
    );
  };

  const openCreate = () => {
    setEditingEmplacement(null);
    setPresetKey(null);
    setName('');
    setModalOpen(true);
  };

  const openEdit = (emplacement: Emplacement) => {
    setEditingEmplacement(emplacement);
    setPresetKey((emplacement.preset_key as EmplacementPresetKey) ?? null);
    setName(emplacement.name);
    setModalOpen(true);
  };

  // Comme pour les Habitations : le préremplissage nom <- catégorie
  // n'écrase jamais un nom déjà personnalisé en édition.
  const handleSelectPreset = (key: EmplacementPresetKey) => {
    setPresetKey(key);
    if (!editingEmplacement) setName(t(`inventory.emplacementPresets.${key}`));
  };

  const isEmpty = !isLoading && (emplacements?.length ?? 0) === 0;

  return (
    <View className="flex-1 bg-sand">
      <ScrollView contentContainerClassName="px-6 pb-52 pt-4">
        {isEmpty ? (
          <EmptyState icon="etagere" title={t('inventory.emplacements.empty')} />
        ) : (
          <EntityGrid>
            {emplacements?.map((emplacement) => (
              <EntityCard
                key={emplacement.id}
                icon={getEmplacementIcon(emplacement.preset_key)}
                title={emplacement.name}
                bgColor={HUE_CARD_BG_HEX.mustard}
                badgeColor={HUE_BADGE_FILL.mustard}
                onPress={() => router.push(`/emplacement/${emplacement.id}`)}
                onLongPress={() => handleDelete(emplacement.id)}
                onEdit={() => openEdit(emplacement)}
              />
            ))}
          </EntityGrid>
        )}
      </ScrollView>

      <BottomActionBar extraBottomOffset={88}>
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
        name={name}
        onNameChange={setName}
        loading={createEmplacement.isPending || updateEmplacement.isPending}
        onClose={() => setModalOpen(false)}
        onSubmit={async (submittedName) => {
          if (editingEmplacement) {
            await updateEmplacement.mutateAsync({ id: editingEmplacement.id, name: submittedName, presetKey });
          } else {
            await createEmplacement.mutateAsync({ name: submittedName, presetKey });
          }
          setModalOpen(false);
        }}
      >
        <PresetPicker
          presets={EMPLACEMENT_PRESETS}
          selectedKey={presetKey}
          onSelect={(key) => handleSelectPreset(key as EmplacementPresetKey)}
          labelFor={(key) => t(`inventory.emplacementPresets.${key}`)}
        />
      </CreateEntityModal>
    </View>
  );
}
