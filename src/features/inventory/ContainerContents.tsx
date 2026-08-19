import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';
import { BottomSheetModal } from '../../components/BottomSheetModal';
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
  addSignal?: number;
};

export function ContainerContents({ parentType, parentId, addSignal }: ContainerContentsProps) {
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

  // Seul ecran a proposer DEUX ajouts (un Emplacement contient a la fois des
  // Conteneurs et des Objets), donc le "+" de l'en-tete y pose la question au
  // lieu de deviner. Un tap de plus, sur un seul ecran, contre la suppression
  // d'une barre d'action partout ailleurs.
  const [choiceOpen, setChoiceOpen] = useState(false);
  useEffect(() => {
    if (addSignal) setChoiceOpen(true);
  }, [addSignal]);

  const isEmpty = !isLoading && conteneurs.length === 0 && objets.length === 0;

  return (
    <View className="flex-1 bg-sand">
      <ScrollView contentContainerClassName="px-6 pb-28 pt-4">
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
                bgColor={HUE_CARD_BG_HEX.lavender}
                badgeColor={HUE_BADGE_FILL.lavender}
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

      <BottomSheetModal
        visible={choiceOpen && editable}
        onClose={() => setChoiceOpen(false)}
        sheetClassName="rounded-t-3xl bg-white px-6 pb-4 pt-6"
      >
        <Text className="mb-4 text-xl font-bold text-ink">{t('inventory.container.add_choice_title')}</Text>
        <View className="mb-3">
          <Button
            label={t('inventory.container.add_objet')}
            onPress={() => {
              setChoiceOpen(false);
              setObjetModalOpen(true);
            }}
          />
        </View>
        <Button
          label={t('inventory.container.add_conteneur')}
          variant="outline"
          onPress={() => {
            setChoiceOpen(false);
            setEditingConteneur(null);
            setConteneurName('');
            setConteneurModalOpen(true);
          }}
        />
      </BottomSheetModal>

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
