import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { BottomSheetModal } from '../../components/BottomSheetModal';
import { Button } from '../../components/Button';
import { IconBadge } from '../../components/IconBadge';
import type { IconName } from '../../components/Icon';
import type { PlanPin } from '../../types/database';

type PlanPinSheetProps = {
  pin: PlanPin | null;
  display: { name: string; icon: IconName } | null;
  onClose: () => void;
  onRemove: () => void;
};

// Fiche minimale (calquée sur ShapeInspectorSheet) : la pastille ne porte
// qu'une seule décision possible — la retirer du plan. Le déplacement se
// fait directement au glisser sur le plan, pas ici.
export function PlanPinSheet({ pin, display, onClose, onRemove }: PlanPinSheetProps) {
  const { t } = useTranslation();

  return (
    <BottomSheetModal
      visible={!!pin && !!display}
      onClose={onClose}
      sheetClassName="items-center rounded-t-3xl bg-white px-6 pb-10 pt-6"
    >
      {display ? (
        <>
          <IconBadge icon={display.icon} fill="#F3EFE9" size={56} />
          <Text className="mb-4 mt-3 text-xl font-bold text-ink">{display.name}</Text>
        </>
      ) : null}

      <View className="mb-3 mt-2">
        <Button label={t('plans.pins.remove')} variant="danger" onPress={onRemove} />
      </View>
      <Button label={t('common.close')} variant="ghost" onPress={onClose} />
    </BottomSheetModal>
  );
}
