import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';
import { BottomSheetModal } from '../../components/BottomSheetModal';
import { Button } from '../../components/Button';
import { CreateEntityModal } from '../../components/CreateEntityModal';
import { EmptyState } from '../../components/EmptyState';
import { EntityPhotoField } from '../../components/EntityPhotoField';
import { EntityRow } from '../../components/EntityRow';
import { ErrorState } from '../../components/ErrorState';
import { PresetPicker } from '../../components/PresetPicker';
import { confirmDelete } from '../../lib/confirmDelete';
import type { Conteneur, LocationType } from '../../types/database';
import { useSession } from '../auth/SessionProvider';
import { canModify, useLocationPermission } from '../sharing/queries';
import { CONTENEUR_PRESETS, getConteneurIcon, type ConteneurPresetKey } from './constants';
import { objetCountLabel } from './counts';
import { CreateObjetModal } from './CreateObjetModal';
import { resolveEntityPhotoUrl } from './entityPhoto';
import {
  nodeCountKey,
  useContainerContents,
  useCreateConteneur,
  useDeleteConteneur,
  useDeleteObjet,
  useHabitationIdForNode,
  useHabitationNodeCounts,
  useUpdateConteneur,
} from './queries';

type ContainerContentsProps = {
  parentType: LocationType;
  parentId: string;
  addSignal?: number;
};

export function ContainerContents({ parentType, parentId, addSignal }: ContainerContentsProps) {
  const { t } = useTranslation();
  const { session } = useSession();
  const { conteneurs, objets, isLoading, isError, refetch } = useContainerContents(parentType, parentId);
  // Compteurs à la maille de l'habitation : cet écran ne connaît que son
  // parent immédiat, qui peut être un conteneur imbriqué à n'importe quelle
  // profondeur — la résolution se fait donc côté SQL, en un appel.
  const { data: habitationId } = useHabitationIdForNode(parentType, parentId);
  const { data: counts } = useHabitationNodeCounts(habitationId);
  const { data: permission } = useLocationPermission(parentType, parentId);
  const editable = canModify(permission);
  const createConteneur = useCreateConteneur(parentType, parentId);
  const updateConteneur = useUpdateConteneur();
  const deleteConteneur = useDeleteConteneur();
  const deleteObjet = useDeleteObjet();
  const [conteneurModalOpen, setConteneurModalOpen] = useState(false);
  const [editingConteneur, setEditingConteneur] = useState<Conteneur | null>(null);
  const [conteneurName, setConteneurName] = useState('');
  const [conteneurPresetKey, setConteneurPresetKey] = useState<ConteneurPresetKey | null>(null);
  const [conteneurPhotoUri, setConteneurPhotoUri] = useState<string | null>(null);
  const [objetModalOpen, setObjetModalOpen] = useState(false);

  const handleDeleteConteneur = (id: string) => {
    confirmDelete(t, 'inventory.conteneurs.delete_confirm_title', 'inventory.conteneurs.delete_confirm_message', () =>
      deleteConteneur.mutate(id),
    );
  };

  const openEditConteneur = (conteneur: Conteneur) => {
    setEditingConteneur(conteneur);
    setConteneurName(conteneur.name);
    setConteneurPresetKey((conteneur.preset_key as ConteneurPresetKey) ?? null);
    setConteneurPhotoUri(conteneur.photo_url);
    setConteneurModalOpen(true);
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
          <>
            {conteneurs.map((conteneur) => (
              <EntityRow
                key={conteneur.id}
                level="conteneur"
                icon={getConteneurIcon(conteneur.preset_key)}
                title={conteneur.name}
                subtitle={objetCountLabel(t, counts, nodeCountKey('conteneur', conteneur.id))}
                photoUri={conteneur.photo_url}
                onPress={() => router.push(`/conteneur/${conteneur.id}`)}
                onLongPress={editable ? () => handleDeleteConteneur(conteneur.id) : undefined}
                onEdit={editable ? () => openEditConteneur(conteneur) : undefined}
              />
            ))}
            {/* Les Objets ferment la liste : un Conteneur se descend, un
                Objet est une feuille — les mélanger ferait perdre la
                distinction que la hiérarchie entière sert à établir. */}
            {objets.map((objet) => (
              <EntityRow
                key={objet.id}
                level="objet"
                icon="objet"
                title={objet.name}
                photoUri={objet.photo_url}
                iconColor="#D85A30"
                onPress={() => router.push(`/objet/${objet.id}`)}
                onLongPress={editable ? () => handleDeleteObjet(objet.id) : undefined}
              />
            ))}
          </>
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
            setConteneurPresetKey(null);
            setConteneurPhotoUri(null);
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
          const userId = session!.user.id;
          if (editingConteneur) {
            const photoUrl = await resolveEntityPhotoUrl({
              level: 'conteneur',
              entityId: editingConteneur.id,
              userId,
              chosen: conteneurPhotoUri,
              current: editingConteneur.photo_url,
            });
            await updateConteneur.mutateAsync({
              id: editingConteneur.id,
              name: submittedName,
              presetKey: conteneurPresetKey,
              photoUrl,
            });
          } else {
            // La ligne d'abord, la photo ensuite : le fichier est nommé
            // d'après l'identifiant, qui n'existe qu'une fois la ligne créée.
            const conteneur = await createConteneur.mutateAsync({
              name: submittedName,
              presetKey: conteneurPresetKey,
            });
            const photoUrl = await resolveEntityPhotoUrl({
              level: 'conteneur',
              entityId: conteneur.id,
              userId,
              chosen: conteneurPhotoUri,
              current: null,
            });
            if (photoUrl !== undefined) {
              await updateConteneur.mutateAsync({ id: conteneur.id, name: submittedName, photoUrl });
            }
          }
          setConteneurModalOpen(false);
        }}
      >
        <PresetPicker
          presets={CONTENEUR_PRESETS}
          selectedKey={conteneurPresetKey}
          onSelect={(key) => {
            setConteneurPresetKey(key as ConteneurPresetKey);
            // Préremplissage du nom depuis la catégorie, comme aux autres
            // niveaux — mais jamais par-dessus un nom déjà personnalisé.
            if (!editingConteneur) setConteneurName(t(`inventory.conteneurPresets.${key}`));
          }}
          labelFor={(key) => t(`inventory.conteneurPresets.${key}`)}
        />
        <EntityPhotoField level="conteneur" photoUri={conteneurPhotoUri} onChange={setConteneurPhotoUri} />
      </CreateEntityModal>

      <CreateObjetModal
        visible={objetModalOpen}
        onClose={() => setObjetModalOpen(false)}
        parentType={parentType}
        parentId={parentId}
      />
    </View>
  );
}
