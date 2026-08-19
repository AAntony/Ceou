import { Pressable, Text, View } from 'react-native';
import { Icon, type IconName } from './Icon';
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
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={{ backgroundColor: bgColor }}
      className="mb-3 w-[48%] rounded-2xl p-4 active:opacity-70"
    >
      {onEdit ? (
        <Pressable onPress={onEdit} hitSlop={8} className="absolute right-2 top-2 z-10 rounded-full bg-white/70 p-1.5">
          <Icon name="pencil" size={14} color="#6B6459" />
        </Pressable>
      ) : null}
      {onToggleFavorite ? (
        <Pressable
          onPress={onToggleFavorite}
          disabled={favoriteDisabled}
          hitSlop={8}
          className={`absolute bottom-2 right-2 z-10 rounded-full bg-white/70 p-1.5 ${favoriteDisabled ? 'opacity-50' : ''}`}
        >
          <Icon name={isFavorite ? 'star' : 'starOutline'} size={14} color={isFavorite ? '#FFC857' : '#A39C8F'} />
        </Pressable>
      ) : null}
      <View className="mb-3">
        <IconBadge icon={icon} fill={badgeColor} photoUri={imageUri} size={52} />
      </View>
      <Text numberOfLines={1} className="text-base font-semibold text-ink">
        {title}
      </Text>
      {subtitle ? (
        <Text numberOfLines={1} className="mt-0.5 text-xs text-ink-soft">
          {subtitle}
        </Text>
      ) : null}
    </Pressable>
  );
}
