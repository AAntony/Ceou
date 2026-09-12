import { Pressable, Text, View } from 'react-native';
import { STACK_SCALE, useTextScale } from '../lib/textScale';

type SegmentedTabsProps<T extends string> = {
  /**
   * `disabled` : la pastille reste VISIBLE mais inerte, et c'est voulu.
   * Hors connexion, « Partagées » n'a rien à montrer — les habitations des
   * autres ne sont pas préchargées. La retirer laisserait croire qu'elle
   * n'existe pas ; grisée, elle dit qu'elle reviendra.
   */
  options: { value: T; label: string; disabled?: boolean }[];
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
        const disabled = option.disabled === true;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            disabled={disabled}
            accessibilityRole="tab"
            accessibilityState={{ selected: active, disabled }}
            className={`min-h-[48px] items-center justify-center rounded-xl border px-4 py-3 ${stacked ? '' : 'flex-1'} ${
              active ? 'border-coral bg-coral-light' : 'border-ink/10'
            } ${disabled ? 'opacity-40' : ''}`}
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
