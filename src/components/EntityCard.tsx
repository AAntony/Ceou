import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { Icon, type IconName } from './Icon';
import { useTextScale, WRAP_SCALE } from '../lib/textScale';
import { useEntityTints, useThemeColors } from '../lib/theme';
import { IconBadge } from './IconBadge';

type EntityCardProps = {
  icon: IconName;
  imageUri?: string | null;
  title: string;
  subtitle?: string;
  bgColor?: string;
  badgeColor?: string;
  onPress: () => void;
  onLongPress?: () => void;
  onEdit?: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  // Vrai pendant que le basculement de CETTE carte est en vol. La mise à
  // jour du cache étant optimiste, l'étoile change d'état immédiatement :
  // sans ce verrou, un double tap rapide envoyait un delete et un upsert
  // concurrents dont l'ordre d'arrivée décidait de l'état final.
  favoriteDisabled?: boolean;
};

// Teinte par défaut (teal) pour les appelants qui n'en précisent pas encore
// une (ex. LocationTreePicker, PlansList — listés à part, hors du périmètre
// de la refonte en grille demandée) plutôt que de leur imposer une couleur
// à changer.
// Les pastilles crayon/etoile sont posees sur un fond BLANC fixe (elles se
// superposent a une photo ou a une carte coloree, ou un fond translucide
// clair reste la seule valeur lisible dans les deux themes). Leur icone doit
// donc rester sombre elle aussi : prise dans le theme, elle s'eclaircissait
// en mode sombre et disparaissait sur la pastille.
const ON_LIGHT_PILL = '#6B6459';

const DEFAULT_BG = '#DBF7F4';
const DEFAULT_BADGE = '#2EC4B6';

// Tuile de grille 2 colonnes (même langage visuel que ResultCard sur
// l'écran d'accueil — icône/photo dans un badge, nom, fond pastel) plutôt
// qu'une rangée pleine largeur : plus agréable visuellement sur les listes
// d'inventaire, et cohérent avec le reste de l'app.
export function EntityCard({
  icon,
  imageUri,
  title,
  subtitle,
  bgColor = DEFAULT_BG,
  badgeColor = DEFAULT_BADGE,
  onPress,
  onLongPress,
  onEdit,
  isFavorite,
  onToggleFavorite,
  favoriteDisabled,
}: EntityCardProps) {
  const colors = useThemeColors();
  const { surfaceTint } = useEntityTints();
  const { t } = useTranslation();
  // Deux lignes SEULEMENT en gros texte. Ces tuiles vivent dans une grille
  // qui s'enroule : a taille normale, laisser deux lignes rendrait les
  // rangees dentelees (une carte haute a cote d'une basse) pour un gain nul,
  // la plupart des noms tenant deja. Une fois le texte agrandi, c'est
  // l'inverse : presque tous depassent, et une rangee dentelee coute moins
  // cher qu'un nom coupe.
  const { textScale } = useTextScale();
  const titleLines = textScale >= WRAP_SCALE ? 2 : 1;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      style={{ backgroundColor: surfaceTint(bgColor) }}
      className="mb-3 w-[48%] rounded-2xl p-4 active:opacity-70"
    >
      {onEdit ? (
        <Pressable
          onPress={onEdit}
          hitSlop={8}
          accessibilityRole="button"
          // Le nom dans le libellé : « Modifier » seul, répété sur chaque
          // carte d'une grille, ne dit pas laquelle on s'apprête à modifier.
          accessibilityLabel={t('a11y.edit_named', { name: title })}
          className="absolute right-2 top-2 z-10 rounded-full bg-white/70 p-1.5"
        >
          <Icon name="pencil" size={14} color={ON_LIGHT_PILL} />
        </Pressable>
      ) : null}
      {onToggleFavorite ? (
        <Pressable
          onPress={onToggleFavorite}
          disabled={favoriteDisabled}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityState={{ selected: isFavorite, disabled: favoriteDisabled }}
          accessibilityLabel={t(isFavorite ? 'a11y.favorite_remove' : 'a11y.favorite_add', { name: title })}
          className={`absolute bottom-2 right-2 z-10 rounded-full bg-white/70 p-1.5 ${favoriteDisabled ? 'opacity-50' : ''}`}
        >
          <Icon name={isFavorite ? 'star' : 'starOutline'} size={14} color={isFavorite ? colors.mustard : ON_LIGHT_PILL} />
        </Pressable>
      ) : null}
      <View className="mb-3">
        <IconBadge icon={icon} fill={badgeColor} photoUri={imageUri} size={52} />
      </View>
      <Text numberOfLines={titleLines} className="text-body font-semibold text-ink">
        {title}
      </Text>
      {subtitle ? (
        <Text numberOfLines={1} className="mt-0.5 text-caption text-ink-soft">
          {subtitle}
        </Text>
      ) : null}
    </Pressable>
  );
}
