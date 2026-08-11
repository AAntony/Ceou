import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, View } from 'react-native';
import { Button } from '../../components/Button';
import { CreateEntityModal } from '../../components/CreateEntityModal';
import { EmptyState } from '../../components/EmptyState';
import { EntityCard } from '../../components/EntityCard';
import { useCreatePiece, useDeletePiece, usePieces } from './queries';

type PieceListProps = {
  habitationId: string;
};

export function PieceList({ habitationId }: PieceListProps) {
  const { t } = useTranslation();
  const { data: pieces, isLoading } = usePieces(habitationId);
  const createPiece = useCreatePiece(habitationId);
  const deletePiece = useDeletePiece(habitationId);
  const [modalOpen, setModalOpen] = useState(false);

  const handleDelete = (id: string) => {
    Alert.alert(t('inventory.pieces.delete_confirm_title'), t('inventory.pieces.delete_confirm_message'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => deletePiece.mutate(id) },
    ]);
  };

  const isEmpty = !isLoading && (pieces?.length ?? 0) === 0;

  return (
    <View className="flex-1 bg-white">
      <ScrollView contentContainerClassName="px-6 pb-28 pt-4">
        {isEmpty ? (
          <EmptyState title={t('inventory.pieces.empty')} />
        ) : (
          pieces?.map((piece) => (
            <EntityCard
              key={piece.id}
              icon="🚪"
              title={piece.name}
              onPress={() => router.push(`/piece/${piece.id}`)}
              onLongPress={() => handleDelete(piece.id)}
            />
          ))
        )}
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 border-t border-neutral-100 bg-white px-6 py-4">
        <Button label={t('inventory.pieces.add')} onPress={() => setModalOpen(true)} />
      </View>

      <CreateEntityModal
        visible={modalOpen}
        title={t('inventory.pieces.create_title')}
        nameLabel={t('inventory.pieces.name_label')}
        submitLabel={t('common.save')}
        cancelLabel={t('common.cancel')}
        loading={createPiece.isPending}
        onClose={() => setModalOpen(false)}
        onSubmit={async (name) => {
          await createPiece.mutateAsync(name);
          setModalOpen(false);
        }}
      />
    </View>
  );
}
