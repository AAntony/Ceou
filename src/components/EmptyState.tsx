import { Text, View } from 'react-native';
import { Icon, type IconName } from './Icon';

type EmptyStateProps = {
  icon?: IconName;
  title: string;
  subtitle?: string;
};

export function EmptyState({ icon = 'empty', title, subtitle }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-6 py-16">
      <View className="mb-3 h-16 w-16 items-center justify-center rounded-full bg-mustard-light">
        <Icon name={icon} size={30} color="#E0A93C" />
      </View>
      <Text className="mb-1 text-center text-base font-medium text-ink-soft">{title}</Text>
      {subtitle ? <Text className="text-center text-sm text-ink-soft">{subtitle}</Text> : null}
    </View>
  );
}
