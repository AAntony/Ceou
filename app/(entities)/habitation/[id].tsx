import { Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { isSingleSpaceHabitation } from '../../../src/features/inventory/constants';
import { PieceEmplacements } from '../../../src/features/inventory/PieceEmplacements';
import { PieceList } from '../../../src/features/inventory/PieceList';
import { useHabitation, usePieces } from '../../../src/features/inventory/queries';

export default function HabitationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: habitation, isLoading } = useHabitation(id);
  const singleSpace = habitation ? isSingleSpaceHabitation(habitation.type) : false;
  const { data: pieces } = usePieces(id);

  if (isLoading || !habitation) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: habitation.name }} />
      {singleSpace ? (
        pieces?.[0] ? (
          <PieceEmplacements pieceId={pieces[0].id} />
        ) : (
          <View className="flex-1 items-center justify-center bg-white">
            <ActivityIndicator />
          </View>
        )
      ) : (
        <PieceList habitationId={id} />
      )}
    </>
  );
}
