import { Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { ContainerContents } from '../../../src/features/inventory/ContainerContents';
import { useConteneur } from '../../../src/features/inventory/queries';

export default function ConteneurScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: conteneur, isLoading } = useConteneur(id);

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
