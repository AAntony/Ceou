import { ActivityIndicator, Pressable, Text, type PressableProps } from 'react-native';

type ButtonProps = PressableProps & {
  label: string;
  loading?: boolean;
  variant?: 'primary' | 'ghost';
};

export function Button({ label, loading, variant = 'primary', disabled, ...pressableProps }: ButtonProps) {
  const isPrimary = variant === 'primary';

  return (
    <Pressable
      disabled={disabled || loading}
      className={`items-center justify-center rounded-xl py-3.5 active:opacity-80 ${
        isPrimary ? 'bg-neutral-900' : 'bg-transparent'
      } ${disabled || loading ? 'opacity-50' : ''}`}
      {...pressableProps}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? '#fff' : '#171717'} />
      ) : (
        <Text className={`text-base font-semibold ${isPrimary ? 'text-white' : 'text-neutral-900'}`}>{label}</Text>
      )}
    </Pressable>
  );
}
