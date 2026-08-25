import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { ROOM_COLOR_PALETTE } from '../features/plans/constants';
import { useScaled } from '../lib/textScale';
import { useThemeColors } from '../lib/theme';
import { Icon } from './Icon';

type ColorPickerProps = {
  selectedColor: string | null;
  onSelect: (color: string | null) => void;
};

const SWATCH_SIZE = 36;

// Grille de pastilles — même palette que celle utilisée pour la couleur
// automatique des Pièces sur le Plan (src/features/plans/constants.ts), pour
// qu'une couleur choisie ici reste cohérente avec l'identité visuelle déjà
// en place. Premier swatch = "aucune couleur" (retombe sur le comportement
// par défaut : couleur automatique sur le Plan, teinte fixe dans les listes).
export function ColorPicker({ selectedColor, onSelect }: ColorPickerProps) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  // Une pastille de couleur est une CIBLE avant d'etre une decoration : elle
  // grandit avec le reglage de taille, comme les autres boutons.
  const swatch = useScaled(SWATCH_SIZE);
  return (
    <View className="mb-4 flex-row flex-wrap gap-2">
      <Pressable
        onPress={() => onSelect(null)}
        accessibilityRole="button"
        accessibilityState={{ selected: selectedColor === null }}
        accessibilityLabel={t('a11y.no_color')}
        className={`items-center justify-center rounded-full border-2 bg-surface ${
          selectedColor === null ? 'border-ink' : 'border-ink/10'
        }`}
        style={{ width: swatch, height: swatch }}
      >
        <Icon name="close" size={16} color={colors.inkFaint} />
      </Pressable>
      {ROOM_COLOR_PALETTE.map((color, index) => {
        const selected = color === selectedColor;
        return (
          <Pressable
            key={color}
            onPress={() => onSelect(color)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            // Nommer la teinte n'apprendrait rien à qui ne la voit pas : ce
            // qui sert, c'est de savoir où l'on est dans la grille et laquelle
            // est retenue.
            accessibilityLabel={t('a11y.color_index', { index: index + 1, total: ROOM_COLOR_PALETTE.length })}
            style={{ backgroundColor: color, width: swatch, height: swatch }}
            className={`rounded-full border-2 ${selected ? 'border-ink' : 'border-black/10'}`}
          />
        );
      })}
    </View>
  );
}
