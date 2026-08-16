import { Image } from 'expo-image';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  if (!uri) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black">
        <Pressable className="flex-1 items-center justify-center" onPress={onClose}>
          <Image source={{ uri }} style={{ width: '100%', height: '100%' }} contentFit="contain" />
        </Pressable>
        <Pressable
          onPress={onClose}
          hitSlop={8}
          className="absolute right-5 h-10 w-10 items-center justify-center rounded-full bg-black/50"
          style={{ top: insets.top + 12 }}
        >
          <Icon name="close" size={22} color="#FFFBF8" />
        </Pressable>
      </View>
    </Modal>
  );
}
