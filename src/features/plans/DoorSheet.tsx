import { useTranslation } from 'react-i18next';
import { Modal, Pressable, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import type { PlanDoor } from '../../types/database';

type DoorSheetProps = {
  door: PlanDoor | null;
  onClose: () => void;
  onRemove: () => void;
};

// Fiche minimale (calquée sur PlanPinSheet) : une porte ne porte qu'une
// seule décision possible — la retirer. Pas de nom/icône à afficher, le
// déplacement se fait directement au glisser sur le plan.
export function DoorSheet({ door, onClose, onRemove }: DoorSheetProps) {
  const { t } = useTranslation();

  return (
    <Modal visible={!!door} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <View className="rounded-t-3xl bg-white px-6 pb-10 pt-6">
          <Pressable onPress={onRemove} className="mb-3 mt-2">
            <Text className="text-center text-sm font-semibold text-red-600">{t('plans.doors.remove')}</Text>
          </Pressable>
          <Button label={t('common.close')} variant="ghost" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}
