import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, View } from 'react-native';
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

  const handleDelete = (id: string) => {
    Alert.alert(t('plans.delete_confirm_title'), t('plans.delete_confirm_message'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => deletePlan.mutate(id) },
    ]);
  };

  const isEmpty = !isLoading && (plans?.length ?? 0) === 0;

  return (
    <View className="flex-1 bg-white">
      <ScrollView contentContainerClassName="px-6 pb-28 pt-4">
        {isEmpty ? (
          <EmptyState icon="📐" title={t('plans.empty')} />
        ) : (
          plans?.map((plan) => (
            <EntityCard
              key={plan.id}
              icon="📐"
              title={plan.name}
              onPress={() => router.push(`/plan/${plan.id}`)}
              onLongPress={() => handleDelete(plan.id)}
              onEdit={() => {
                setEditingPlan(plan);
                setModalOpen(true);
              }}
            />
          ))
        )}
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 border-t border-neutral-100 bg-white px-6 py-4">
        <Button
          label={t('plans.add')}
          onPress={() => {
            setEditingPlan(null);
            setModalOpen(true);
          }}
        />
      </View>

      <CreateEntityModal
        visible={modalOpen}
        title={editingPlan ? t('plans.edit_title') : t('plans.create_title')}
        nameLabel={t('plans.name_label')}
        submitLabel={t('common.save')}
        cancelLabel={t('common.cancel')}
        initialName={editingPlan?.name}
        loading={createPlan.isPending || updatePlan.isPending}
        onClose={() => setModalOpen(false)}
        onSubmit={async (name) => {
          if (editingPlan) {
            await updatePlan.mutateAsync({ id: editingPlan.id, name });
          } else {
            await createPlan.mutateAsync(name);
          }
          setModalOpen(false);
        }}
      />
    </View>
  );
}
