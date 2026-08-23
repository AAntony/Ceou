import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import type { LocationType } from '../../types/database';
import { LocationTreePicker } from './LocationTreePicker';
import { useMoveObjet } from './queries';
import { useThemeColors } from '../../lib/theme';

type MoveObjetModalProps = {
  visible: boolean;
  onClose: () => void;
  objetId: string;
};

export function MoveObjetModal({ visible, onClose, objetId }: MoveObjetModalProps) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const moveObjet = useMoveObjet(objetId);

  const handleChoose = async (type: LocationType, id: string) => {
    await moveObjet.mutateAsync({ type, id });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-sand pt-16">
        <View className="mb-2 flex-row items-center justify-between px-6">
          <View style={{ width: 22 }} />
          <Text className="text-lg font-bold text-ink">{t('inventory.objet.move_title')}</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Icon name="close" size={22} color={colors.ink} />
          </Pressable>
        </View>

        <ScrollView contentContainerClassName="px-6 pb-10 pt-2">
          <LocationTreePicker
            active={visible}
            confirmLabel={t('inventory.objet.move_choose_here')}
            loading={moveObjet.isPending}
            onChoose={handleChoose}
          />
        </ScrollView>
      </View>
    </Modal>
  );
}
