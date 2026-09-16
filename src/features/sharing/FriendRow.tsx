import { CeouAvatar } from '../../components/CeouAvatar';
import { Image } from 'expo-image';
import { Pressable, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { useMediaSource } from '../../lib/images/media';
import { STACK_SCALE, useScaled, useTextScale, WRAP_SCALE } from '../../lib/textScale';
import { useThemeColors } from '../../lib/theme';

// Rangée d'ami.
//
// Même structure que les rangées d'inventaire (vignette, nom, information
// utile, chevron) mais avec un AVATAR ROND, et c'est un écart assumé : un
// visage dans un cadre 4:3 ne se lit pas comme une personne. Le cercle est
// la convention partout, au point qu'une photo de profil carrée passe pour
// une erreur d'affichage.
//
// D'où un composant à part plutôt qu'une option de plus sur EntityRow :
// EntityRow est bâtie autour d'un niveau d'inventaire et de son illustration
// par défaut, deux notions qui n'ont aucun sens pour une personne.

const AVATAR_SIZE = 42;

type FriendRowProps = {
  id: string;
  name: string;
  subtitle?: string;
  avatarUrl?: string | null;
  onPress: () => void;
};

export function FriendRow({ name, subtitle, avatarUrl, onPress }: FriendRowProps) {
  const colors = useThemeColors();
  const avatarPhoto = useMediaSource(avatarUrl);

  // L'avatar et ses initiales sont dessines en pixels : ils grandissent avec
  // le texte du nom pose a cote, sinon le cercle devient un point.
  const avatarSize = useScaled(AVATAR_SIZE);

  const { textScale } = useTextScale();
  const titleLines = textScale >= WRAP_SCALE ? 2 : 1;

  // EN GRAND TEXTE, LE SOUS-TITRE DESCEND SOUS L'AVATAR.
  //
  // Le nom et « 3 habitations partagées » vivent aujourd'hui dans la même
  // colonne, à droite du portrait : cette colonne perd la largeur du
  // portrait ET celle du chevron. À x1,3 le sous-titre y est le premier
  // sacrifié, alors que c'est lui qui dit ce que cet ami partage avec vous.
  // Sur sa propre ligne il retrouve toute la largeur de la carte.
  const stacked = textScale >= STACK_SCALE;

  const avatar = (
    <View
      style={{ width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2, backgroundColor: colors.accent }}
      className="items-center justify-center overflow-hidden"
    >
      {avatarPhoto ? (
        <Image source={avatarPhoto} style={{ width: '100%', height: '100%' }} contentFit="cover" />
      ) : (
        <CeouAvatar size={avatarSize} />
      )}
    </View>
  );

  if (stacked) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        className="mb-2 rounded-2xl bg-surface p-2.5 active:opacity-70"
      >
        <View className="flex-row items-center">
          {avatar}
          <Text numberOfLines={titleLines} className="ml-3 flex-1 text-body font-semibold text-ink">
            {name}
          </Text>
          <Icon name="chevron" size={22} color={colors.inkFaint} />
        </View>
        {subtitle ? <Text className="mt-1.5 text-label text-ink-soft">{subtitle}</Text> : null}
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="mb-2 flex-row items-center rounded-2xl bg-surface p-2.5 active:opacity-70"
    >
      {avatar}

      <View className="ml-3 flex-1">
        <Text numberOfLines={titleLines} className="text-body font-semibold text-ink">
          {name}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} className="mt-0.5 text-label text-ink-soft">
            {subtitle}
          </Text>
        ) : null}
      </View>

      <Icon name="chevron" size={22} color={colors.inkFaint} />
    </Pressable>
  );
}
