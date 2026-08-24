import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import type { HabitationPermission } from '../../types/database';

type PermissionPickerProps = {
  value: HabitationPermission | null;
  onChange: (value: HabitationPermission | null) => void;
};

const OPTIONS: { value: HabitationPermission | null; labelKey: string }[] = [
  { value: null, labelKey: 'friends.permission.none' },
  { value: 'consultation', labelKey: 'friends.permission.consultation' },
  { value: 'modification', labelKey: 'friends.permission.modification' },
  { value: 'proprietaire', labelKey: 'friends.permission.proprietaire' },
];

// Réutilisé partout où un droit d'accès Habitation se choisit — même
// vocabulaire de droits partout (voir modèle de droits du plan Phase 8).
export function PermissionPicker({ value, onChange }: PermissionPickerProps) {
  const { t } = useTranslation();
  return (
    <View className="flex-row flex-wrap gap-2">
      {OPTIONS.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            accessibilityRole="button"
            key={opt.labelKey}
            onPress={() => onChange(opt.value)}
            className={`rounded-full border px-3 py-1.5 ${active ? 'border-coral bg-coral' : 'border-ink/10 bg-surface'}`}
          >
            <Text className={`text-xs font-medium ${active ? 'text-white' : 'text-ink-soft'}`}>{t(opt.labelKey)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
