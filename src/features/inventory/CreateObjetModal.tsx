import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';
import { BottomSheetModal } from '../../components/BottomSheetModal';
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
    <BottomSheetModal visible={visible} onClose={onClose} sheetClassName="rounded-t-3xl bg-white pt-6">
      <Text className="mb-4 px-6 text-xl font-bold text-ink">{t('inventory.container.create_objet_title')}</Text>
      <ObjetFormBody parentType={parentType} parentId={parentId} active={visible} onDone={onClose} onCancel={onClose} />
    </BottomSheetModal>
  );
}
