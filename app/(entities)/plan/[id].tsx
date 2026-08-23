import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { ErrorState } from '../../../src/components/ErrorState';
import { Icon } from '../../../src/components/Icon';
import { getEmplacementIcon } from '../../../src/features/inventory/constants';
import { useEmplacementsForPieces, usePieces, useUpdatePiece } from '../../../src/features/inventory/queries';
import { PlanCanvas, type PlanCanvasHandle } from '../../../src/features/plans/PlanCanvas';
import { PlanPinSheet } from '../../../src/features/plans/PlanPinSheet';
import { UnplacedEmplacementsBar } from '../../../src/features/plans/UnplacedEmplacementsBar';
import {
  useCreatePlanForme,
  useCreatePlanPin,
  useDeletePlanForme,
  useDeletePlanPin,
  usePlan,
  usePlanFormes,
  usePieceObjectCounts,
  useCreatePlanDoor,
  useDeletePlanDoor,
  usePlanDoors,
  usePlanPins,
  useUpdatePlanDoor,
  useUpdatePlanForme,
  useUpdatePlanPin,
} from '../../../src/features/plans/queries';
import { ShapeInspectorSheet } from '../../../src/features/plans/ShapeInspectorSheet';
import { PlanModeSwitch, type PlanMode } from '../../../src/features/plans/PlanModeSwitch';
import { PlanTemplatePicker } from '../../../src/features/plans/PlanTemplatePicker';
import { PlanRoomSheet } from '../../../src/features/plans/PlanRoomSheet';
import { canModify, useHabitationPermission } from '../../../src/features/sharing/queries';
import { useThemeColors } from '../../../src/lib/theme';
import type { PlanForme } from '../../../src/types/database';

