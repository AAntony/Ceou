import { ActivityIndicator, Pressable, Text, type PressableProps } from 'react-native';
import { useScaled } from '../lib/textScale';
import { useThemeColors } from '../lib/theme';
import {
  BUTTON_DISABLED,
  BUTTON_LABEL,
  BUTTON_SURFACE,
  TILE_BADGE_SIZE,
  TILE_MIN_HEIGHT,
  type ButtonVariant,
} from './buttonStyles';
import { IconBadge } from './IconBadge';
import { type IconName } from './Icon';

type ButtonProps = PressableProps & {
  label: string;
  loading?: boolean;
  variant?: ButtonVariant;
  /** Pastille d'icone de la variante `tile`. Ignoree par les autres. */
  icon?: IconName;
};

// LE BOUTON DE L'APP. Une seule branche de rendu pour toutes les variantes :
// leurs classes sont declarees dans buttonStyles.ts, ou se lit aussi le role
// de chacune et le moment de la choisir.
//
// Les trois branches separees d'avant (danger, outline, puis le reste)
// disaient trois fois la meme chose et divergeaient sans qu'on le voie —
// `accessibilityState` etait recopie a l'identique dans chacune, et il aurait
// suffi d'en corriger deux sur trois.
export function Button({ label, loading, variant = 'primary', icon, disabled, ...pressableProps }: ButtonProps) {
  const colors = useThemeColors();
  const tileMinHeight = useScaled(TILE_MIN_HEIGHT);
  const inactive = disabled || loading;

  // Le tourniquet doit se voir SUR le bouton, pas dedans : sa couleur suit
  // celle du libelle qu'il remplace le temps de l'attente.
  const spinnerColor =
    variant === 'primary' || variant === 'danger' || variant === 'destructive'
      ? '#fff'
      : variant === 'outline'
        ? colors.accentDark
        : colors.ink;

  return (
    <Pressable
      disabled={inactive}
      accessibilityRole="button"
      // `busy` fait annoncer « en cours » pendant l'attente : sans lui, un
      // bouton qui tourne est simplement un bouton qui ne repond pas.
      accessibilityState={{ disabled: inactive, busy: loading }}
      className={`${BUTTON_SURFACE[variant]} ${inactive ? BUTTON_DISABLED : ''}`}
      style={variant === 'tile' ? { minHeight: tileMinHeight } : undefined}
      {...pressableProps}
    >
      {loading ? (
        <ActivityIndicator color={spinnerColor} />
      ) : (
        <>
          {variant === 'tile' && icon ? (
            <IconBadge icon={icon} fill={colors.accentLight} iconColor={colors.accentDark} size={TILE_BADGE_SIZE} />
          ) : null}
          <Text className={BUTTON_LABEL[variant]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}
