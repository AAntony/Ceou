import { Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { ErrorState } from '../../../src/components/ErrorState';
import { ContainerContents } from '../../../src/features/inventory/ContainerContents';
import { useConteneur } from '../../../src/features/inventory/queries';

export default function ConteneurScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: conteneur, isLoading, isError, refetch } = useConteneur(id);

  if (isError) {
    return (
      <View className="flex-1 bg-sand">
        <ErrorState onRetry={() => refetch()} />
      </View>
    );
  }

  if (isLoading || !conteneur) {
    return (
      <View className="flex-1 items-center justify-center bg-sand">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: conteneur.name }} />
      <ContainerContents parentType="conteneur" parentId={conteneur.id} />
    </>
  );
}