export default function PlanScreen() {
  const colors = useThemeColors();
  const { id, highlightFormeId, highlightEmplacementId } = useLocalSearchParams<{
    id: string;
    highlightFormeId?: string;
    highlightEmplacementId?: string;
  }>();
  const { t } = useTranslation();
  const { data: plan, isLoading: planLoading, isError: planError, refetch } = usePlan(id);
  const { data: formes } = usePlanFormes(id);
  const { data: pieces } = usePieces(plan?.habitation_id ?? '');
  const { data: pins } = usePlanPins(id);
  const { data: doors } = usePlanDoors(id);
  const { data: roomCounts } = usePieceObjectCounts(plan?.habitation_id ?? undefined);
  const createForme = useCreatePlanForme(id);
  const updateForme = useUpdatePlanForme(id);
  const deleteForme = useDeletePlanForme(id);
  const createPin = useCreatePlanPin(id);
  const updatePin = useUpdatePlanPin(id);
  const deletePin = useDeletePlanPin(id);
  const createDoor = useCreatePlanDoor(id);
  const updateDoor = useUpdatePlanDoor(id);
  const deleteDoor = useDeletePlanDoor(id);
  const updatePiece = useUpdatePiece(plan?.habitation_id ?? '');

  // sheetForme pilote la fiche (choix de pièce / suppression) ; selectedFormeId
  // pilote l'exclusivité de déplacement/redimensionnement sur le canevas —
  // deux états séparés car fermer la fiche ne doit pas relâcher la sélection
  // (seul le bouton "Valider" le fait).
  const [sheetForme, setSheetForme] = useState<PlanForme | null>(null);
  const [selectedFormeId, setSelectedFormeId] = useState<string | null>(null);
  const [sheetPinId, setSheetPinId] = useState<string | null>(null);
  // La pose de portes est un MODE arme, pas un geste cache : tant qu'il dure,
  // les murs sont des cibles et rien d'autre ne repond sur le plan.
  const [doorPlacing, setDoorPlacing] = useState(false);
  const [selectedDoorId, setSelectedDoorId] = useState<string | null>(null);
  // Pièce dont la fiche est ouverte — mode Explorer uniquement.
  const [roomSheetPieceId, setRoomSheetPieceId] = useState<string | null>(null);
  const canvasRef = useRef<PlanCanvasHandle>(null);
  const selectedDoor = (doors ?? []).find((door) => door.id === selectedDoorId) ?? null;

  // Le droit se résout sur l'HABITATION du plan, pas sur le plan lui-même :
  // c'est l'habitation qui porte les partages (voir habitation_share_permission).
  // Un visiteur ou un ami en Consultation obtient donc canEdit = false, et
  // l'écran devient un explorateur plutôt qu'un éditeur.
  const { data: permission } = useHabitationPermission(plan?.habitation_id ?? undefined);
  const canManage = canModify(permission);

  // LE PLAN S'OUVRE EN LECTURE. C'est le changement d'ergonomie central :
  // jusqu'ici l'écran était un éditeur en permanence (poignées, glisser,
  // bouton d'ajout, rappel des gestes), alors qu'on l'ouvre presque toujours
  // pour répondre à « où est mon truc ? ». Modifier devient un choix
  // explicite, avec ses propres outils.
  const [mode, setMode] = useState<PlanMode>('explore');
  const editing = canManage && mode === 'edit';

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
  const selectedForme = (formes ?? []).find((f) => f.id === selectedFormeId) ?? null;

  if (planError) {
    return (
      <View className="flex-1 bg-sand">
        <ErrorState onRetry={() => refetch()} />
      </View>
    );
  }

  if (planLoading || !plan) {
    return (
      <View className="flex-1 items-center justify-center bg-sand">
        <ActivityIndicator />
      </View>
    );
  }

  // Plan vierge : des logements types plutot qu une feuille blanche. Place
  // APRES les gardes de chargement, donc tous les hooks ont deja ete appeles.
  // Un invite ou un ami en Consultation ne voit pas ce selecteur : il ne peut
  // rien poser, il verra le plan vide tel quel.
  if ((formes ?? []).length === 0 && canManage) {
    return (
      <>
        <Stack.Screen options={{ title: plan.name }} />
        <View className="flex-1 bg-sand">
          <PlanTemplatePicker planId={id} />
        </View>
      </>
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
          {/* Un visiteur ou un ami en Consultation ne voit pas la bascule :
              lui proposer Modifier serait une promesse que la RLS refuserait. */}
          {canManage ? (
            <PlanModeSwitch
              mode={mode}
              onChange={(next) => {
                setMode(next);
                // Quitter l’édition relâche la sélection : garder une pièce
                // sélectionnée en lecture laisserait un contour bleu sans
                // aucune action possible derrière.
                if (next === 'explore') {
                  setSelectedFormeId(null);
                  setSelectedDoorId(null);
                  setDoorPlacing(false);
                }
              }}
            />
          ) : null}
          {/* Pendant la pose, la barre d'outils cède la place à la consigne
              et à sa sortie : un mode armé doit dire qu'il est armé, et
              comment en sortir. */}
          {editing && doorPlacing ? (
            <View className="mb-4 flex-row items-center gap-3 rounded-2xl border border-coral/40 bg-coral-light px-4 py-3">
              <Icon name="porte" size={20} color={colors.accentDark} />
              <Text className="flex-1 text-sm text-ink">{t('plans.doors.placing_hint')}</Text>
              <Pressable
                onPress={() => setDoorPlacing(false)}
                accessibilityRole="button"
                className="rounded-full bg-coral px-4 py-2 active:opacity-80"
              >
                <Text className="text-sm font-semibold text-white">{t('common.done')}</Text>
              </Pressable>
            </View>
          ) : null}

          {editing && !doorPlacing ? (
            <View className="mb-4 flex-row items-center gap-2">
              <Pressable
                onPress={() => createForme.mutate({ shapeType: 'rectangle', center: canvasRef.current?.getViewportCenter() })}
                className="flex-row items-center justify-center gap-2 rounded-full bg-coral px-4 py-3 active:opacity-80"
              >
                <Icon name="add" size={18} color="#fff" />
                <Text className="font-semibold text-white">{t('plans.add_room')}</Text>
              </Pressable>
              {/* Poser une porte n'a de sens qu'une fois une pièce dessinée. */}
              {(formes ?? []).length > 0 ? (
                <Pressable
                  onPress={() => {
                    setDoorPlacing(true);
                    setSelectedDoorId(null);
                    setSelectedFormeId(null);
                  }}
                  className="flex-row items-center justify-center gap-2 rounded-full border border-coral bg-coral-light px-4 py-3 active:opacity-80"
                >
                  <Icon name="porte" size={18} color={colors.accentDark} />
                  <Text className="font-semibold text-coral-dark">{t('plans.doors.add')}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {/* Le rappel des gestes décrit l'ÉDITION : l'afficher en
              consultation promettrait des actions qui ne répondent pas. */}
          <Text className="text-xs text-ink-soft">{t(editing ? 'plans.canvas_hint' : 'plans.canvas_hint_readonly')}</Text>
        </View>

        {editing && selectedForme?.piece_id ? (
          <UnplacedEmplacementsBar
            pieceId={selectedForme.piece_id}
            pins={pins ?? []}
            onPlace={(emplacementId) => createPin.mutate({ formeId: selectedForme.id, emplacementId })}
          />
        ) : null}

        {/* Barre d'action de la porte sélectionnée. Une suppression posée
            sur un bouton ÉTIQUETÉ, et non sur l'appui qui sert à désigner :
            c'est le pattern des éditeurs tactiles, et l'inverse de ce que
            faisait la première version. Pas de confirmation — reposer une
            porte coûte un appui. */}
        {editing && selectedDoor ? (
          <View className="mx-6 mb-2 flex-row items-center gap-3 rounded-2xl border border-ink/10 bg-surface px-4 py-3">
            <Icon name="porte" size={20} color={colors.accentDark} />
            <Text className="flex-1 text-base font-semibold text-ink">{t('plans.doors.title')}</Text>
            <Pressable
              onPress={() => {
                deleteDoor.mutate(selectedDoor.id);
                setSelectedDoorId(null);
              }}
              accessibilityRole="button"
              className="rounded-full border border-red-500/40 px-4 py-2 active:opacity-70"
            >
              <Text className="text-sm font-semibold text-red-600">{t('common.delete')}</Text>
            </Pressable>
            <Pressable
              onPress={() => setSelectedDoorId(null)}
              accessibilityRole="button"
              className="rounded-full border border-ink/10 px-4 py-2 active:opacity-70"
            >
              <Text className="text-sm font-semibold text-ink">{t('common.done')}</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Barre d'action de la pièce sélectionnée. Remplace le double-tap
            qui ouvrait la fiche : une cible large et visible plutôt qu'un
            geste que rien n'annonçait. */}
        {editing && selectedForme ? (
          <View className="mx-6 mb-2 flex-row items-center gap-3 rounded-2xl border border-ink/10 bg-surface px-4 py-3">
            <Text className="flex-1 text-base font-semibold text-ink" numberOfLines={1}>
              {selectedForme.piece_id
                ? (pieces ?? []).find((piece) => piece.id === selectedForme.piece_id)?.name ?? t('plans.unassigned_room')
                : t('plans.unassigned_room')}
            </Text>
            <Pressable
              onPress={() => setSheetForme(selectedForme)}
              accessibilityRole="button"
              accessibilityLabel={t('common.edit')}
              className="h-11 w-11 items-center justify-center rounded-full border border-ink/10 active:opacity-70"
            >
              <Icon name="pencil" size={18} color={colors.inkSoft} />
            </Pressable>
          </View>
        ) : null}

        <View className="flex-1 px-6 pb-4">
          <PlanCanvas
            ref={canvasRef}
            formes={formes ?? []}
            pieceInfo={pieceInfo}
            pins={pins ?? []}
            pinDisplay={pinDisplay}
            highlightFormeId={highlightFormeId}
            highlightEmplacementId={highlightEmplacementId}
            selectedFormeId={selectedFormeId}
            roomCounts={roomCounts}
            readOnly={!editing}
            onDragEnd={(formeId, x, y) => updateForme.mutate({ id: formeId, x, y })}
            onResizeEnd={(formeId, x, y, width, height) => updateForme.mutate({ id: formeId, x, y, width, height })}
            onSelect={(forme) => {
              setSelectedFormeId(forme.id);
              setSelectedDoorId(null);
              // En lecture, toucher une pièce ouvre sa fiche : sans ça le tap
              // ne faisait que la surligner, ce qui ne répond à aucune
              // question. En édition il sélectionne seulement, pour ne pas
              // ouvrir une feuille à chaque fois qu'on veut déplacer.
              if (!editing && forme.piece_id) setRoomSheetPieceId(forme.piece_id);
            }}
            onDeselect={() => {
              setSelectedFormeId(null);
              setSelectedDoorId(null);
            }}
            onPinDragEnd={(pinId, relX, relY) => updatePin.mutate({ id: pinId, relX, relY })}
            onPinTap={(pin) => setSheetPinId(pin.id)}
            doors={doors ?? []}
            doorPlacing={doorPlacing}
            selectedDoorId={selectedDoorId}
            onDoorCreate={(formeId, edge, position) => createDoor.mutate({ formeId, edge, position })}
            onDoorSelect={(door) => setSelectedDoorId(door.id)}
            onDoorDragEnd={(doorId, edge, position) => updateDoor.mutate({ id: doorId, edge, position })}
          />
        </View>
      </View>

      <PlanRoomSheet
        piece={(pieces ?? []).find((piece) => piece.id === roomSheetPieceId) ?? null}
        objectCount={roomSheetPieceId ? (roomCounts?.[roomSheetPieceId] ?? null) : null}
        onClose={() => {
          setRoomSheetPieceId(null);
          setSelectedFormeId(null);
        }}
      />

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
