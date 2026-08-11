import { Image } from 'expo-image';
import { Pressable, Text, View } from 'react-native';
import { Icon, type IconName } from './Icon';

type EntityCardProps = {
  icon?: IconName;
  imageUri?: string | null;
  title: string;
  subtitle?: string;
  onPress: () => void;
  onLongPress?: () => void;
  onEdit?: () => void;
};

export function EntityCard({ icon, imageUri, title, subtitle, onPress, onLongPress, onEdit }: EntityCardProps) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      className="mb-2 flex-row items-center rounded-xl border border-ink/10 bg-white px-4 py-3 active:opacity-70"
    >
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={{ width: 36, height: 36, borderRadius: 8, marginRight: 12 }} />
      ) : icon ? (
        <View className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-teal-light">
          <Icon name={icon} size={20} color="#219488" />
        </View>
      ) : null}
      <View className="flex-1">
        <Text className="text-base font-medium text-ink">{title}</Text>
        {subtitle ? <Text className="text-sm text-ink-soft">{subtitle}</Text> : null}
      </View>
      {onEdit ? (
        <Pressable onPress={onEdit} hitSlop={8} className="px-2 py-1">
          <Icon name="pencil" size={18} color="#A39C8F" />
        </Pressable>
      ) : null}
      <Icon name="chevron" size={20} color="#D9D2C4" />
    </Pressable>
  );
}
