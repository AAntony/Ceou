import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import type { IconName } from '../../components/Icon';
import { PresetPicker } from '../../components/PresetPicker';
import { TextField } from '../../components/TextField';
import type { Piece, PlanForme } from '../../types/database';

const NO_PIECE_KEY = '__none__';

type ShapeInspectorSheetProps = {
  forme: PlanForme | null;
  pieces: Piece[];
  onClose: () => void;
  onSave: (patch: { width: number; height: number; pieceId: string | null }) => void;
  onDelete: () => void;
  loading?: boolean;
};

export function ShapeInspectorSheet({ forme, pieces, onClose, onSave, onDelete, loading }: ShapeInspectorSheetProps) {
  const { t } = useTranslation();
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [pieceId, setPieceId] = useState<string | null>(null);

  useEffect(() => {
    if (forme) {
      setWidth(String(Math.round(forme.width)));
      setHeight(String(Math.round(forme.height)));
      setPieceId(forme.piece_id);
    }
  }, [forme]);

  const handleSave = () => {
    const w = parseInt(width, 10);
    const h = parseInt(height, 10);
    if (!w || !h) return;
    onSave({ width: w, height: h, pieceId });
  };

  const pieceOptions: { key: string; icon: IconName }[] = [
    { key: NO_PIECE_KEY, icon: 'autre' },
    ...pieces.map((p) => ({ key: p.id, icon: 'piece' as const })),
  ];
  const pieceLabel = (key: string) => (key === NO_PIECE_KEY ? t('plans.shape.no_piece') : (pieces.find((p) => p.id === key)?.name ?? ''));

  return (
    <Modal visible={!!forme} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <View className="rounded-t-3xl bg-white px-6 pb-10 pt-6">
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text className="mb-4 text-xl font-bold text-ink">{t('plans.shape.title')}</Text>

            <View className="flex-row gap-3">
              <View className="flex-1">
                <TextField label={t('plans.shape.width')} value={width} onChangeText={setWidth} keyboardType="numeric" />
              </View>
              <View className="flex-1">
                <TextField label={t('plans.shape.height')} value={height} onChangeText={setHeight} keyboardType="numeric" />
              </View>
            </View>

            <Text className="mb-2 text-sm font-medium text-ink-soft">{t('plans.shape.piece_label')}</Text>
            <PresetPicker
              presets={pieceOptions}
              selectedKey={pieceId ?? NO_PIECE_KEY}
              onSelect={(key) => setPieceId(key === NO_PIECE_KEY ? null : key)}
              labelFor={pieceLabel}
            />

            <View className="mb-3 mt-2">
              <Button label={t('common.save')} onPress={handleSave} loading={loading} />
            </View>
            <Pressable onPress={onDelete} className="mb-3">
              <Text className="text-center text-sm font-semibold text-red-600">{t('common.delete')}</Text>
            </Pressable>
            <Button label={t('common.cancel')} variant="ghost" onPress={onClose} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
