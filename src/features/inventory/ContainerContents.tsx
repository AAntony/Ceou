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
import { HUE_BADGE_FILL, HUE_CARD_BG_HEX } from '../search/palette';
import type { Conteneur, LocationType } from '../../types/database';
import { canModify, useLocationPermission } from '../sharing/queries';
import { CreateObjetModal } from './CreateObjetModal';
import { useContainerContents, useCreateConteneur, useDeleteConteneur, useDeleteObjet, useUpdateConteneur } from './queries';

type ContainerContentsProps = {
  parentType: LocationType;
  parentId: string;
};

export function ContainerContents({ parentType, parentId }: ContainerContentsProps) {
  const { t } = useTranslation();
  const { conteneurs, objets, isLoading, isError, refetch } = useContainerContents(parentType, parentId);
  const { data: permission } = useLocationPermission(parentType, parentId);
  const editable = canModify(permission);
  const createConteneur = useCreateConteneur(parentType, parentId);
  const updateConteneur = useUpdateConteneur();
  const deleteConteneur = useDeleteConteneur();
  const deleteObjet = useDeleteObjet();
  const [conteneurModalOpen, setConteneurModalOpen] = useState(false);
  const [editingConteneur, setEditingConteneur] = useState<Conteneur | null>(null);
  const [conteneurName, setConteneurName] = useState('');
  const [objetModalOpen, setObjetModalOpen] = useState(false);

  const handleDeleteConteneur = (id: string) => {
    confirmDelete(t, 'inventory.conteneurs.delete_confirm_title', 'inventory.conteneurs.delete_confirm_message', () =>
      deleteConteneur.mutate(id),
    );
  };

  const handleDeleteObjet = (id: string) => {
    confirmDelete(t, 'inventory.objet.delete_confirm_title', 'inventory.objet.delete_confirm_message', () => deleteObjet.mutate(id));
  };

  const isEmpty = !isLoading && conteneurs.length === 0 && objets.length === 0;

  return (
    <View className="flex-1 bg-sand">
      <ScrollView contentContainerClassName="px-6 pb-52 pt-4">
        {isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : isEmpty ? (
          <EmptyState icon="conteneur" title={t('inventory.container.empty')} />
        ) : (
          <EntityGrid>
            {conteneurs.map((conteneur) => (
              <EntityCard
                key={conteneur.id}
                icon="conteneur"
                title={conteneur.name}
                bgColor={HUE_CARD_BG_HEX.sky}
                badgeColor={HUE_BADGE_FILL.sky}
                onPress={() => router.push(`/conteneur/${conteneur.id}`)}
                onLongPress={editable ? () => handleDeleteConteneur(conteneur.id) : undefined}
                onEdit={
                  editable
                    ? () => {
                        setEditingConteneur(conteneur);
                        setConteneurName(conteneur.name);
                        setConteneurModalOpen(true);
                      }
                    : undefined
                }
              />
            ))}
            {objets.map((objet) => (
              <EntityCard
                key={objet.id}
                icon="objet"
                imageUri={objet.photo_url}
                title={objet.name}
                bgColor={HUE_CARD_BG_HEX.coral}
                badgeColor={HUE_BADGE_FILL.coral}
                onPress={() => router.push(`/objet/${objet.id}`)}
                onLongPress={editable ? () => handleDeleteObjet(objet.id) : undefined}
              />
            ))}
          </EntityGrid>
        )}
      </ScrollView>

      {editable ? (
        <BottomActionBar extraBottomOffset={88}>
          <View className="flex-1">
            <Button
              label={t('inventory.container.add_conteneur')}
              variant="ghost"
              onPress={() => {
                setEditingConteneur(null);
                setConteneurName('');
                setConteneurModalOpen(true);
              }}
            />
          </View>
          <View className="flex-1">
            <Button label={t('inventory.container.add_objet')} onPress={() => setObjetModalOpen(true)} />
          </View>
        </BottomActionBar>
      ) : null}

      <CreateEntityModal
        visible={conteneurModalOpen}
        title={editingConteneur ? t('inventory.conteneurs.edit_title') : t('inventory.container.create_conteneur_title')}
        nameLabel={t('inventory.container.name_label')}
        submitLabel={t('common.save')}
        cancelLabel={t('common.cancel')}
        name={conteneurName}
        onNameChange={setConteneurName}
        loading={createConteneur.isPending || updateConteneur.isPending}
        onClose={() => setConteneurModalOpen(false)}
        onSubmit={async (submittedName) => {
          if (editingConteneur) {
            await updateConteneur.mutateAsync({ id: editingConteneur.id, name: submittedName });
          } else {
            await createConteneur.mutateAsync(submittedName);
          }
          setConteneurModalOpen(false);
        }}
      />

      <CreateObjetModal
        visible={objetModalOpen}
        onClose={() => setObjetModalOpen(false)}
        parentType={parentType}
        parentId={parentId}
      />
    </View>
  );
}
