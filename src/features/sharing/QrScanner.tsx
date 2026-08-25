import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { TextLink } from '../../components/TextLink';

type QrScannerProps = {
  visible: boolean;
  onClose: () => void;
  onScanned: (data: string) => void;
};

// Calqué sur BarcodeScanner.tsx (même CameraView, même permission) mais pour
// les QR d'ajout d'ami/invitation — types séparés dans expo-camera, d'où un
// composant distinct plutôt qu'une simple extension de la liste de types du
// scanner code-barre existant (concerns différents, i18n différent).
export function QrScanner({ visible, onClose, onScanned }: QrScannerProps) {
  const { t } = useTranslation();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (visible) setScanned(false);
  }, [visible]);

  const handleScanned = (result: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    onScanned(result.data);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-black">
        {!permission ? null : !permission.granted ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="mb-4 text-center text-body text-white">{t('friends.scan_permission_message')}</Text>
            <Button label={t('inventory.objet.scan_permission_grant')} onPress={requestPermission} />
            <TextLink onPress={onClose} label={t('common.cancel')} className="mt-4 items-center px-4" textClassName="text-white" />
          </View>
        ) : (
          <>
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={handleScanned}
            />
            <View className="absolute inset-x-0 top-16 items-center px-6">
              <Text className="overflow-hidden rounded-full bg-black/50 px-4 py-2 text-center text-white">
                {t('friends.scan_hint')}
              </Text>
            </View>
            <Pressable accessibilityRole="button" onPress={onClose} className="absolute bottom-12 self-center rounded-full bg-white/90 px-6 py-3">
              <Text className="font-semibold text-ink">{t('common.cancel')}</Text>
            </Pressable>
          </>
        )}
      </View>
    </Modal>
  );
}
