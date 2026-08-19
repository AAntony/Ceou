import { Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { ErrorState } from '../../../src/components/ErrorState';
import { PieceEmplacements } from '../../../src/features/inventory/PieceEmplacements';
import { usePiece } from '../../../src/features/inventory/queries';

export default function PieceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: piece, isLoading, isError, refetch } = usePiece(id);

  if (isError) {
    return (
      <View className="flex-1 bg-sand">
        <ErrorState onRetry={() => refetch()} />
      </View>
    );
  }

  if (isLoading || !piece) {
    return (
      <View className="flex-1 items-center justify-center bg-sand">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: piece.name }} />
      <PieceEmplacements pieceId={piece.id} />
    </>
  );
}
