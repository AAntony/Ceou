import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { PresetPicker } from '../../../src/components/PresetPicker';
import { usePieces } from '../../../src/features/inventory/queries';
import { PLAN_SHAPE_TYPES, type PlanShapeType } from '../../../src/features/plans/constants';
import { PlanCanvas } from '../../../src/features/plans/PlanCanvas';
import { useCreatePlanForme, useDeletePlanForme, usePlan, usePlanFormes, useUpdatePlanForme } from '../../../src/features/plans/queries';
import { ShapeInspectorSheet } from '../../../src/features/plans/ShapeInspectorSheet';
import type { PlanForme } from '../../../src/types/database';

export default function PlanScreen() {
  const { id, highlightFormeId } = useLocalSearchParams<{ id: string; highlightFormeId?: string }>();
  const { t } = useTranslation();
  const { data: plan, isLoading: planLoading } = usePlan(id);
  const { data: formes } = usePlanFormes(id);
  const { data: pieces } = usePieces(plan?.habitation_id ?? '');
  const createForme = useCreatePlanForme(id);
  const updateForme = useUpdatePlanForme(id);
  const deleteForme = useDeletePlanForme(id);
  // sheetForme pilote la fiche (choix de pièce / suppression) ; selectedFormeId
  // pilote l'exclusivité de déplacement/redimensionnement sur le canevas —
  // deux états séparés car fermer la fiche ne doit pas relâcher la sélection
  // (seul le bouton "Valider" le fait).
  const [sheetForme, setSheetForme] = useState<PlanForme | null>(null);
  const [selectedFormeId, setSelectedFormeId] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const pieceNames = useMemo(() => Object.fromEntries((pieces ?? []).map((p) => [p.id, p.name])), [pieces]);

  // Vient de "Voir sur le plan" (fiche Objet) : amène la forme concernée
  // dans le cadre, approximatif mais suffisant (pas besoin d'un calcul de
  // mise en page exact pour un simple "c'est à peu près ici").
  useEffect(() => {
    if (!highlightFormeId || !formes) return;
    const forme = formes.find((f) => f.id === highlightFormeId);
    if (forme) scrollRef.current?.scrollTo({ y: Math.max(0, forme.y - 100), animated: true });
  }, [highlightFormeId, formes]);

  if (planLoading || !plan) {
    return (
      <View className="flex-1 items-center justify-center bg-sand">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: plan.name }} />
      <ScrollView ref={scrollRef} className="flex-1 bg-sand" contentContainerClassName="px-6 pb-40 pt-4">
        <PresetPicker
          presets={PLAN_SHAPE_TYPES}
          selectedKey={null}
          onSelect={(key) => createForme.mutate(key as PlanShapeType)}
          labelFor={(key) => t(`plans.shapeTypes.${key}`)}
        />
        <Text className="mb-3 text-xs text-ink-soft">{t('plans.canvas_hint')}</Text>

        <PlanCanvas
          formes={formes ?? []}
          pieceNames={pieceNames}
          highlightFormeId={highlightFormeId}
          selectedFormeId={selectedFormeId}
          onDragEnd={(formeId, x, y) => updateForme.mutate({ id: formeId, x, y })}
          onResizeEnd={(formeId, x, y, width, height) => updateForme.mutate({ id: formeId, x, y, width, height })}
          onTap={(forme) => {
            setSelectedFormeId(forme.id);
            setSheetForme(forme);
          }}
          onDeselect={() => setSelectedFormeId(null)}
        />
      </ScrollView>

      <ShapeInspectorSheet
        forme={sheetForme}
        pieces={pieces ?? []}
        onClose={() => setSheetForme(null)}
        onChoosePiece={(pieceId) => {
          if (!sheetForme) return;
          updateForme.mutate({ id: sheetForme.id, pieceId });
        }}
        onDelete={() => {
          if (!sheetForme) return;
          deleteForme.mutate(sheetForme.id);
          setSelectedFormeId(null);
          setSheetForme(null);
        }}
      />
    </>
  );
}
