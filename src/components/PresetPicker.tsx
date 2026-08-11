import { Pressable, Text, View } from 'react-native';

type Preset = { key: string; icon: string };

type PresetPickerProps<T extends Preset> = {
  presets: T[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  labelFor: (key: string) => string;
};

export function PresetPicker<T extends Preset>({ presets, selectedKey, onSelect, labelFor }: PresetPickerProps<T>) {
  return (
    <View className="mb-4 flex-row flex-wrap gap-2">
      {presets.map((preset) => {
        const selected = preset.key === selectedKey;
        return (
          <Pressable
            key={preset.key}
            onPress={() => onSelect(preset.key)}
            className={`flex-row items-center gap-1.5 rounded-full border px-3 py-2 ${
              selected ? 'border-neutral-900 bg-neutral-900' : 'border-neutral-200'
            }`}
          >
            <Text>{preset.icon}</Text>
            <Text className={selected ? 'font-semibold text-white' : 'text-neutral-700'}>{labelFor(preset.key)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
