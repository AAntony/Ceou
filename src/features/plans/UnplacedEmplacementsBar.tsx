import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { PresetPicker } from '../../components/PresetPicker';
import { getEmplacementIcon } from '../inventory/constants';
import { useEmplacements } from '../inventory/queries';
import type { PlanPin } from '../../types/database';

type UnplacedEmplacementsBarProps = {
  pieceId: string;
  pins: PlanPin[];
  onPlace: (emplacementId: string) => void;
};

// Chips des Emplacements de la pièce sélectionnée qui n'ont pas encore de
// pastille sur CE plan — tap pour en poser une au centre de la pièce,
// prête à être glissée. Réutilise PresetPicker (déjà utilisé pour les types
// de forme/preset ailleurs dans l'app).
export function UnplacedEmplacementsBar({ pieceId, pins, onPlace }: UnplacedEmplacementsBarProps) {
  const { t } = useTranslation();
  const { data: emplacements } = useEmplacements(pieceId);

  const placedIds = new Set(pins.map((p) => p.emplacement_id));
  const unplaced = (emplacements ?? []).filter((e) => !placedIds.has(e.id));

  if (unplaced.length === 0) return null;

  return (
    <View className="mb-3">
      <Text className="mb-2 text-xs font-medium text-ink-soft">{t('plans.unplaced_title')}</Text>
      <PresetPicker
        presets={unplaced.map((e) => ({ key: e.id, icon: getEmplacementIcon(e.preset_key) }))}
        selectedKey={null}
        onSelect={onPlace}
        labelFor={(key) => unplaced.find((e) => e.id === key)?.name ?? ''}
      />
    </View>
  );
}
