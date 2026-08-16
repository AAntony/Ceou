import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';
import { BottomActionBar } from '../../components/BottomActionBar';
import { Button } from '../../components/Button';
import { ColorPicker } from '../../components/ColorPicker';
import { CreateEntityModal } from '../../components/CreateEntityModal';
import { EmptyState } from '../../components/EmptyState';
import { EntityCard } from '../../components/EntityCard';
import { EntityGrid } from '../../components/EntityGrid';
import { PresetPicker } from '../../components/PresetPicker';
import { confirmDelete } from '../../lib/confirmDelete';
import { shade } from '../plans/constants';
import type { Piece } from '../../types/database';
import { DEFAULT_PIECE_COLOR, PIECE_TYPES, getPieceIcon, type PieceTypeKey } from './constants';
import { useCreatePiece, useDeletePiece, usePieces, useUpdatePiece } from './queries';

type PieceListProps = {
  habitationId: string;
};

export function PieceList({ habitationId }: PieceListProps) {
  const { t } = useTranslation();
  const { data: pieces, isLoading } = usePieces(habitationId);
  const createPiece = useCreatePiece(habitationId);
  const updatePiece = useUpdatePiece(habitationId);
  const deletePiece = useDeletePiece(habitationId);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPiece, setEditingPiece] = useState<Piece | null>(null);
  const [presetKey, setPresetKey] = useState<PieceTypeKey | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [name, setName] = useState('');

  const handleDelete = (id: string) => {
    confirmDelete(t, 'inventory.pieces.delete_confirm_title', 'inventory.pieces.delete_confirm_message', () => deletePiece.mutate(id));
  };

  const openCreate = () => {
    setEditingPiece(null);
    setPresetKey(null);
    setColor(null);
    setName('');
    setModalOpen(true);
  };

  const openEdit = (piece: Piece) => {
    setEditingPiece(piece);
    setPresetKey((piece.preset_key as PieceTypeKey) ?? null);
    setColor(piece.color);
    setName(piece.name);
    setModalOpen(true);
  };

  // Comme pour les Habitations : le préremplissage nom <- catégorie
  // n'écrase jamais un nom déjà personnalisé en édition.
  const handleSelectPreset = (key: PieceTypeKey) => {
    setPresetKey(key);
    if (!editingPiece) setName(t(`inventory.pieceTypes.${key}`));
  };

  const isEmpty = !isLoading && (pieces?.length ?? 0) === 0;

  return (
    <View className="flex-1 bg-sand">
      <ScrollView contentContainerClassName="px-6 pb-52 pt-4">
        {isEmpty ? (
          <EmptyState icon="piece" title={t('inventory.pieces.empty')} />
        ) : (
          <EntityGrid>
            {pieces?.map((piece) => {
              const pieceColor = piece.color ?? DEFAULT_PIECE_COLOR;
              return (
                <EntityCard
                  key={piece.id}
                  icon={getPieceIcon(piece.preset_key)}
                  title={piece.name}
                  bgColor={pieceColor}
                  badgeColor={shade(pieceColor, 0.35)}
                  onPress={() => router.push(`/piece/${piece.id}`)}
                  onLongPress={() => handleDelete(piece.id)}
                  onEdit={() => openEdit(piece)}
                />
              );
            })}
          </EntityGrid>
        )}
      </ScrollView>

      <BottomActionBar extraBottomOffset={88}>
        <View className="flex-1">
          <Button label={t('inventory.pieces.add')} onPress={openCreate} />
        </View>
      </BottomActionBar>

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
          if (editingPiece) {
            await updatePiece.mutateAsync({ id: editingPiece.id, name: submittedName, presetKey, color });
          } else {
            await createPiece.mutateAsync({ name: submittedName, presetKey, color });
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
      </CreateEntityModal>
    </View>
  );
}
