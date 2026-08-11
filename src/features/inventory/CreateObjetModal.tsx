import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { lookupBarcode } from '../../lib/barcode/lookupBarcode';
import { pickImage, uploadImage } from '../../lib/images/pickAndUploadImage';
import { supabase } from '../../lib/supabase/client';
import type { LocationType } from '../../types/database';
import { useSession } from '../auth/SessionProvider';
import { BarcodeScanner } from './BarcodeScanner';
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
  const [barcode, setBarcode] = useState<string | null>(null);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setName('');
      setDescription('');
      setLocalPhotoUri(null);
      setBarcode(null);
    }
  }, [visible]);

  const handlePickPhoto = async () => {
    const uri = await pickImage([1, 1]);
    if (uri) setLocalPhotoUri(uri);
  };

  const handleBarcodeScanned = async (code: string) => {
    setScannerVisible(false);
    setBarcode(code);
    setLookupLoading(true);
    try {
      const result = await lookupBarcode(code);
      if (result?.title) setName(result.title);
      if (result?.imageUrl) setLocalPhotoUri(result.imageUrl);
      // The barcode itself is always kept (set above) even on a miss — the
      // free product database has thin coverage outside US retail, so a
      // miss is expected, not an error. Without this the user just saw
      // nothing happen and the Save button stay disabled (empty name),
      // which read as "the app is broken" rather than "type it yourself".
      if (!result?.title) Alert.alert(t('inventory.objet.scan_not_found'));
    } finally {
      setLookupLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim() || !session) return;

    let objetId: string;
    try {
      const objet = await createObjet.mutateAsync({
        name: name.trim(),
        description: description.trim() || null,
        photoUrl: null,
        barcode,
      });
      objetId = objet.id;
    } catch {
      // Nothing was saved — this is a real, blocking failure.
      Alert.alert(t('common.error_generic'));
      return;
    }

    // The object already exists at this point. A photo-upload failure here
    // (e.g. the scanned product's external image URL is unreachable) must
    // not be reported as a total failure — that previously made a real save
    // look like "rien n'est enregistré" when only the photo was missing.
    if (localPhotoUri) {
      try {
        const photoUrl = await uploadImage(localPhotoUri, {
          bucket: 'objets',
          path: `${session.user.id}/${objetId}.jpg`,
        });
        const { error } = await supabase.from('objets').update({ photo_url: photoUrl }).eq('id', objetId);
        if (error) throw error;
      } catch {
        Alert.alert(t('inventory.objet.saved_without_photo'));
      }
    }

    queryClient.invalidateQueries({ queryKey: ['containerContents'] });
    onClose();
  };

  return (
    <>
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <View className="rounded-t-3xl bg-white px-6 pb-10 pt-6">
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text className="mb-4 text-xl font-bold text-ink">{t('inventory.container.create_objet_title')}</Text>

            <Pressable onPress={handlePickPhoto} className="mb-4 h-32 w-32 items-center justify-center self-center overflow-hidden rounded-xl bg-sand-dark">
              {lookupLoading ? (
                <ActivityIndicator />
              ) : localPhotoUri ? (
                <Image source={{ uri: localPhotoUri }} style={{ width: 128, height: 128 }} />
              ) : (
                <Text className="px-2 text-center text-sm text-ink-soft">{t('inventory.objet.add_photo')}</Text>
              )}
            </Pressable>

            <View className="mb-4">
              <Button label={t('inventory.objet.scan_barcode')} variant="ghost" onPress={() => setScannerVisible(true)} />
            </View>

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
    <BarcodeScanner visible={scannerVisible} onClose={() => setScannerVisible(false)} onScanned={handleBarcodeScanned} />
    </>
  );
}
