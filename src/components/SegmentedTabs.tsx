import { Pressable, Text, View } from 'react-native';

type SegmentedTabsProps<T extends string> = {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
};

// Sélecteur à deux ou trois pastilles, déjà employé trois fois dans l'app
// avant d'être factorisé ici (Personnelles/Partagées des Habitations,
// Ami/Invité du partage de code, Saisie manuelle/Scan IA de la création
// d'objet) — même balisage recopié à chaque fois. Un seul endroit désormais.
//
// Deux vues interchangeables d'une même chose, pas une navigation : le
// contenu change sous les pastilles, on ne quitte pas l'écran.
export function SegmentedTabs<T extends string>({ options, value, onChange }: SegmentedTabsProps<T>) {
  return (
    <View className="mb-4 flex-row gap-2">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            className={`flex-1 items-center rounded-xl border px-4 py-3 ${active ? 'border-coral bg-coral-light' : 'border-ink/10'}`}
          >
            <Text className={active ? 'font-semibold text-coral-dark' : 'text-ink-soft'}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
