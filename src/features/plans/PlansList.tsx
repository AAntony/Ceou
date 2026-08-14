import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, View } from 'react-native';
import { BottomActionBar } from '../../components/BottomActionBar';
import { Button } from '../../components/Button';
import { CreateEntityModal } from '../../components/CreateEntityModal';
import { EmptyState } from '../../components/EmptyState';
import { EntityCard } from '../../components/EntityCard';
import type { Plan } from '../../types/database';
import { useCreatePlan, useDeletePlan, usePlans, useUpdatePlan } from './queries';

type PlansListProps = {
  habitationId: string;
};

export function PlansList({ habitationId }: PlansListProps) {
  const { t } = useTranslation();
  const { data: plans, isLoading } = usePlans(habitationId);
  const createPlan = useCreatePlan(habitationId);
  const updatePlan = useUpdatePlan(habitationId);
  const deletePlan = useDeletePlan(habitationId);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [name, setName] = useState('');

  const handleDelete = (id: string) => {
    Alert.alert(t('plans.delete_confirm_title'), t('plans.delete_confirm_message'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => deletePlan.mutate(id) },
    ]);
  };

  const isEmpty = !isLoading && (plans?.length ?? 0) === 0;

  return (
    <View className="flex-1 bg-sand">
      <ScrollView contentContainerClassName="px-6 pb-52 pt-4">
        {isEmpty ? (
          <EmptyState icon="plan" title={t('plans.empty')} />
        ) : (
          plans?.map((plan) => (
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
          ))
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
