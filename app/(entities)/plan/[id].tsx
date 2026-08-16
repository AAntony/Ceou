import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Icon } from '../../../src/components/Icon';
import { getEmplacementIcon } from '../../../src/features/inventory/constants';
import { useEmplacementsForPieces, usePieces, useUpdatePiece } from '../../../src/features/inventory/queries';
import { PlanCanvas } from '../../../src/features/plans/PlanCanvas';
import { PlanPinSheet } from '../../../src/features/plans/PlanPinSheet';
import {
  useCreatePlanForme,
  useCreatePlanPin,
  useDeletePlanForme,
  useDeletePlanPin,
  usePlan,
  usePlanFormes,
  usePlanPins,
  useUpdatePlanForme,
  useUpdatePlanPin,
} from '../../../src/features/plans/queries';
import { ShapeInspectorSheet } from '../../../src/features/plans/ShapeInspectorSheet';
import type { PlanForme } from '../../../src/types/database';

export default function PlanScreen() {
  const { id, highlightFormeId, highlightEmplacementId } = useLocalSearchParams<{
    id: string;
    highlightFormeId?: string;
    highlightEmplacementId?: string;
  }>();
  const { t } = useTranslation();
  const { data: plan, isLoading: planLoading } = usePlan(id);
  const { data: formes } = usePlanFormes(id);
  const { data: pieces } = usePieces(plan?.habitation_id ?? '');
  const { data: pins } = usePlanPins(id);
  const createForme = useCreatePlanForme(id);
  const updateForme = useUpdatePlanForme(id);
  const deleteForme = useDeletePlanForme(id);
  const createPin = useCreatePlanPin(id);
  const updatePin = useUpdatePlanPin(id);
  const deletePin = useDeletePlanPin(id);
  const updatePiece = useUpdatePiece(plan?.habitation_id ?? '');

  // sheetForme pilote la fiche (choix de pièce / suppression) ; selectedFormeId
  // pilote l'exclusivité de déplacement/redimensionnement sur le canevas —
  // deux états séparés car fermer la fiche ne doit pas relâcher la sélection
  // (seul le bouton "Valider" le fait).
  const [sheetForme, setSheetForme] = useState<PlanForme | null>(null);
  const [selectedFormeId, setSelectedFormeId] = useState<string | null>(null);
  const [sheetPinId, setSheetPinId] = useState<string | null>(null);

  const pieceInfo = useMemo(
    () => Object.fromEntries((pieces ?? []).map((p) => [p.id, { name: p.name, color: p.color }])),
    [pieces],
  );

  const pieceIdsOnPlan = useMemo(
    () => Array.from(new Set((formes ?? []).map((f) => f.piece_id).filter((pid): pid is string => !!pid))),
    [formes],
  );
  const { data: pinEmplacements } = useEmplacementsForPieces(pieceIdsOnPlan);
  const pinDisplay = useMemo(
    () => Object.fromEntries((pinEmplacements ?? []).map((e) => [e.id, { name: e.name, icon: getEmplacementIcon(e.preset_key) }])),
    [pinEmplacements],
  );

  const sheetPin = (pins ?? []).find((p) => p.id === sheetPinId) ?? null;
  const sheetPinDisplay = sheetPin ? (pinDisplay[sheetPin.emplacement_id] ?? null) : null;

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
      <View className="flex-1 bg-sand">
        {/* En-tête fixe (bouton + rappel des gestes) : ne doit jamais
            défiler, contrairement à avant où tout l'écran (bouton compris)
            vivait dans le même ScrollView que le plan — le défilement/pan
            n'a désormais de sens qu'À L'INTÉRIEUR de la zone du plan
            elle-même (voir PlanCanvas, qui gère son propre zoom/pan borné). */}
        <View className="px-6 pb-2 pt-4">
          <Pressable
            onPress={() => createForme.mutate('rectangle')}
            className="mb-4 flex-row items-center justify-center gap-2 self-start rounded-full bg-coral px-4 py-3 active:opacity-80"
          >
            <Icon name="add" size={18} color="#fff" />
            <Text className="font-semibold text-white">{t('plans.add_room')}</Text>
          </Pressable>
          <Text className="text-xs text-ink-soft">{t('plans.canvas_hint')}</Text>
        </View>

        <View className="flex-1 px-6 pb-4">
          <PlanCanvas
            formes={formes ?? []}
            pieceInfo={pieceInfo}
            pins={pins ?? []}
            pinDisplay={pinDisplay}
            highlightFormeId={highlightFormeId}
            highlightEmplacementId={highlightEmplacementId}
            selectedFormeId={selectedFormeId}
            onDragEnd={(formeId, x, y) => updateForme.mutate({ id: formeId, x, y })}
            onResizeEnd={(formeId, x, y, width, height) => updateForme.mutate({ id: formeId, x, y, width, height })}
            onSelect={(forme) => setSelectedFormeId(forme.id)}
            onOpenSheet={(forme) => {
              setSelectedFormeId(forme.id);
              setSheetForme(forme);
            }}
            onDeselect={() => setSelectedFormeId(null)}
            onPinDragEnd={(pinId, relX, relY) => updatePin.mutate({ id: pinId, relX, relY })}
            onPinTap={(pin) => setSheetPinId(pin.id)}
            onPlaceEmplacement={(emplacementId) => {
              if (!selectedFormeId) return;
              createPin.mutate({ formeId: selectedFormeId, emplacementId });
            }}
          />
        </View>
      </View>

      <ShapeInspectorSheet
        forme={sheetForme}
        pieces={pieces ?? []}
        onClose={() => setSheetForme(null)}
        onChoosePiece={(pieceId) => {
          if (!sheetForme) return;
          updateForme.mutate({ id: sheetForme.id, pieceId });
        }}
        onChooseColor={(pieceId, color) => updatePiece.mutate({ id: pieceId, color })}
        onDelete={() => {
          if (!sheetForme) return;
          deleteForme.mutate(sheetForme.id);
          setSelectedFormeId(null);
          setSheetForme(null);
        }}
      />

      <PlanPinSheet
        pin={sheetPin}
        display={sheetPinDisplay}
        onClose={() => setSheetPinId(null)}
        onRemove={() => {
          if (!sheetPin) return;
          deletePin.mutate(sheetPin.id);
          setSheetPinId(null);
        }}
      />
    </>
  );
}
