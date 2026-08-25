import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import type { LocationType } from '../../types/database';
import { LocationTreePicker } from './LocationTreePicker';
import { useMoveObjet } from './queries';
import { useScaled } from '../../lib/textScale';
import { useThemeColors } from '../../lib/theme';

type MoveObjetModalProps = {
  visible: boolean;
  onClose: () => void;
  objetId: string;
};

export function MoveObjetModal({ visible, onClose, objetId }: MoveObjetModalProps) {
  const colors = useThemeColors();
  const spacerWidth = useScaled(22);
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
          {/* Espaceur de la largeur de la croix d'en face, pour que le titre
              reste centre. Mis a l'echelle comme elle. */}
          <View style={{ width: spacerWidth }} />
          <Text numberOfLines={1} className="flex-1 px-2 text-center text-subheading font-bold text-ink">
            {t('inventory.objet.move_title')}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={onClose} hitSlop={8}>
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
