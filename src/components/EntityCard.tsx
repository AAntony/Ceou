import { Image } from 'expo-image';
import { Pressable, Text, View } from 'react-native';

type EntityCardProps = {
  icon?: string;
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
      className="mb-2 flex-row items-center rounded-xl border border-neutral-200 bg-white px-4 py-3 active:opacity-70"
    >
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={{ width: 36, height: 36, borderRadius: 8, marginRight: 12 }} />
      ) : icon ? (
        <Text className="mr-3 text-2xl">{icon}</Text>
      ) : null}
      <View className="flex-1">
        <Text className="text-base font-medium text-neutral-900">{title}</Text>
        {subtitle ? <Text className="text-sm text-neutral-500">{subtitle}</Text> : null}
      </View>
      {onEdit ? (
        <Pressable onPress={onEdit} hitSlop={8} className="px-2 py-1">
          <Text className="text-base">✏️</Text>
        </Pressable>
      ) : null}
      <Text className="text-neutral-300">›</Text>
    </Pressable>
  );
}
