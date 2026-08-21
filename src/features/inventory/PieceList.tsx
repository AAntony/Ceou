import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';
import { ColorPicker } from '../../components/ColorPicker';
import { CreateEntityModal } from '../../components/CreateEntityModal';
import { EmptyState } from '../../components/EmptyState';
import { EntityPhotoField } from '../../components/EntityPhotoField';
import { EntityRow } from '../../components/EntityRow';
import { ErrorState } from '../../components/ErrorState';
import { PresetPicker } from '../../components/PresetPicker';
import { confirmDelete } from '../../lib/confirmDelete';
import { shade } from '../plans/constants';
import type { Piece } from '../../types/database';
import { useSession } from '../auth/SessionProvider';
import { canModify, useHabitationPermission } from '../sharing/queries';
import { DEFAULT_PIECE_COLOR, PIECE_TYPES, getPieceIcon, type PieceTypeKey } from './constants';
import { objetCountLabel } from './counts';
import { resolveEntityPhotoUrl } from './entityPhoto';
import {
  nodeCountKey,
  useCreatePiece,
  useDeletePiece,
  useHabitationNodeCounts,
  usePieces,
  useUpdatePiece,
} from './queries';

type PieceListProps = {
  habitationId: string;
  addSignal?: number;
};

export function PieceList({ habitationId, addSignal }: PieceListProps) {
  const { t } = useTranslation();
  const { session } = useSession();
  const { data: pieces, isLoading, isError, refetch } = usePieces(habitationId);
  const { data: counts } = useHabitationNodeCounts(habitationId);
  const { data: permission } = useHabitationPermission(habitationId);
  const editable = canModify(permission);
  const createPiece = useCreatePiece(habitationId);
  const updatePiece = useUpdatePiece(habitationId);
  const deletePiece = useDeletePiece(habitationId);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPiece, setEditingPiece] = useState<Piece | null>(null);
  const [presetKey, setPresetKey] = useState<PieceTypeKey | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [name, setName] = useState('');

  const handleDelete = (id: string) => {
    confirmDelete(t, 'inventory.pieces.delete_confirm_title', 'inventory.pieces.delete_confirm_message', () => deletePiece.mutate(id));
  };

  const openCreate = () => {
    setEditingPiece(null);
    setPresetKey(null);
    setColor(null);
    setPhotoUri(null);
    setName('');
    setModalOpen(true);
  };

  const openEdit = (piece: Piece) => {
    setEditingPiece(piece);
    setPresetKey((piece.preset_key as PieceTypeKey) ?? null);
    setColor(piece.color);
    setPhotoUri(piece.photo_url);
    setName(piece.name);
    setModalOpen(true);
  };

  // Comme pour les Habitations : le préremplissage nom <- catégorie
  // n'écrase jamais un nom déjà personnalisé en édition.
  const handleSelectPreset = (key: PieceTypeKey) => {
    setPresetKey(key);
    if (!editingPiece) setName(t(`inventory.pieceTypes.${key}`));
  };


// Ouvre la creation depuis le "+" de l'en-tete natif, qui est rendu par le
// FICHIER DE ROUTE (il doit connaitre l'onglet actif la ou il y en a un) mais
// dont l'action vit ICI, avec l'etat de la modale. Un compteur qui
// s'incremente plutot qu'un booleen : deux demandes successives doivent
// rouvrir la modale, ce qu'un booleen deja a true ne declencherait pas.
  useEffect(() => {
    if (addSignal) openCreate();
  }, [addSignal]);

  const isEmpty = !isLoading && (pieces?.length ?? 0) === 0;

  return (
    <View className="flex-1 bg-sand">
      <ScrollView contentContainerClassName="px-6 pb-28 pt-4">
        {isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : isEmpty ? (
          <EmptyState icon="piece" title={t('inventory.pieces.empty')} />
        ) : (
          pieces?.map((piece) => (
            <EntityRow
              key={piece.id}
              level="piece"
              icon={getPieceIcon(piece.preset_key)}
              title={piece.name}
              subtitle={objetCountLabel(t, counts, nodeCountKey('piece', piece.id))}
              photoUri={piece.photo_url}
              // La couleur choisie pour la Pièce la suit jusqu'ici : c'est
              // la même que sur le Plan, assombrie pour rester lisible sur
              // le fond blanc de la rangée.
              iconColor={shade(piece.color ?? DEFAULT_PIECE_COLOR, 0.45)}
              onPress={() => router.push(`/piece/${piece.id}`)}
              onLongPress={editable ? () => handleDelete(piece.id) : undefined}
              onEdit={editable ? () => openEdit(piece) : undefined}
            />
          ))
        )}
      </ScrollView>

      <CreateEntityModal
        visible={modalOpen}
        title={editingPiece ? t('inventory.pieces.edit_title') : t('inventory.pieces.create_title')}
        nameLabel={t('inventory.pieces.name_label')}
        submitLabel={t('common.save')}
        cancelLabel={t('common.cancel')}
        name={name}
        onNameChange={setName}
        loading={createPiece.isPending || updatePiece.isPending}
        onClose={() => setModalOpen(false)}
        onSubmit={async (submittedName) => {
          const userId = session!.user.id;
          if (editingPiece) {
            const photoUrl = await resolveEntityPhotoUrl({
              level: 'piece',
              entityId: editingPiece.id,
              userId,
              chosen: photoUri,
              current: editingPiece.photo_url,
            });
            await updatePiece.mutateAsync({ id: editingPiece.id, name: submittedName, presetKey, color, photoUrl });
          } else {
            // La ligne d'abord, la photo ensuite : le fichier est nommé
            // d'après l'identifiant, qui n'existe qu'une fois la ligne créée.
            const piece = await createPiece.mutateAsync({ name: submittedName, presetKey, color });
            const photoUrl = await resolveEntityPhotoUrl({
              level: 'piece',
              entityId: piece.id,
              userId,
              chosen: photoUri,
              current: null,
            });
            if (photoUrl !== undefined) await updatePiece.mutateAsync({ id: piece.id, photoUrl });
          }
          setModalOpen(false);
        }}
      >
        <PresetPicker
          presets={PIECE_TYPES}
          selectedKey={presetKey}
          onSelect={(key) => handleSelectPreset(key as PieceTypeKey)}
          labelFor={(key) => t(`inventory.pieceTypes.${key}`)}
        />
        <Text className="mb-2 text-sm font-medium text-ink-soft">{t('inventory.pieces.color_label')}</Text>
        <ColorPicker selectedColor={color} onSelect={setColor} />
        <EntityPhotoField level="piece" photoUri={photoUri} onChange={setPhotoUri} />
      </CreateEntityModal>
    </View>
  );
}
