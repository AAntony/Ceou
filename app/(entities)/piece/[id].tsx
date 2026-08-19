import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';
import { ErrorState } from '../../../src/components/ErrorState';
import { HeaderAddButton } from '../../../src/components/HeaderAddButton';
import { PieceEmplacements } from '../../../src/features/inventory/PieceEmplacements';
import { usePiece } from '../../../src/features/inventory/queries';

export default function PieceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { data: piece, isLoading, isError, refetch } = usePiece(id);
  const [addSignal, setAddSignal] = useState(0);


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
      <Stack.Screen
        options={{
          title: piece.name,
          headerRight: () => (
            <HeaderAddButton onPress={() => setAddSignal((n) => n + 1)} accessibilityLabel={t('inventory.emplacements.add')} />
          ),
        }}
      />
      <PieceEmplacements pieceId={piece.id} addSignal={addSignal} />
    </>
  );
}
