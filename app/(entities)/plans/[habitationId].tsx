import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';
import { ErrorState } from '../../../src/components/ErrorState';
import { PlansList } from '../../../src/features/plans/PlansList';
import { useHabitation } from '../../../src/features/inventory/queries';

export default function PlansScreen() {
  const { habitationId } = useLocalSearchParams<{ habitationId: string }>();
  const { t } = useTranslation();
  const { data: habitation, isLoading, isError, refetch } = useHabitation(habitationId);

  if (isError) {
    return (
      <View className="flex-1 bg-sand">
        <ErrorState onRetry={() => refetch()} />
      </View>
    );
  }

  if (isLoading || !habitation) {
    return (
      <View className="flex-1 items-center justify-center bg-sand">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: t('plans.title', { name: habitation.name }) }} />
      <PlansList habitationId={habitationId} />
    </>
  );
}
