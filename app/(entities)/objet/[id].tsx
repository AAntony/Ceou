import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Button } from '../../../src/components/Button';
import { TextField } from '../../../src/components/TextField';
import { useSession } from '../../../src/features/auth/SessionProvider';
import { LocationBreadcrumb } from '../../../src/features/inventory/LocationBreadcrumb';
import { MoveObjetModal } from '../../../src/features/inventory/MoveObjetModal';
import { useDeleteObjet, useObjet, useObjetHistory, useObjetLocationChain, useUpdateObjet } from '../../../src/features/inventory/queries';
import { PlanLocationLink } from '../../../src/features/plans/PlanLocationLink';
import { pickAndUploadImage } from '../../../src/lib/images/pickAndUploadImage';

export default function ObjetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { session } = useSession();
  const { data: objet, isLoading } = useObjet(id);
  const { data: history } = useObjetHistory(id);
  const { data: locationChain } = useObjetLocationChain(id);
  const pieceId = locationChain?.find((node) => node.kind === 'piece')?.id;
  const emplacementId = locationChain?.find((node) => node.kind === 'emplacement')?.id;
  const updateObjet = useUpdateObjet(id);
  const deleteObjet = useDeleteObjet();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);

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
        maxSize: 1024,
        aspect: [1, 1],
      });
      if (photoUrl) updateObjet.mutate({ photo_url: photoUrl });
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(t('inventory.objet.delete_confirm_title'), t('inventory.objet.delete_confirm_message'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteObjet.mutateAsync(id);
          router.back();
        },
      },
    ]);
  };

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
      <ScrollView className="flex-1 bg-sand" contentContainerClassName="px-6 pb-40 pt-6">
        <Pressable
          onPress={handleChangePhoto}
          className="mb-6 h-40 w-40 items-center justify-center self-center overflow-hidden rounded-2xl bg-sand-dark"
        >
          {photoUploading ? (
            <ActivityIndicator />
          ) : objet.photo_url ? (
            <Image source={{ uri: objet.photo_url }} style={{ width: 160, height: 160 }} />
          ) : (
            <Text className="px-2 text-center text-sm text-ink-soft">{t('inventory.objet.add_photo')}</Text>
          )}
        </Pressable>

        <LocationBreadcrumb objetId={id} />
        <PlanLocationLink pieceId={pieceId} emplacementId={emplacementId} />

        <TextField label={t('inventory.objet.name_label')} value={name} onChangeText={setName} />
        <TextField
          label={t('inventory.objet.description_label')}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
        />

        <View className="mb-6">
          <Button label={t('common.save')} onPress={handleSave} loading={updateObjet.isPending} />
        </View>

        <View className="mb-8">
          <Button label={t('inventory.objet.move')} variant="ghost" onPress={() => setMoveModalOpen(true)} />
        </View>

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

        <Pressable onPress={handleDelete} className="mt-10">
          <Text className="text-center text-sm font-semibold text-red-600">{t('common.delete')}</Text>
        </Pressable>
      </ScrollView>

      <MoveObjetModal visible={moveModalOpen} onClose={() => setMoveModalOpen(false)} objetId={id} />
    </>
  );
}
