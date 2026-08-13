import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, View } from 'react-native';
import { BottomActionBar } from '../../components/BottomActionBar';
import { Button } from '../../components/Button';
import { CreateEntityModal } from '../../components/CreateEntityModal';
import { EmptyState } from '../../components/EmptyState';
import { EntityCard } from '../../components/EntityCard';
import type { Piece } from '../../types/database';
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

  const handleDelete = (id: string) => {
    Alert.alert(t('inventory.pieces.delete_confirm_title'), t('inventory.pieces.delete_confirm_message'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => deletePiece.mutate(id) },
    ]);
  };

  const isEmpty = !isLoading && (pieces?.length ?? 0) === 0;

  return (
    <View className="flex-1 bg-sand">
      <ScrollView contentContainerClassName="px-6 pb-52 pt-4">
        {isEmpty ? (
          <EmptyState icon="piece" title={t('inventory.pieces.empty')} />
        ) : (
          pieces?.map((piece) => (
            <EntityCard
              key={piece.id}
              icon="piece"
              title={piece.name}
              onPress={() => router.push(`/piece/${piece.id}`)}
              onLongPress={() => handleDelete(piece.id)}
              onEdit={() => {
                setEditingPiece(piece);
                setModalOpen(true);
              }}
            />
          ))
        )}
      </ScrollView>

      <BottomActionBar extraBottomOffset={88}>
        <View className="flex-1">
          <Button
            label={t('inventory.pieces.add')}
            onPress={() => {
              setEditingPiece(null);
              setModalOpen(true);
            }}
          />
        </View>
      </BottomActionBar>

      <CreateEntityModal
        visible={modalOpen}
        title={editingPiece ? t('inventory.pieces.edit_title') : t('inventory.pieces.create_title')}
        nameLabel={t('inventory.pieces.name_label')}
        submitLabel={t('common.save')}
        cancelLabel={t('common.cancel')}
        initialName={editingPiece?.name}
        loading={createPiece.isPending || updatePiece.isPending}
        onClose={() => setModalOpen(false)}
        onSubmit={async (name) => {
          if (editingPiece) {
            await updatePiece.mutateAsync({ id: editingPiece.id, name });
          } else {
            await createPiece.mutateAsync(name);
          }
          setModalOpen(false);
        }}
      />
    </View>
  );
}
