import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { PresetPicker } from '../../../src/components/PresetPicker';
import { usePieces } from '../../../src/features/inventory/queries';
import { PLAN_SHAPE_TYPES, type PlanShapeType } from '../../../src/features/plans/constants';
import { PlanCanvas } from '../../../src/features/plans/PlanCanvas';
import { useCreatePlanForme, useDeletePlanForme, usePlan, usePlanFormes, useUpdatePlanForme } from '../../../src/features/plans/queries';
import { ShapeInspectorSheet } from '../../../src/features/plans/ShapeInspectorSheet';
import type { PlanForme } from '../../../src/types/database';

export default function PlanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { data: plan, isLoading: planLoading } = usePlan(id);
  const { data: formes } = usePlanFormes(id);
  const { data: pieces } = usePieces(plan?.habitation_id ?? '');
  const createForme = useCreatePlanForme(id);
  const updateForme = useUpdatePlanForme(id);
  const deleteForme = useDeletePlanForme(id);
  const [selectedForme, setSelectedForme] = useState<PlanForme | null>(null);

  const pieceNames = useMemo(() => Object.fromEntries((pieces ?? []).map((p) => [p.id, p.name])), [pieces]);

  if (planLoading || !plan) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: plan.name }} />
      <ScrollView className="flex-1 bg-white" contentContainerClassName="px-6 py-4">
        <PresetPicker
          presets={PLAN_SHAPE_TYPES}
          selectedKey={null}
          onSelect={(key) => createForme.mutate(key as PlanShapeType)}
          labelFor={(key) => t(`plans.shapeTypes.${key}`)}
        />

        <PlanCanvas
          formes={formes ?? []}
          pieceNames={pieceNames}
          onDragEnd={(formeId, x, y) => updateForme.mutate({ id: formeId, x, y })}
          onTap={(forme) => setSelectedForme(forme)}
        />
      </ScrollView>

      <ShapeInspectorSheet
        forme={selectedForme}
        pieces={pieces ?? []}
        loading={updateForme.isPending}
        onClose={() => setSelectedForme(null)}
        onSave={(patch) => {
          if (!selectedForme) return;
          updateForme.mutate({ id: selectedForme.id, width: patch.width, height: patch.height, pieceId: patch.pieceId });
          setSelectedForme(null);
        }}
        onDelete={() => {
          if (!selectedForme) return;
          deleteForme.mutate(selectedForme.id);
          setSelectedForme(null);
        }}
      />
    </>
  );
}
