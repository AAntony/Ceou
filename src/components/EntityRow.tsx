import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { PLACEHOLDER_IMAGES, type EntityLevel } from '../features/inventory/placeholders';
import { STACK_SCALE, useScaled, useTextScale, WRAP_SCALE } from '../lib/textScale';
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
// EntityCard n'est PAS supprimée : les amis (des personnes) restent en
// grille, où le portrait carré a du sens. Les Plans, eux, sont passés en
// rangée le 23/08 avec une vignette de leur propre tracé.

const THUMB_WIDTH = 84;
// 4:3, le ratio des illustrations par défaut. Un carré les recadrerait.
const THUMB_HEIGHT = 63;
// Hauteur de la vignette quand la rangée passe en colonnes : elle prend
// alors toute la largeur, et 4:3 en ferait une affiche de 230 points de haut
// sur un téléphone. Elle est recadrée plutôt qu'étirée.
const STACKED_THUMB_HEIGHT = 150;
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
  /**
   * Vignette dessinée à la place de l'illustration. Sert aux Plans, qui ont
   * mieux qu'un croquis générique à montrer : leur propre tracé.
   */
  thumbnail?: ReactNode;
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
  /**
   * Déplacer cette rangée dans une liste ORDONNÉE.
   *
   * Seuls les Plans le sont aujourd'hui : leur ordre est celui des étages, et
   * c'est lui que reprend le sélecteur de niveau posé sur le plan. Passer
   * `undefined` à l'un des deux (première ou dernière rangée) grise la flèche
   * correspondante au lieu de la retirer — sans quoi les rangées n'auraient
   * pas toutes la même largeur utile.
   */
  onMoveUp?: () => void;
  onMoveDown?: () => void;
};

