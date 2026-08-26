import { Pressable, Text, View } from 'react-native';
import { STACK_SCALE, useTextScale } from '../lib/textScale';

type SegmentedTabsProps<T extends string> = {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
};

// Sélecteur à deux ou trois pastilles, déjà employé trois fois dans l'app
// avant d'être factorisé ici (Personnelles/Partagées des Habitations,
// Limité/Permanent d'un code d'invité, Saisie manuelle/Scan IA de la
// création d'objet) — même balisage recopié à chaque fois. Un seul endroit
// désormais.
//
// Deux vues interchangeables d'une même chose, pas une navigation : le
// contenu change sous les pastilles, on ne quitte pas l'écran.
export function SegmentedTabs<T extends string>({ options, value, onChange }: SegmentedTabsProps<T>) {
  // EN GROS TEXTE, LES PASTILLES S'EMPILENT. Cote a cote, chacune ne dispose
  // que d'un demi ou d'un tiers d'ecran : « Personnelles » a x1,6 y serait
  // coupe en plein milieu d'un mot. L'une sous l'autre, chaque libelle a
  // toute la largeur et reste entier.
  const { textScale } = useTextScale();
  const stacked = textScale >= STACK_SCALE;

  return (
    <View className={`mb-4 gap-2 ${stacked ? '' : 'flex-row'}`}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            className={`items-center rounded-xl border px-4 py-3 ${stacked ? '' : 'flex-1'} ${
              active ? 'border-coral bg-coral-light' : 'border-ink/10'
            }`}
          >
            {/* Centre : en gros texte, un libelle passe sur deux lignes et
                un alignement a gauche desaxerait la pastille. */}
            <Text className={active ? 'text-center font-semibold text-coral-dark' : 'text-center text-ink-soft'}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
