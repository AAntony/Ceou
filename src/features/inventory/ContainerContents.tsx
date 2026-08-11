import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, View } from 'react-native';
import { Button } from '../../components/Button';
import { CreateEntityModal } from '../../components/CreateEntityModal';
import { EmptyState } from '../../components/EmptyState';
import { EntityCard } from '../../components/EntityCard';
import type { LocationType } from '../../types/database';
import { CreateObjetModal } from './CreateObjetModal';
import { useContainerContents, useCreateConteneur, useDeleteConteneur, useDeleteObjet } from './queries';

type ContainerContentsProps = {
  parentType: LocationType;
  parentId: string;
};

export function ContainerContents({ parentType, parentId }: ContainerContentsProps) {
  const { t } = useTranslation();
  const { conteneurs, objets, isLoading } = useContainerContents(parentType, parentId);
  const createConteneur = useCreateConteneur(parentType, parentId);
  const deleteConteneur = useDeleteConteneur();
  const deleteObjet = useDeleteObjet();
  const [conteneurModalOpen, setConteneurModalOpen] = useState(false);
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
    <View className="flex-1 bg-white">
      <ScrollView contentContainerClassName="px-6 pb-28 pt-4">
        {isEmpty ? (
          <EmptyState title={t('inventory.container.empty')} />
        ) : (
          <>
            {conteneurs.map((conteneur) => (
              <EntityCard
                key={conteneur.id}
                icon="🗃️"
                title={conteneur.name}
                onPress={() => router.push(`/conteneur/${conteneur.id}`)}
                onLongPress={() => handleDeleteConteneur(conteneur.id)}
              />
            ))}
            {objets.map((objet) => (
              <EntityCard
                key={objet.id}
                icon="📦"
                imageUri={objet.photo_url}
                title={objet.name}
                onPress={() => router.push(`/objet/${objet.id}`)}
                onLongPress={() => handleDeleteObjet(objet.id)}
              />
            ))}
          </>
        )}
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 flex-row gap-3 border-t border-neutral-100 bg-white px-6 py-4">
        <View className="flex-1">
          <Button label={t('inventory.container.add_conteneur')} variant="ghost" onPress={() => setConteneurModalOpen(true)} />
        </View>
        <View className="flex-1">
          <Button label={t('inventory.container.add_objet')} onPress={() => setObjetModalOpen(true)} />
        </View>
      </View>

      <CreateEntityModal
        visible={conteneurModalOpen}
        title={t('inventory.container.create_conteneur_title')}
        nameLabel={t('inventory.container.name_label')}
        submitLabel={t('common.save')}
        cancelLabel={t('common.cancel')}
        loading={createConteneur.isPending}
        onClose={() => setConteneurModalOpen(false)}
        onSubmit={async (name) => {
          await createConteneur.mutateAsync(name);
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
