import { forwardRef } from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';
import { useThemeColors } from '../lib/theme';

type TextFieldProps = TextInputProps & {
  label: string;
  error?: string;
};

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, ...inputProps },
  ref
) {
  const colors = useThemeColors();

  return (
    <View className="mb-4">
      <Text className="mb-1.5 text-sm font-medium text-ink-soft">{label}</Text>
      <TextInput
        ref={ref}
        className="rounded-xl border border-ink/10 bg-sand-dark px-4 py-3 text-base text-ink"
        placeholderTextColor={colors.inkFaint}
        autoCapitalize="none"
        autoCorrect={false}
        {...inputProps}
      />
      {error ? <Text className="mt-1 text-sm text-red-600">{error}</Text> : null}
    </View>
  );
});
