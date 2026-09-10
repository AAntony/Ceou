import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMediaSource } from '../lib/images/media';
import { Icon } from './Icon';

type PhotoViewerModalProps = {
  visible: boolean;
  uri: string | null;
  onClose: () => void;
};

// Visionneuse plein écran minimale — juste "voir en grand", pas de
// pinch/pan gestuel dans cette première itération (pas demandé). Tap
// n'importe où sur la photo OU sur le bouton fermer referme, pattern
// standard des visionneuses photo.
export function PhotoViewerModal({ visible, uri, onClose }: PhotoViewerModalProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  // Avant le retour anticipe : un hook ne peut pas etre appele apres.
  const photo = useMediaSource(uri);
  // LA CONDITION PORTE SUR `uri` ET NON SUR `photo`, et la nuance compte
  // depuis que la source se fait signer. `photo` vaut null le temps de
  // l'appel : fermer la visionneuse la-dessus la ferait ne pas s'ouvrir du
  // tout pendant ce delai, alors qu'on vient d'appuyer sur la photo. On
  // ouvre donc sur fond noir, et l'image arrive.
  if (!uri) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black">
        <Pressable
          className="flex-1 items-center justify-center"
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        >
          <Image source={photo ?? undefined} style={{ width: '100%', height: '100%' }} contentFit="contain" />
        </Pressable>
        <Pressable
          onPress={onClose}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          className="absolute right-5 h-10 w-10 items-center justify-center rounded-full bg-black/50"
          style={{ top: insets.top + 12 }}
        >
          <Icon name="close" size={22} color="#FFFBF8" />
        </Pressable>
      </View>
    </Modal>
  );
}
