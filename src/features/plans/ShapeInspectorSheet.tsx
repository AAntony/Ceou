import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import type { IconName } from '../../components/Icon';
import { PresetPicker } from '../../components/PresetPicker';
import type { Piece, PlanForme } from '../../types/database';

const NO_PIECE_KEY = '__none__';

type ShapeInspectorSheetProps = {
  forme: PlanForme | null;
  pieces: Piece[];
  onClose: () => void;
  onChoosePiece: (pieceId: string | null) => void;
  onDelete: () => void;
};

// Le redimensionnement se fait maintenant au pincement, directement sur le
// plan — cette fiche ne sert plus qu'à associer une pièce (appliqué tout de
// suite au tap, pas de bouton "Enregistrer" séparé) et à supprimer la forme.
export function ShapeInspectorSheet({ forme, pieces, onClose, onChoosePiece, onDelete }: ShapeInspectorSheetProps) {
  const { t } = useTranslation();
  const [pieceId, setPieceId] = useState<string | null>(null);

  useEffect(() => {
    if (forme) setPieceId(forme.piece_id);
  }, [forme]);

  const pieceOptions: { key: string; icon: IconName }[] = [
    { key: NO_PIECE_KEY, icon: 'autre' },
    ...pieces.map((p) => ({ key: p.id, icon: 'piece' as const })),
  ];
  const pieceLabel = (key: string) => (key === NO_PIECE_KEY ? t('plans.shape.no_piece') : (pieces.find((p) => p.id === key)?.name ?? ''));

  const handleSelectPiece = (key: string) => {
    const nextPieceId = key === NO_PIECE_KEY ? null : key;
    setPieceId(nextPieceId);
    onChoosePiece(nextPieceId);
  };

  return (
    <Modal visible={!!forme} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <View className="rounded-t-3xl bg-white px-6 pb-10 pt-6">
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text className="mb-4 text-xl font-bold text-ink">{t('plans.shape.title')}</Text>

            <Text className="mb-2 text-sm font-medium text-ink-soft">{t('plans.shape.piece_label')}</Text>
            <PresetPicker presets={pieceOptions} selectedKey={pieceId ?? NO_PIECE_KEY} onSelect={handleSelectPiece} labelFor={pieceLabel} />

            <Pressable onPress={onDelete} className="mb-3 mt-2">
              <Text className="text-center text-sm font-semibold text-red-600">{t('common.delete')}</Text>
            </Pressable>
            <Button label={t('common.close')} variant="ghost" onPress={onClose} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
