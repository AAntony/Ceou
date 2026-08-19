import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { BottomActionBar } from '../../components/BottomActionBar';
import { Button } from '../../components/Button';
import { CreateEntityModal } from '../../components/CreateEntityModal';
import { EmptyState } from '../../components/EmptyState';
import { EntityCard } from '../../components/EntityCard';
import { EntityGrid } from '../../components/EntityGrid';
import { ErrorState } from '../../components/ErrorState';
import { confirmDelete } from '../../lib/confirmDelete';
import type { Plan } from '../../types/database';
import { useCreatePlan, useDeletePlan, usePlans, useUpdatePlan } from './queries';

type PlansListProps = {
  habitationId: string;
};

export function PlansList({ habitationId }: PlansListProps) {
  const { t } = useTranslation();
  const { data: plans, isLoading, isError, refetch } = usePlans(habitationId);
  const createPlan = useCreatePlan(habitationId);
  const updatePlan = useUpdatePlan(habitationId);
  const deletePlan = useDeletePlan(habitationId);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [name, setName] = useState('');

  const handleDelete = (id: string) => {
    confirmDelete(t, 'plans.delete_confirm_title', 'plans.delete_confirm_message', () => deletePlan.mutate(id));
  };

  const isEmpty = !isLoading && (plans?.length ?? 0) === 0;

  return (
    <View className="flex-1 bg-sand">
      <ScrollView contentContainerClassName="px-6 pb-52 pt-4">
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
                onLongPress={() => handleDelete(plan.id)}
                onEdit={() => {
                  setEditingPlan(plan);
                  setName(plan.name);
                  setModalOpen(true);
                }}
              />
            ))}
          </EntityGrid>
        )}
      </ScrollView>

      <BottomActionBar extraBottomOffset={88}>
        <View className="flex-1">
          <Button
            label={t('plans.add')}
            onPress={() => {
              setEditingPlan(null);
              setName('');
              setModalOpen(true);
            }}
          />
        </View>
      </BottomActionBar>

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
