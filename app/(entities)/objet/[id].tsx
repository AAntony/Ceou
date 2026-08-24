import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Button } from '../../../src/components/Button';
import { ErrorState } from '../../../src/components/ErrorState';
import { Icon } from '../../../src/components/Icon';
import { PhotoViewerModal } from '../../../src/components/PhotoViewerModal';
import { TextField } from '../../../src/components/TextField';
import { useSession } from '../../../src/features/auth/SessionProvider';
import { LocationBreadcrumb } from '../../../src/features/inventory/LocationBreadcrumb';
import { MoveObjetModal } from '../../../src/features/inventory/MoveObjetModal';
import { useDeleteObjet, useObjet, useObjetHistory, useObjetLocationChain, useUpdateObjet } from '../../../src/features/inventory/queries';
import { PlanLocationLink } from '../../../src/features/plans/PlanLocationLink';
import { canModify, useHabitationPermission } from '../../../src/features/sharing/queries';
import { confirmDelete } from '../../../src/lib/confirmDelete';
import { pickAndUploadImage } from '../../../src/lib/images/pickAndUploadImage';
import { useThemeColors } from '../../../src/lib/theme';
import { usePullToRefresh } from '../../../src/components/usePullToRefresh';

export default function ObjetScreen() {
  const refreshControl = usePullToRefresh();
  const colors = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { session } = useSession();
  const { data: objet, isLoading, isError, refetch } = useObjet(id);
  const { data: history } = useObjetHistory(id);
  const { data: locationChain } = useObjetLocationChain(id);
  const pieceId = locationChain?.find((node) => node.kind === 'piece')?.id;
  const emplacementId = locationChain?.find((node) => node.kind === 'emplacement')?.id;
  const habitationId = locationChain?.find((node) => node.kind === 'habitation')?.id;
  const { data: permission } = useHabitationPermission(habitationId);
  const editable = canModify(permission);
  const updateObjet = useUpdateObjet(id);
  const deleteObjet = useDeleteObjet();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false);

  useEffect(() => {
    if (objet) {
      setName(objet.name);
      setDescription(objet.description ?? '');
    }
  }, [objet]);

  const handleSave = () => {
    updateObjet.mutate({ name, description: description || null });
  };

  const handleChangePhoto = async () => {
    if (!session) return;
    setPhotoUploading(true);
    try {
      const photoUrl = await pickAndUploadImage({
        bucket: 'objets',
        path: `${session.user.id}/${id}.jpg`,
        aspect: [1, 1],
      });
      if (photoUrl) updateObjet.mutate({ photo_url: photoUrl });
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleDelete = () => {
    confirmDelete(t, 'inventory.objet.delete_confirm_title', 'inventory.objet.delete_confirm_message', async () => {
      await deleteObjet.mutateAsync(id);
      router.back();
    });
  };

  if (isError) {
    return (
      <View className="flex-1 bg-sand">
        <ErrorState onRetry={() => refetch()} />
      </View>
    );
  }

  if (isLoading || !objet) {
    return (
      <View className="flex-1 items-center justify-center bg-sand">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: objet.name }} />
      <ScrollView className="flex-1 bg-sand" contentContainerClassName="px-6 pb-40 pt-6" refreshControl={refreshControl}>
        <View className="mb-6 self-center">
          <Pressable
            onPress={() => (objet.photo_url ? setPhotoViewerOpen(true) : editable ? handleChangePhoto() : undefined)}
            accessibilityRole="button"
            accessibilityLabel={t(objet.photo_url ? 'a11y.view_photo' : 'a11y.change_photo')}
            className="h-40 w-40 items-center justify-center overflow-hidden rounded-2xl bg-sand-dark"
          >
            {photoUploading ? (
              <ActivityIndicator />
            ) : objet.photo_url ? (
              <Image source={{ uri: objet.photo_url }} style={{ width: 160, height: 160 }} />
            ) : (
              <Text className="px-2 text-center text-sm text-ink-soft">{editable ? t('inventory.objet.add_photo') : ''}</Text>
            )}
          </Pressable>
          {objet.photo_url && editable ? (
            <Pressable
              onPress={handleChangePhoto}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('a11y.change_photo')}
              className="absolute -bottom-2 -right-2 h-9 w-9 items-center justify-center rounded-full border border-ink/10 bg-surface"
              style={{ elevation: 3, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } }}
            >
              {photoUploading ? <ActivityIndicator size="small" /> : <Icon name="pencil" size={16} color={colors.ink} />}
            </Pressable>
          ) : null}
        </View>

        <LocationBreadcrumb objetId={id} />
        <PlanLocationLink pieceId={pieceId} emplacementId={emplacementId} />

        <TextField label={t('inventory.objet.name_label')} value={name} onChangeText={setName} editable={editable} />
        <TextField
          label={t('inventory.objet.description_label')}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
          editable={editable}
        />

        {editable ? (
          <>
            <View className="mb-6">
              <Button label={t('common.save')} onPress={handleSave} loading={updateObjet.isPending} />
            </View>
            <View className="mb-8">
              <Button label={t('inventory.objet.move')} variant="ghost" onPress={() => setMoveModalOpen(true)} />
            </View>
          </>
        ) : null}

        <Text className="mb-2 text-base font-bold text-ink">{t('inventory.objet.history_title')}</Text>
        {history && history.length > 0 ? (
          history.map((entry) => (
            <View key={entry.id} className="mb-2 rounded-xl border border-ink/10 px-4 py-3">
              <Text className="text-sm text-ink">
                {entry.from_location_label} → {entry.to_location_label}
              </Text>
              <Text className="text-xs text-ink-soft">{new Date(entry.moved_at).toLocaleString()}</Text>
            </View>
          ))
        ) : (
          <Text className="text-sm text-ink-soft">{t('inventory.objet.history_empty')}</Text>
        )}

        {editable ? (
          <View className="mt-10">
            <Button label={t('common.delete')} variant="danger" onPress={handleDelete} />
          </View>
        ) : null}
      </ScrollView>

      <MoveObjetModal visible={moveModalOpen} onClose={() => setMoveModalOpen(false)} objetId={id} />
      <PhotoViewerModal visible={photoViewerOpen} uri={objet.photo_url} onClose={() => setPhotoViewerOpen(false)} />
    </>
  );
}
