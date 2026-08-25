import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { PIN_SIZES, type PinSize } from './pinSize';

// Taille d'affichage des puces d'Emplacement — S / M / XL.
//
// Même pastille segmentée, même place et même largeur que la bascule
// Explorer / Modifier juste au-dessus : les deux se lisent comme un seul bloc
// de réglages, et rien ne bouge quand celle-ci apparaît.
//
// Elle ne sort qu'une fois une puce désignée : c'est à ce moment-là qu'on
// s'aperçoit qu'elle est trop petite (ou trop grosse), pas avant.
export function PlanPinSizeSwitch({ size, onChange }: { size: PinSize; onChange: (size: PinSize) => void }) {
  const { t } = useTranslation();

  return (
    <View
      accessibilityLabel={t('plans.pin_size.label')}
      className="flex-row gap-1 self-center rounded-full border border-ink/10 bg-surface/95 p-1"
    >
      {PIN_SIZES.map((option) => {
        const active = option === size;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            className={`min-h-[2rem] min-w-11 items-center justify-center rounded-full px-3 py-1 active:opacity-80 ${
              active ? 'bg-coral' : ''
            }`}
          >
            <Text className={active ? 'text-sm font-semibold text-white' : 'text-sm text-ink-soft'}>{option}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
