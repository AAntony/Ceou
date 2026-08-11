import { forwardRef } from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';

type TextFieldProps = TextInputProps & {
  label: string;
  error?: string;
};

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, ...inputProps },
  ref
) {
  return (
    <View className="mb-4">
      <Text className="mb-1.5 text-sm font-medium text-neutral-700">{label}</Text>
      <TextInput
        ref={ref}
        className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-base text-neutral-900"
        placeholderTextColor="#9ca3af"
        autoCapitalize="none"
        autoCorrect={false}
        {...inputProps}
      />
      {error ? <Text className="mt-1 text-sm text-red-600">{error}</Text> : null}
    </View>
  );
});
