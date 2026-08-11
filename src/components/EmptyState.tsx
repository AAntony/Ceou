import { Text, View } from 'react-native';

type EmptyStateProps = {
  icon?: string;
  title: string;
  subtitle?: string;
};

export function EmptyState({ icon = '📭', title, subtitle }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-6 py-16">
      <Text className="mb-2 text-4xl">{icon}</Text>
      <Text className="mb-1 text-center text-base font-medium text-neutral-700">{title}</Text>
      {subtitle ? <Text className="text-center text-sm text-neutral-500">{subtitle}</Text> : null}
    </View>
  );
}
