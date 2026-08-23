import { Image } from 'expo-image';
import { Pressable, Text, View } from 'react-native';
import { PLACEHOLDER_IMAGES, type EntityLevel } from '../features/inventory/placeholders';
import { useThemeColors } from '../lib/theme';
import { Icon, type IconName } from './Icon';

// Rangée de liste pleine largeur — vignette, icône, nom, compteur, chevron.
//
// Remplace la grille à deux colonnes (EntityCard) sur les quatre niveaux de
// l'inventaire. Trois raisons, dans l'ordre d'importance :
//
// - LA CIBLE FAIT TOUTE LA LARGEUR. Une tuile de 48 % d'écran demande de
//   viser ; une rangée, non. C'est la même logique que le bouton de
//   l'assistant : ce qui se tape sans réfléchir sert tout le monde, et
//   d'abord ceux qui visent mal.
// - LE NOM TIENT. « Meuble d'entrée du couloir » était tronqué en tuile.
// - LE COMPTEUR A ENFIN SA PLACE. « 18 objets » est l'information qui dit si
//   un endroit est vraiment renseigné ou seulement déclaré — impossible à
//   loger dans une tuile déjà occupée par le nom.
//
// EntityCard n'est PAS supprimée : les amis (des personnes) et les plans
// restent en grille, où le portrait carré a du sens.

const THUMB_WIDTH = 84;
// 4:3, le ratio des illustrations par défaut. Un carré les recadrerait.
const THUMB_HEIGHT = 63;
// Les pastilles crayon/etoile sont posees sur un fond BLANC fixe (elles se
// superposent a une photo ou a une carte coloree, ou un fond translucide
// clair reste la seule valeur lisible dans les deux themes). Leur icone doit
// donc rester sombre elle aussi : prise dans le theme, elle s'eclaircissait
// en mode sombre et disparaissait sur la pastille.
const ON_LIGHT_PILL = '#6B6459';

const ACCENT = '#1591EA';

type EntityRowProps = {
  /** Détermine l'illustration affichée à défaut de photo. */
  level: EntityLevel;
  icon: IconName;
  title: string;
  subtitle?: string;
  photoUri?: string | null;
  iconColor?: string;
  onPress: () => void;
  onLongPress?: () => void;
  onEdit?: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  favoriteDisabled?: boolean;
};

export function EntityRow({
  level,
  icon,
  title,
  subtitle,
  photoUri,
  iconColor = ACCENT,
  onPress,
  onLongPress,
  onEdit,
  isFavorite,
  onToggleFavorite,
  favoriteDisabled,
}: EntityRowProps) {
  const colors = useThemeColors();

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      className="mb-2.5 flex-row items-center rounded-2xl bg-surface p-2.5 active:opacity-70"
    >
      <View
        style={{ width: THUMB_WIDTH, height: THUMB_HEIGHT }}
        className="overflow-hidden rounded-xl bg-sand"
      >
        <Image
          source={photoUri ? { uri: photoUri } : PLACEHOLDER_IMAGES[level]}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
        />

        {/* L'étoile est posée SUR la vignette et non dans la rangée : à
            droite, elle aurait été le troisième bouton d'affilée après le
            crayon et le chevron, et le nom aurait perdu la place qu'on vient
            justement de lui donner. */}
        {onToggleFavorite ? (
          <Pressable
            onPress={onToggleFavorite}
            disabled={favoriteDisabled}
            hitSlop={8}
            className={`absolute left-1 top-1 rounded-full bg-white/85 p-1 ${favoriteDisabled ? 'opacity-50' : ''}`}
          >
            <Icon name={isFavorite ? 'star' : 'starOutline'} size={14} color={isFavorite ? colors.mustard : ON_LIGHT_PILL} />
          </Pressable>
        ) : null}
      </View>

      <View className="ml-3 mr-3">
        <Icon name={icon} size={30} color={iconColor} />
      </View>

      <View className="flex-1">
        <Text numberOfLines={1} className="text-base font-semibold text-ink">
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} className="mt-0.5 text-sm text-ink-soft">
            {subtitle}
          </Text>
        ) : null}
      </View>

      {onEdit ? (
        <Pressable onPress={onEdit} hitSlop={10} className="ml-1 p-1.5 active:opacity-60">
          <Icon name="pencil" size={18} color={colors.inkFaint} />
        </Pressable>
      ) : null}

      <Icon name="chevron" size={22} color={colors.inkFaint} />
    </Pressable>
  );
}
