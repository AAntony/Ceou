import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { CreateEntityModal } from '../../components/CreateEntityModal';
import { EmptyState } from '../../components/EmptyState';
import { EntityRow } from '../../components/EntityRow';
import { ErrorState } from '../../components/ErrorState';
import { confirmDelete } from '../../lib/confirmDelete';
import { canModify, useHabitationPermission } from '../sharing/queries';
import { DEFAULT_PIECE_COLOR } from '../inventory/constants';
import { usePieces } from '../inventory/queries';
import { roomColorForForme } from './constants';
import { PlanThumbnail } from './PlanThumbnail';
import { useCreatePlan, useDeletePlan, usePlanFormes, usePlans, useUpdatePlan } from './queries';
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
  onDelete,
}: {
  plan: Plan;
  pieceColors: Map<string, string>;
  editable: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const { data: formes } = usePlanFormes(plan.id);
  const rooms = formes ?? [];

  // Exactement la règle du canevas : couleur de la Pièce associée, sinon une
  // teinte tirée de l'identifiant de la forme. Une vignette qui ne
  // ressemblerait pas au plan qu'elle annonce ne servirait à rien.
  const colorForForme = (forme: PlanForme) =>
    forme.piece_id ? (pieceColors.get(forme.piece_id) ?? DEFAULT_PIECE_COLOR) : roomColorForForme(forme.id);

  return (
    <EntityRow
      level="habitation"
      // Sans taille : la vignette se mesure sur la case que la rangee lui
      // donne, qui change avec le reglage d'affichage.
      thumbnail={<PlanThumbnail formes={rooms} colorForForme={colorForForme} />}
      icon="plan"
      title={plan.name}
      subtitle={rooms.length === 0 ? t('plans.rooms_count_zero') : t('plans.rooms_count', { count: rooms.length })}
      onPress={onOpen}
      onEdit={editable ? onEdit : undefined}
      onLongPress={editable ? onDelete : undefined}
    />
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
  // Un plan se renomme et se supprime comme le reste de l'inventaire : les
  // gestes qui ecrivent suivent le meme droit que partout ailleurs.
  const { data: permission } = useHabitationPermission(habitationId);
  const editable = canModify(permission);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [name, setName] = useState('');

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
          plans?.map((plan) => (
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
              onDelete={() => handleDelete(plan.id)}
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
