import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { pickImage, uploadImage } from '../../lib/images/pickAndUploadImage';
import { supabase } from '../../lib/supabase/client';
import type { LocationType } from '../../types/database';
import { useSession } from '../auth/SessionProvider';
import { useCreateObjet } from './queries';

type CreateObjetModalProps = {
  visible: boolean;
  onClose: () => void;
  parentType: LocationType;
  parentId: string;
};

export function CreateObjetModal({ visible, onClose, parentType, parentId }: CreateObjetModalProps) {
  const { t } = useTranslation();
  const { session } = useSession();
  const queryClient = useQueryClient();
  const createObjet = useCreateObjet(parentType, parentId);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [localPhotoUri, setLocalPhotoUri] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setName('');
      setDescription('');
      setLocalPhotoUri(null);
    }
  }, [visible]);

  const handlePickPhoto = async () => {
    const uri = await pickImage([1, 1]);
    if (uri) setLocalPhotoUri(uri);
  };

  const handleSubmit = async () => {
    if (!name.trim() || !session) return;

    try {
      const objet = await createObjet.mutateAsync({
        name: name.trim(),
        description: description.trim() || null,
        photoUrl: null,
      });

      if (localPhotoUri) {
        const photoUrl = await uploadImage(localPhotoUri, {
          bucket: 'objets',
          path: `${session.user.id}/${objet.id}.jpg`,
        });
        const { error } = await supabase.from('objets').update({ photo_url: photoUrl }).eq('id', objet.id);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['containerContents'] });
      }

      onClose();
    } catch {
      Alert.alert(t('common.error_generic'));
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <View className="rounded-t-3xl bg-white px-6 pb-10 pt-6">
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text className="mb-4 text-xl font-bold text-neutral-900">{t('inventory.container.create_objet_title')}</Text>

            <Pressable onPress={handlePickPhoto} className="mb-4 h-32 w-32 items-center justify-center self-center overflow-hidden rounded-xl bg-neutral-100">
              {localPhotoUri ? (
                <Image source={{ uri: localPhotoUri }} style={{ width: 128, height: 128 }} />
              ) : (
                <Text className="px-2 text-center text-sm text-neutral-500">{t('inventory.objet.add_photo')}</Text>
              )}
            </Pressable>

            <TextField label={t('inventory.objet.name_label')} value={name} onChangeText={setName} autoFocus />
            <TextField
              label={t('inventory.objet.description_label')}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />

            <View className="mt-2 flex-row gap-3">
              <View className="flex-1">
                <Button label={t('common.cancel')} variant="ghost" onPress={onClose} />
              </View>
              <View className="flex-1">
                <Button
                  label={t('common.save')}
                  onPress={handleSubmit}
                  loading={createObjet.isPending}
                  disabled={!name.trim()}
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
