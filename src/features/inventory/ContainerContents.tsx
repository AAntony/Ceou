import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, View } from 'react-native';
import { BottomActionBar } from '../../components/BottomActionBar';
import { Button } from '../../components/Button';
import { CreateEntityModal } from '../../components/CreateEntityModal';
import { EmptyState } from '../../components/EmptyState';
import { EntityCard } from '../../components/EntityCard';
import type { Conteneur, LocationType } from '../../types/database';
import { CreateObjetModal } from './CreateObjetModal';
import { useContainerContents, useCreateConteneur, useDeleteConteneur, useDeleteObjet, useUpdateConteneur } from './queries';

type ContainerContentsProps = {
  parentType: LocationType;
  parentId: string;
};

export function ContainerContents({ parentType, parentId }: ContainerContentsProps) {
  const { t } = useTranslation();
  const { conteneurs, objets, isLoading } = useContainerContents(parentType, parentId);
  const createConteneur = useCreateConteneur(parentType, parentId);
  const updateConteneur = useUpdateConteneur();
  const deleteConteneur = useDeleteConteneur();
  const deleteObjet = useDeleteObjet();
  const [conteneurModalOpen, setConteneurModalOpen] = useState(false);
  const [editingConteneur, setEditingConteneur] = useState<Conteneur | null>(null);
  const [objetModalOpen, setObjetModalOpen] = useState(false);

  const handleDeleteConteneur = (id: string) => {
    Alert.alert(t('inventory.conteneurs.delete_confirm_title'), t('inventory.conteneurs.delete_confirm_message'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => deleteConteneur.mutate(id) },
    ]);
  };

  const handleDeleteObjet = (id: string) => {
    Alert.alert(t('inventory.objet.delete_confirm_title'), t('inventory.objet.delete_confirm_message'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => deleteObjet.mutate(id) },
    ]);
  };

  const isEmpty = !isLoading && conteneurs.length === 0 && objets.length === 0;

  return (
    <View className="flex-1 bg-sand">
      <ScrollView contentContainerClassName="px-6 pb-52 pt-4">
        {isEmpty ? (
          <EmptyState icon="conteneur" title={t('inventory.container.empty')} />
        ) : (
          <>
            {conteneurs.map((conteneur) => (
              <EntityCard
                key={conteneur.id}
                icon="conteneur"
                title={conteneur.name}
                onPress={() => router.push(`/conteneur/${conteneur.id}`)}
                onLongPress={() => handleDeleteConteneur(conteneur.id)}
                onEdit={() => {
                  setEditingConteneur(conteneur);
                  setConteneurModalOpen(true);
                }}
              />
            ))}
            {objets.map((objet) => (
              <EntityCard
                key={objet.id}
                icon="objet"
                imageUri={objet.photo_url}
                title={objet.name}
                onPress={() => router.push(`/objet/${objet.id}`)}
                onLongPress={() => handleDeleteObjet(objet.id)}
              />
            ))}
          </>
        )}
      </ScrollView>

      <BottomActionBar extraBottomOffset={88}>
        <View className="flex-1">
          <Button
            label={t('inventory.container.add_conteneur')}
            variant="ghost"
            onPress={() => {
              setEditingConteneur(null);
              setConteneurModalOpen(true);
            }}
          />
        </View>
        <View className="flex-1">
          <Button label={t('inventory.container.add_objet')} onPress={() => setObjetModalOpen(true)} />
        </View>
      </BottomActionBar>

      <CreateEntityModal
        visible={conteneurModalOpen}
        title={editingConteneur ? t('inventory.conteneurs.edit_title') : t('inventory.container.create_conteneur_title')}
        nameLabel={t('inventory.container.name_label')}
        submitLabel={t('common.save')}
        cancelLabel={t('common.cancel')}
        initialName={editingConteneur?.name}
        loading={createConteneur.isPending || updateConteneur.isPending}
        onClose={() => setConteneurModalOpen(false)}
        onSubmit={async (name) => {
          if (editingConteneur) {
            await updateConteneur.mutateAsync({ id: editingConteneur.id, name });
          } else {
            await createConteneur.mutateAsync(name);
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
