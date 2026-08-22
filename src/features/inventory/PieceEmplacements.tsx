import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { BottomActionBar } from '../../components/BottomActionBar';
import { Button } from '../../components/Button';
import { CreateEntityModal } from '../../components/CreateEntityModal';
import { EmptyState } from '../../components/EmptyState';
import { EntityPhotoField } from '../../components/EntityPhotoField';
import { EntityRow } from '../../components/EntityRow';
import { ErrorState } from '../../components/ErrorState';
import { PresetPicker } from '../../components/PresetPicker';
import { usePullToRefresh } from '../../components/usePullToRefresh';
import { confirmDelete } from '../../lib/confirmDelete';
import type { Emplacement } from '../../types/database';
import { useSession } from '../auth/SessionProvider';
import { canModify, usePiecePermission } from '../sharing/queries';
import { EMPLACEMENT_PRESETS, getEmplacementIcon, type EmplacementPresetKey } from './constants';
import { objetCountLabel } from './counts';
import { resolveEntityPhotoUrl } from './entityPhoto';
import {
  nodeCountKey,
  useCreateEmplacement,
  useDeleteEmplacement,
  useEmplacements,
  useHabitationIdForNode,
  useHabitationNodeCounts,
  useUpdateEmplacement,
} from './queries';

type PieceEmplacementsProps = {
  pieceId: string;
  addSignal?: number;
};

export function PieceEmplacements({ pieceId, addSignal }: PieceEmplacementsProps) {
  const refreshControl = usePullToRefresh();
  const { t } = useTranslation();
  const { session } = useSession();
  const { data: emplacements, isLoading, isError, refetch } = useEmplacements(pieceId);
  // Les compteurs sont à la maille de l'habitation (un appel pour toute
  // l'arborescence) ; cet écran ne connaît que sa pièce, d'où la résolution.
  const { data: habitationId } = useHabitationIdForNode('piece', pieceId);
  const { data: counts } = useHabitationNodeCounts(habitationId);
  const { data: permission } = usePiecePermission(pieceId);
  const editable = canModify(permission);
  const createEmplacement = useCreateEmplacement(pieceId);
  const updateEmplacement = useUpdateEmplacement(pieceId);
  const deleteEmplacement = useDeleteEmplacement(pieceId);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmplacement, setEditingEmplacement] = useState<Emplacement | null>(null);
  const [presetKey, setPresetKey] = useState<EmplacementPresetKey | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [name, setName] = useState('');

  const handleDelete = (id: string) => {
    confirmDelete(t, 'inventory.emplacements.delete_confirm_title', 'inventory.emplacements.delete_confirm_message', () =>
      deleteEmplacement.mutate(id),
    );
  };

  const openCreate = () => {
    setPhotoUri(null);
    setEditingEmplacement(null);
    setPresetKey(null);
    setName('');
    setModalOpen(true);
  };

  const openEdit = (emplacement: Emplacement) => {
    setEditingEmplacement(emplacement);
    setPresetKey((emplacement.preset_key as EmplacementPresetKey) ?? null);
    setPhotoUri(emplacement.photo_url);
    setName(emplacement.name);
    setModalOpen(true);
  };

  // Comme pour les Habitations : le préremplissage nom <- catégorie
  // n'écrase jamais un nom déjà personnalisé en édition.
  const handleSelectPreset = (key: EmplacementPresetKey) => {
    setPresetKey(key);
    if (!editingEmplacement) setName(t(`inventory.emplacementPresets.${key}`));
  };


// Ouvre la creation depuis le "+" de l'en-tete natif, qui est rendu par le
// FICHIER DE ROUTE (il doit connaitre l'onglet actif la ou il y en a un) mais
// dont l'action vit ICI, avec l'etat de la modale. Un compteur qui
// s'incremente plutot qu'un booleen : deux demandes successives doivent
// rouvrir la modale, ce qu'un booleen deja a true ne declencherait pas.
  useEffect(() => {
    if (addSignal) openCreate();
  }, [addSignal]);

  const isEmpty = !isLoading && (emplacements?.length ?? 0) === 0;

  return (
    <View className="flex-1 bg-sand">
      <ScrollView contentContainerClassName="px-6 pb-28 pt-4" refreshControl={refreshControl}>
        {isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : isEmpty ? (
          <EmptyState icon="etagere" title={t('inventory.emplacements.empty')} />
        ) : (
          emplacements?.map((emplacement) => (
            <EntityRow
              key={emplacement.id}
              level="emplacement"
              icon={getEmplacementIcon(emplacement.preset_key)}
              title={emplacement.name}
              subtitle={objetCountLabel(t, counts, nodeCountKey('emplacement', emplacement.id))}
              photoUri={emplacement.photo_url}
              onPress={() => router.push(`/emplacement/${emplacement.id}`)}
              onLongPress={editable ? () => handleDelete(emplacement.id) : undefined}
              onEdit={editable ? () => openEdit(emplacement) : undefined}
            />
          ))
        )}
      </ScrollView>

      {editable ? (
        <BottomActionBar extraBottomOffset={88}>
          <View className="flex-1">
            <Button label={t('inventory.emplacements.add')} onPress={openCreate} />
          </View>
        </BottomActionBar>
      ) : null}

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
          const userId = session!.user.id;
          if (editingEmplacement) {
            const photoUrl = await resolveEntityPhotoUrl({
              level: 'emplacement',
              entityId: editingEmplacement.id,
              userId,
              chosen: photoUri,
              current: editingEmplacement.photo_url,
            });
            await updateEmplacement.mutateAsync({ id: editingEmplacement.id, name: submittedName, presetKey, photoUrl });
          } else {
            // La ligne d'abord, la photo ensuite : le fichier est nommé
            // d'après l'identifiant, qui n'existe qu'une fois la ligne créée.
            const emplacement = await createEmplacement.mutateAsync({ name: submittedName, presetKey });
            const photoUrl = await resolveEntityPhotoUrl({
              level: 'emplacement',
              entityId: emplacement.id,
              userId,
              chosen: photoUri,
              current: null,
            });
            if (photoUrl !== undefined) {
              await updateEmplacement.mutateAsync({ id: emplacement.id, name: submittedName, presetKey, photoUrl });
            }
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
        <EntityPhotoField level="emplacement" photoUri={photoUri} onChange={setPhotoUri} />
      </CreateEntityModal>
    </View>
  );
}
