import { Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { ErrorState } from '../../../src/components/ErrorState';
import { ContainerContents } from '../../../src/features/inventory/ContainerContents';
import { useEmplacement } from '../../../src/features/inventory/queries';

export default function EmplacementScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: emplacement, isLoading, isError, refetch } = useEmplacement(id);

  if (isError) {
    return (
      <View className="flex-1 bg-sand">
        <ErrorState onRetry={() => refetch()} />
      </View>
    );
  }

  if (isLoading || !emplacement) {
    return (
      <View className="flex-1 items-center justify-center bg-sand">
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
