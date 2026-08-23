import { Pressable, View } from 'react-native';
import { ROOM_COLOR_PALETTE } from '../features/plans/constants';
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
  return (
    <View className="mb-4 flex-row flex-wrap gap-2">
      <Pressable
        onPress={() => onSelect(null)}
        className={`items-center justify-center rounded-full border-2 bg-surface ${
          selectedColor === null ? 'border-ink' : 'border-ink/10'
        }`}
        style={{ width: SWATCH_SIZE, height: SWATCH_SIZE }}
      >
        <Icon name="close" size={16} color={colors.inkFaint} />
      </Pressable>
      {ROOM_COLOR_PALETTE.map((color) => {
        const selected = color === selectedColor;
        return (
          <Pressable
            key={color}
            onPress={() => onSelect(color)}
            style={{ backgroundColor: color, width: SWATCH_SIZE, height: SWATCH_SIZE }}
            className={`rounded-full border-2 ${selected ? 'border-ink' : 'border-black/10'}`}
          />
        );
      })}
    </View>
  );
}