export function EntityRow({
  level,
  thumbnail,
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
  onMoveUp,
  onMoveDown,
}: EntityRowProps) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  // La vignette est dessinee en pixels (ratio 4:3 impose), donc hors de
  // portee de `rem` : elle grandit avec le texte pour ne pas devenir un
  // timbre-poste a cote d'un nom de 26 points.
  const thumbWidth = useScaled(THUMB_WIDTH);
  const thumbHeight = useScaled(THUMB_HEIGHT);
  const stackedThumbHeight = useScaled(STACKED_THUMB_HEIGHT);
  const { textScale } = useTextScale();
  const titleLines = textScale >= WRAP_SCALE ? 2 : 1;

  // EN GRAND TEXTE, LA RANGÉE SE PLIE EN DEUX.
  //
  // Vignette, pictogramme, nom, crayon et chevron se partagent une seule
  // ligne : dès x1,3 il ne reste au nom qu'une poignée de points, soit
  // « Meuble… ». La photo prend donc toute la première ligne, et le nom
  // partage la seconde avec les commandes — qui, elles, tiennent en deux
  // pictogrammes.
  //
  // Le PICTOGRAMME D'ENTITÉ DISPARAÎT : il redisait le type d'un contenu que
  // la photo montre déjà, et c'est lui qui coûtait le plus de largeur pour le
  // moins d'information.
  //
  // Seuil abaissé de x1,6 à x1,3 après essai sur appareil : à « Grande »
  // aussi, la rangée compacte ne tenait plus.
  const stacked = textScale >= STACK_SCALE;

  const favoriteButton = onToggleFavorite ? (
    <Pressable
      onPress={onToggleFavorite}
      disabled={favoriteDisabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityState={{ selected: isFavorite, disabled: favoriteDisabled }}
      accessibilityLabel={t(isFavorite ? 'a11y.favorite_remove' : 'a11y.favorite_add', { name: title })}
      className={`absolute left-1 top-1 rounded-full bg-white/85 p-1 ${favoriteDisabled ? 'opacity-50' : ''}`}
    >
      <Icon name={isFavorite ? 'star' : 'starOutline'} size={14} color={isFavorite ? colors.mustard : ON_LIGHT_PILL} />
    </Pressable>
  ) : null;

  // Les deux flèches d'ordre, en colonne serrée : elles disent « au-dessus »
  // et « en dessous », ce qui est exactement le geste rendu. Rendues dès que
  // l'une des deux existe, la manquante restant grisée à sa place.
  const reorderButtons =
    onMoveUp || onMoveDown ? (
      <View className="mr-1">
        <Pressable
          onPress={onMoveUp}
          disabled={!onMoveUp}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityState={{ disabled: !onMoveUp }}
          accessibilityLabel={t('a11y.move_up_named', { name: title })}
          className={`px-1 ${onMoveUp ? 'active:opacity-60' : 'opacity-25'}`}
        >
          <Icon name="moveUp" size={20} color={colors.inkSoft} />
        </Pressable>
        <Pressable
          onPress={onMoveDown}
          disabled={!onMoveDown}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityState={{ disabled: !onMoveDown }}
          accessibilityLabel={t('a11y.move_down_named', { name: title })}
          className={`px-1 ${onMoveDown ? 'active:opacity-60' : 'opacity-25'}`}
        >
          <Icon name="moveDown" size={20} color={colors.inkSoft} />
        </Pressable>
      </View>
    ) : null;

  const media = thumbnail ?? (
    <Image
      source={photoUri ? { uri: photoUri } : PLACEHOLDER_IMAGES[level]}
      style={{ width: '100%', height: '100%' }}
      contentFit="cover"
    />
  );

  if (stacked) {
    return (
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        accessibilityRole="button"
        className="mb-2.5 rounded-2xl bg-surface p-2.5 active:opacity-70"
      >
        <View
          style={{ width: '100%', height: stackedThumbHeight }}
          className="overflow-hidden rounded-xl bg-sand"
        >
          {media}
          {favoriteButton}
        </View>

        {/* Deuxième ligne : le nom, et les commandes à sa droite. Le nom a
            désormais toute la largeur que lui laissaient la vignette et le
            pictogramme, soit l'essentiel de la carte. */}
        <View className="mt-2 flex-row items-center gap-2">
          <View className="flex-1">
            <Text className="text-body font-semibold text-ink">{title}</Text>
            {subtitle ? <Text className="mt-0.5 text-label text-ink-soft">{subtitle}</Text> : null}
          </View>
          {reorderButtons}
          {onEdit ? (
            <Pressable
              onPress={onEdit}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t('a11y.edit_named', { name: title })}
              className="rounded-full border border-ink/10 p-2 active:opacity-60"
            >
              <Icon name="pencil" size={18} color={colors.inkSoft} />
            </Pressable>
          ) : null}
          <Icon name="chevron" size={22} color={colors.inkFaint} />
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      className="mb-2.5 flex-row items-center rounded-2xl bg-surface p-2.5 active:opacity-70"
    >
      <View
        style={{ width: thumbWidth, height: thumbHeight }}
        className="overflow-hidden rounded-xl bg-sand"
      >
        {media}

        {/* L'étoile est posée SUR la vignette et non dans la rangée : à
            droite, elle aurait été le troisième bouton d'affilée après le
            crayon et le chevron, et le nom aurait perdu la place qu'on vient
            justement de lui donner. */}
        {favoriteButton}
      </View>

      <View className="ml-3 mr-3">
        <Icon name={icon} size={30} color={iconColor} />
      </View>

      <View className="flex-1">
        <Text numberOfLines={titleLines} className="text-body font-semibold text-ink">
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} className="mt-0.5 text-label text-ink-soft">
            {subtitle}
          </Text>
        ) : null}
      </View>

      {reorderButtons}

      {onEdit ? (
        <Pressable
          onPress={onEdit}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.edit_named', { name: title })}
          className="ml-1 p-1.5 active:opacity-60"
        >
          <Icon name="pencil" size={18} color={colors.inkFaint} />
        </Pressable>
      ) : null}

      <Icon name="chevron" size={22} color={colors.inkFaint} />
    </Pressable>
  );
}
