import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { BottomSheetModal } from '../../components/BottomSheetModal';
import { Icon } from '../../components/Icon';
import type { LocationType } from '../../types/database';
import { AiPhotoScanFlow } from './AiPhotoScanFlow';
import { ObjetFormBody } from './ObjetFormBody';

type CreateObjetModalProps = {
  visible: boolean;
  onClose: () => void;
  parentType: LocationType;
  parentId: string;
};

type Mode = 'manual' | 'scan';

export function CreateObjetModal({ visible, onClose, parentType, parentId }: CreateObjetModalProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>('manual');

  useEffect(() => {
    if (visible) setMode('manual');
  }, [visible]);

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      sheetClassName="rounded-t-3xl bg-white pt-6"
      sheetStyle={mode === 'scan' ? { height: '88%' } : undefined}
    >
      <View className="mb-4 flex-row items-center justify-between px-6">
        <Text className="text-xl font-bold text-ink">
          {mode === 'scan' ? t('inventory.aiScan.title') : t('inventory.container.create_objet_title')}
        </Text>
        {/* Bascule manuel/scan — indépendante des boutons Annuler/Enregistrer
            de chaque formulaire, qui referment toujours toute la feuille. */}
        <Pressable onPress={() => setMode(mode === 'manual' ? 'scan' : 'manual')} hitSlop={8}>
          <Icon name={mode === 'manual' ? 'scan' : 'objet'} size={22} color="#E2543A" />
        </Pressable>
      </View>
      <View style={{ flex: 1, display: mode === 'manual' ? 'flex' : 'none' }}>
        <ObjetFormBody parentType={parentType} parentId={parentId} active={visible} onDone={onClose} onCancel={onClose} />
      </View>
      <View style={{ flex: 1, display: mode === 'scan' ? 'flex' : 'none' }}>
        <AiPhotoScanFlow parentType={parentType} parentId={parentId} active={visible && mode === 'scan'} onDone={onClose} onCancel={onClose} />
      </View>
    </BottomSheetModal>
  );
}
