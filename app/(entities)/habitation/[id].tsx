import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { isSingleSpaceHabitation } from '../../../src/features/inventory/constants';
import { PieceEmplacements } from '../../../src/features/inventory/PieceEmplacements';
import { PieceList } from '../../../src/features/inventory/PieceList';
import { useHabitation, usePieces } from '../../../src/features/inventory/queries';

export default function HabitationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { data: habitation, isLoading } = useHabitation(id);
  const singleSpace = habitation ? isSingleSpaceHabitation(habitation.type) : false;
  const { data: pieces } = usePieces(id);

  if (isLoading || !habitation) {
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
          title: habitation.name,
          headerRight: () => (
            <Pressable onPress={() => router.push(`/plans/${id}`)} hitSlop={8}>
              <Text className="text-base font-medium text-ink">{t('plans.header_button')}</Text>
            </Pressable>
          ),
        }}
      />
      {singleSpace ? (
        pieces?.[0] ? (
          <PieceEmplacements pieceId={pieces[0].id} />
        ) : (
          <View className="flex-1 items-center justify-center bg-sand">
            <ActivityIndicator />
          </View>
        )
      ) : (
        <PieceList habitationId={id} />
      )}
    </>
  );
}
