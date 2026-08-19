import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';
import { ErrorState } from '../../../src/components/ErrorState';
import { HeaderAddButton } from '../../../src/components/HeaderAddButton';
import { ContainerContents } from '../../../src/features/inventory/ContainerContents';
import { useEmplacement } from '../../../src/features/inventory/queries';

export default function EmplacementScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { data: emplacement, isLoading, isError, refetch } = useEmplacement(id);
  const [addSignal, setAddSignal] = useState(0);


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
      <Stack.Screen
        options={{
          title: emplacement.name,
          headerRight: () => (
            <HeaderAddButton onPress={() => setAddSignal((n) => n + 1)} accessibilityLabel={t('inventory.container.add_choice_title')} />
          ),
        }}
      />
      <ContainerContents parentType="emplacement" parentId={emplacement.id} addSignal={addSignal} />
    </>
  );
}
