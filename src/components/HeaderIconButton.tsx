import { Pressable } from 'react-native';
import { useChromeScale } from '../lib/textScale';
import { useThemeColors } from '../lib/theme';
import { Icon, type IconName } from './Icon';

// Action SECONDAIRE dans l'en-tête natif, en pictogramme seul.
//
// Pendant discret de HeaderAddButton, et la distinction est volontaire : la
// pastille corail pleine annonce ce qu'on vient FAIRE sur l'écran (créer une
// pièce, un plan). Celle-ci porte ce qu'on fait AVEC ce que l'écran montre
// déjà — exporter le dossier qu'on est en train de lire. Deux pastilles
// pleines côte à côte se disputeraient le regard sans que rien ne dise
// laquelle est la principale.
//
// PAS DE LIBELLÉ VISIBLE : dans un en-tête natif, chaque mot est pris sur le
// titre de l'écran, qui devient « Factur… ». Le lecteur d'écran, lui, reçoit
// la phrase entière.
//
// Mesures en pixels et non en classes : l'en-tête natif a une hauteur fixée
// par le système, qui ne se règle pas. Un pictogramme suivant le facteur de
// texte entier y serait rogné en haut et en bas — d'où le plafond de
// `useChromeScale`, le même que celui du reste du mobilier.
const ICON_SIZE = 22;
const PADDING = 6;
// L'en-tête natif applique déjà son propre retrait à droite (~16 dp). On
// ajoute le complément pour retomber sur les 24 px de marge du contenu.
const EXTRA_RIGHT_MARGIN = 8;

type HeaderIconButtonProps = {
  icon: IconName;
  /** Libellé d'accessibilité — il n'est jamais affiché. */
  label: string;
  onPress: () => void;
};

export function HeaderIconButton({ icon, label, onPress }: HeaderIconButtonProps) {
  const chrome = useChromeScale();
  const colors = useThemeColors();

  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ marginRight: EXTRA_RIGHT_MARGIN, padding: Math.round(PADDING * chrome) }}
      className="active:opacity-60"
    >
      {/* `fixedSize` : la taille porte déjà le plafond, Icon ne doit pas la
          remultiplier par le facteur entier. */}
      <Icon name={icon} size={Math.round(ICON_SIZE * chrome)} color={colors.accentDark} fixedSize />
    </Pressable>
  );
}
