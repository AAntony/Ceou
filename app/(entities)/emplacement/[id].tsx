import { Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { ContainerContents } from '../../../src/features/inventory/ContainerContents';
import { useEmplacement } from '../../../src/features/inventory/queries';

export default function EmplacementScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: emplacement, isLoading } = useEmplacement(id);

  if (isLoading || !emplacement) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: emplacement.name }} />
      <ContainerContents parentType="emplacement" parentId={emplacement.id} />
    </>
  );
}
