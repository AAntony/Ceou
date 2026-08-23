import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { CreateEntityModal } from '../../components/CreateEntityModal';
import { EmptyState } from '../../components/EmptyState';
import { EntityCard } from '../../components/EntityCard';
import { EntityGrid } from '../../components/EntityGrid';
import { ErrorState } from '../../components/ErrorState';
import { confirmDelete } from '../../lib/confirmDelete';
import { canModify, useHabitationPermission } from '../sharing/queries';
import type { Plan } from '../../types/database';
import { useCreatePlan, useDeletePlan, usePlans, useUpdatePlan } from './queries';

type PlansListProps = {
  habitationId: string;
  addSignal?: number;
};

export function PlansList({ habitationId, addSignal }: PlansListProps) {
  const { t } = useTranslation();
  const { data: plans, isLoading, isError, refetch } = usePlans(habitationId);
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

  const isEmpty = !isLoading && (plans?.length ?? 0) === 0;

  return (
    <View className="flex-1 bg-sand">
      <ScrollView contentContainerClassName="px-6 pb-28 pt-4">
        {isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : isEmpty ? (
          <EmptyState icon="plan" title={t('plans.empty')} />
        ) : (
          <EntityGrid>
            {plans?.map((plan) => (
              <EntityCard
                key={plan.id}
                icon="plan"
                title={plan.name}
                onPress={() => router.push(`/plan/${plan.id}`)}
                onLongPress={editable ? () => handleDelete(plan.id) : undefined}
                onEdit={
                  editable
                    ? () => {
                        setEditingPlan(plan);
                        setName(plan.name);
                        setModalOpen(true);
                      }
                    : undefined
                }
              />
            ))}
          </EntityGrid>
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
