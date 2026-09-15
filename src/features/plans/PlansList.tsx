import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { CreateEntityModal } from '../../components/CreateEntityModal';
import { EmptyState } from '../../components/EmptyState';
import { Icon } from '../../components/Icon';
import { ErrorState } from '../../components/ErrorState';
import { confirmDelete } from '../../lib/confirmDelete';
import { canModify, useHabitationPermission } from '../sharing/queries';
import { DEFAULT_PIECE_COLOR } from '../inventory/constants';
import { usePieces } from '../inventory/queries';
import { roomColorForForme } from './constants';
import { PlanThumbnail } from './PlanThumbnail';
import { useCreatePlan, useDeletePlan, usePlanFormes, usePlans, useReorderPlans, useUpdatePlan } from './queries';
import type { Plan, PlanForme } from '../../types/database';

type PlansListProps = {
  habitationId: string;
  addSignal?: number;
};

// Une rangée par plan, et donc un composant par rangée : chaque plan a besoin
// de SES formes pour se dessiner, et un hook ne s'appelle pas dans une
// boucle. Même raison qu'ailleurs dans l'app — un plan par habitation, deux
// ou trois au plus, la requête supplémentaire est sans conséquence.
function PlanRow({
  plan,
  pieceColors,
  editable,
  onOpen,
  onEdit,
  onMoveUp,
  onMoveDown,
}: {
  plan: Plan;
  pieceColors: Map<string, string>;
  editable: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const { t } = useTranslation();
  const { data: formes } = usePlanFormes(plan.id);
  const rooms = formes ?? [];
  const [optionsOpen, setOptionsOpen] = useState(false);

  // Exactement la règle du canevas : couleur de la Pièce associée, sinon une
  // teinte tirée de l'identifiant de la forme. Une vignette qui ne
  // ressemblerait pas au plan qu'elle annonce ne servirait à rien.
  const colorForForme = (forme: PlanForme) =>
    forme.piece_id ? (pieceColors.get(forme.piece_id) ?? DEFAULT_PIECE_COLOR) : roomColorForForme(forme.id);

  return (
    <View className="mb-4 overflow-hidden rounded-3xl border border-ink/10 bg-surface">
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={plan.name} className="active:opacity-80">
        <View style={{ height: 180 }} className="m-3 overflow-hidden rounded-2xl bg-sand p-4">
          <PlanThumbnail formes={rooms} colorForForme={colorForForme} />
        </View>
        <View className="flex-row items-center gap-3 px-4 pb-3">
          <View className="flex-1"><Text className="text-body font-semibold text-ink">{plan.name}</Text>
            <Text className="mt-1 text-label text-ink-soft">{t('plans.rooms_count', { count: rooms.length })}</Text>
          </View><Icon name="chevron" size={20} />
        </View>
      </Pressable>
      {editable ? <>
        <Pressable onPress={() => setOptionsOpen(!optionsOpen)} accessibilityRole="button"
          accessibilityLabel={t('plans.explore.options')} accessibilityState={{ expanded: optionsOpen }}
          className="min-h-[48px] flex-row items-center justify-between border-t border-ink/10 px-4">
          <Text className="text-caption text-ink-soft">{t('plans.explore.options')}</Text><Text className="text-heading text-ink">⋯</Text>
        </Pressable>
        {optionsOpen ? <View className="flex-row flex-wrap gap-2 px-3 pb-3">
          <Pressable onPress={onEdit} accessibilityRole="button" accessibilityLabel={t('a11y.edit_named', { name: plan.name })}
            className="min-h-[48px] flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-sand px-3"><Icon name="pencil" size={18} /><Text className="text-label text-ink">{t('common.edit')}</Text></Pressable>
          <Pressable onPress={onMoveUp} disabled={!onMoveUp} accessibilityRole="button" accessibilityState={{ disabled: !onMoveUp }} accessibilityLabel={t('a11y.move_up_named', { name: plan.name })}
            className={`min-h-[48px] min-w-[48px] items-center justify-center rounded-xl bg-sand ${!onMoveUp ? 'opacity-40' : ''}`}><Icon name="moveUp" size={22} /></Pressable>
          <Pressable onPress={onMoveDown} disabled={!onMoveDown} accessibilityRole="button" accessibilityState={{ disabled: !onMoveDown }} accessibilityLabel={t('a11y.move_down_named', { name: plan.name })}
            className={`min-h-[48px] min-w-[48px] items-center justify-center rounded-xl bg-sand ${!onMoveDown ? 'opacity-40' : ''}`}><Icon name="moveDown" size={22} /></Pressable>
        </View> : null}
      </> : null}
    </View>
  );
}

export function PlansList({ habitationId, addSignal }: PlansListProps) {
  const { t } = useTranslation();
  const { data: plans, isLoading, isError, refetch } = usePlans(habitationId);
  // Une seule lecture des Pièces pour toutes les rangées : leur couleur est
  // la même information pour tout le monde, inutile de la redemander plan
  // par plan.
  const { data: pieces } = usePieces(habitationId);
  const createPlan = useCreatePlan(habitationId);
  const updatePlan = useUpdatePlan(habitationId);
  const deletePlan = useDeletePlan(habitationId);
  const reorderPlans = useReorderPlans(habitationId);
  // Un plan se renomme et se supprime comme le reste de l'inventaire : les
  // gestes qui ecrivent suivent le meme droit que partout ailleurs.
  const { data: permission } = useHabitationPermission(habitationId);
  const editable = canModify(permission);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [name, setName] = useState('');

  // Deplacer un plan d'un cran : on renumerote la serie complete, ce qui
  // repare au passage les rangs en double laisses par d'anciennes
  // suppressions (voir useReorderPlans).
  const move = (from: number, to: number) => {
    const ids = (plans ?? []).map((plan) => plan.id);
    if (to < 0 || to >= ids.length) return;
    const next = [...ids];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    reorderPlans.mutate(next);
  };

  const handleDelete = (id: string) => {
    confirmDelete(t, 'plans.delete_confirm_title', 'plans.delete_confirm_message', () => deletePlan.mutate(id));
  };

  const openCreate = () => {
    setEditingPlan(null);
    setName('');
    setModalOpen(true);
  };

// Ouvre la creation depuis le "+" de l'en-tete natif, qui est rendu par le
// FICHIER DE ROUTE (il doit connaitre l'onglet actif la ou il y en a un) mais
// dont l'action vit ICI, avec l'etat de la modale. Un compteur qui
// s'incremente plutot qu'un booleen : deux demandes successives doivent
// rouvrir la modale, ce qu'un booleen deja a true ne declencherait pas.
  useEffect(() => {
    if (addSignal) openCreate();
  }, [addSignal]);

  const pieceColors = new Map((pieces ?? []).map((piece) => [piece.id, piece.color ?? DEFAULT_PIECE_COLOR] as const));

  const isEmpty = !isLoading && (plans?.length ?? 0) === 0;

  return (
    <View className="flex-1 bg-sand">
      <ScrollView contentContainerClassName="px-6 pb-28 pt-4">
        {isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : isEmpty ? (
          <EmptyState icon="plan" title={t('plans.empty')} />
        ) : (
          plans?.map((plan, index) => (
            <PlanRow
              key={plan.id}
              plan={plan}
              pieceColors={pieceColors}
              editable={editable}
              onOpen={() => router.push(`/plan/${plan.id}`)}
              onEdit={() => {
                setEditingPlan(plan);
                setName(plan.name);
                setModalOpen(true);
              }}
              // L'ORDRE DE CETTE LISTE EST CELUI DES ÉTAGES : c'est lui que
              // reprend, tel quel et de haut en bas, le sélecteur de niveau
              // posé sur le plan. La personne range donc ses étages ici comme
              // elle veut les retrouver là-bas.
              onMoveUp={editable && index > 0 ? () => move(index, index - 1) : undefined}
              onMoveDown={editable && index < (plans?.length ?? 0) - 1 ? () => move(index, index + 1) : undefined}
            />
          ))
        )}
      </ScrollView>

      <CreateEntityModal
        visible={modalOpen}
        title={editingPlan ? t('plans.edit_title') : t('plans.create_title')}
        nameLabel={t('plans.name_label')}
        submitLabel={t('common.save')}
        cancelLabel={t('common.cancel')}
        name={name}
        onNameChange={setName}
        loading={createPlan.isPending || updatePlan.isPending}
        onClose={() => setModalOpen(false)}
        onDelete={editingPlan ? () => handleDelete(editingPlan.id) : undefined}
        onSubmit={async (submittedName) => {
          if (editingPlan) {
            await updatePlan.mutateAsync({ id: editingPlan.id, name: submittedName });
          } else {
            await createPlan.mutateAsync(submittedName);
          }
          setModalOpen(false);
        }}
      />
    </View>
  );
}
