import { CameraView, useCameraPermissions, type BarcodeType } from 'expo-camera';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { useReducedMotion } from '../lib/useReducedMotion';
import { Button } from './Button';
import { createScannerSession } from './scannerSession';

type CodeScannerProps = {
  visible: boolean;
  onClose: () => void;
  onScanned: (data: string) => void;
  barcodeTypes: BarcodeType[];
  hint: string;
  permissionMessage: string;
};

export function CodeScanner({ visible, ...props }: CodeScannerProps) {
  // Closing releases the camera and the session; reopening starts from scratch.
  return visible ? <ScannerSession {...props} /> : null;
}

function ScannerSession({ onClose, onScanned, barcodeTypes, hint, permissionMessage }: Omit<CodeScannerProps, 'visible'>) {
  const { t } = useTranslation();
  const [permission, requestPermission] = useCameraPermissions();
  const session = useRef(createScannerSession());
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    const current = createScannerSession();
    session.current = current;
    return () => current.cancel();
  }, []);
  const close = () => { session.current.cancel(); onClose(); };

  return <Modal visible animationType={reducedMotion ? 'none' : 'slide'} onRequestClose={close}>
    <View className="flex-1 bg-black" accessibilityViewIsModal onAccessibilityEscape={close}>
      {!permission ? <View className="flex-1 items-center justify-center"><ActivityIndicator color="white" /></View>
        : !permission.granted ? <View className="flex-1 items-center justify-center px-8">
          <Text className="mb-4 text-center text-body text-white">{permissionMessage}</Text>
          <Button label={t('inventory.objet.scan_permission_grant')} onPress={requestPermission} />
        </View> : <>
          <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes }}
            onBarcodeScanned={result => { session.current.accept(result.data, onScanned); }} />
          <View className="absolute inset-x-0 top-16 items-center px-6" pointerEvents="none">
            <Text className="rounded-2xl bg-black/70 px-4 py-2 text-center text-body text-white">{hint}</Text>
          </View>
        </>}
      <Pressable accessibilityRole="button" accessibilityLabel={t('common.cancel')} onPress={close}
        className="absolute bottom-12 min-h-[48px] justify-center self-center rounded-full bg-white px-6 py-3">
        <Text className="text-label font-semibold" style={{ color: '#17232B' }}>{t('common.cancel')}</Text>
      </Pressable>
    </View>
  </Modal>;
}
