import { Image } from 'expo-image';
import { View } from 'react-native';
import { useThemeColors } from '../lib/theme';
import { Icon, type IconName } from './Icon';

type IconBadgeProps = {
  icon: IconName;
  fill: string;
  size?: number;
  photoUri?: string | null;
  iconColor?: string;
  borderColor?: string;
  borderWidth?: number;
};

// Badge circulaire (View + borderRadius), pas de forme hexagonale SVG :
// react-native-svg est un module natif absent du dev-client déjà installé
// sur l'appareil de test — l'utiliser planterait l'app (IllegalViewOperation
// Exception: Can't find ViewManager) tant qu'un nouveau build EAS n'a pas
// été fait, ce qui n'est pas demandé pour l'instant.
export function IconBadge({ icon, fill, size = 56, photoUri, iconColor, borderColor, borderWidth = 0 }: IconBadgeProps) {
  const colors = useThemeColors();

  return (
    <View
      className="items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: fill,
        overflow: 'hidden',
        borderWidth: borderColor ? borderWidth : 0,
        borderColor,
      }}
    >
      {photoUri ? (
        <Image source={{ uri: photoUri }} style={{ width: size, height: size }} />
      ) : (
        <Icon name={icon} size={size * 0.42} color={iconColor ?? colors.ink} />
      )}
    </View>
  );
}
