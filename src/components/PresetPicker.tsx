import { Pressable, Text, View } from 'react-native';
import { useThemeColors } from '../lib/theme';
import { Icon, type IconName } from './Icon';

type Preset = { key: string; icon: IconName };

type PresetPickerProps<T extends Preset> = {
  presets: T[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  labelFor: (key: string) => string;
};

export function PresetPicker<T extends Preset>({ presets, selectedKey, onSelect, labelFor }: PresetPickerProps<T>) {
  const colors = useThemeColors();
  return (
    <View className="mb-4 flex-row flex-wrap gap-2">
      {presets.map((preset) => {
        const selected = preset.key === selectedKey;
        return (
          <Pressable
            key={preset.key}
            onPress={() => onSelect(preset.key)}
            android_ripple={{ color: colors.ripple, borderless: false }}
            className={`flex-row items-center gap-1.5 self-start overflow-hidden rounded-full border px-3 py-2 ${
              selected ? 'border-coral bg-coral' : 'border-ink/10 bg-surface'
            }`}
          >
            <Icon name={preset.icon} size={16} color={selected ? '#fff' : colors.inkSoft} />
            <Text className={selected ? 'font-semibold text-white' : 'text-ink-soft'}>{labelFor(preset.key)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
