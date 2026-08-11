import { Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { PieceEmplacements } from '../../../src/features/inventory/PieceEmplacements';
import { usePiece } from '../../../src/features/inventory/queries';

export default function PieceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: piece, isLoading } = usePiece(id);

  if (isLoading || !piece) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
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
