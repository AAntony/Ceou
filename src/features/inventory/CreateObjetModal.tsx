import { useTranslation } from 'react-i18next';
import { Modal, Text, View } from 'react-native';
import type { LocationType } from '../../types/database';
import { ObjetFormBody } from './ObjetFormBody';

type CreateObjetModalProps = {
  visible: boolean;
  onClose: () => void;
  parentType: LocationType;
  parentId: string;
};

export function CreateObjetModal({ visible, onClose, parentType, parentId }: CreateObjetModalProps) {
  const { t } = useTranslation();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <View className="rounded-t-3xl bg-white pt-6">
          <Text className="mb-4 px-6 text-xl font-bold text-ink">{t('inventory.container.create_objet_title')}</Text>
          <ObjetFormBody parentType={parentType} parentId={parentId} active={visible} onDone={onClose} onCancel={onClose} />
        </View>
      </View>
    </Modal>
  );
}
