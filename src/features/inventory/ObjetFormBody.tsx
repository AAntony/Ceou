import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { lookupBarcode } from '../../lib/barcode/lookupBarcode';
import { pickImage, uploadImage } from '../../lib/images/pickAndUploadImage';
import { supabase } from '../../lib/supabase/client';
import type { LocationType } from '../../types/database';
import { useSession } from '../auth/SessionProvider';
import { BarcodeScanner } from './BarcodeScanner';
import { useCreateObjet } from './queries';

export type CollectedObjet = { name: string; description: string | null; localPhotoUri: string | null; barcode: string | null };

type ObjetFormBodyProps = {
  // Absents quand `onCollected` est fourni (AddObjetModal, mode "objet
  // d'abord, emplacement ensuite") — la destination n'est alors pas encore
  // connue. Présents pour un usage "destination déjà connue" (CreateObjetModal).
  parentType?: LocationType;
  parentId?: string;
  // Remonte le formulaire à zéro à chaque fois que cette valeur passe à
  // true — nécessaire quand le composant reste monté d'une ouverture de
  // modale à l'autre (CreateObjetModal), inoffensif sinon (AddObjetModal le
  // monte déjà à l'état neuf).
  active: boolean;
  onDone: () => void;
  onCancel: () => void;
  // Quand fourni, le bouton principal devient "Suivant" et remonte les
  // données saisies au lieu de créer l'objet directement — c'est l'appelant
  // (AddObjetModal) qui crée l'objet une fois la destination choisie
  // ensuite. Absent => comportement historique (crée immédiatement).
  onCollected?: (data: CollectedObjet) => void;
};

// Corps de formulaire partagé entre CreateObjetModal (parent déjà connu,
// feuille du bas) et AddObjetModal (parent choisi APRÈS ce formulaire via
// onCollected) — même logique photo/scan/validation dans les deux cas.
export function ObjetFormBody({ parentType, parentId, active, onDone, onCancel, onCollected }: ObjetFormBodyProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const queryClient = useQueryClient();
  const createObjet = useCreateObjet();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [localPhotoUri, setLocalPhotoUri] = useState<string | null>(null);
  const [barcode, setBarcode] = useState<string | null>(null);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);

  useEffect(() => {
    if (active) {
      setName('');
      setDescription('');
      setLocalPhotoUri(null);
      setBarcode(null);
    }
  }, [active]);

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
      if (!result?.title) Alert.alert(t('inventory.objet.scan_not_found'));
    } finally {
      setLookupLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;

    if (onCollected) {
      onCollected({ name: name.trim(), description: description.trim() || null, localPhotoUri, barcode });
      return;
    }

    if (!session || !parentType || !parentId) return;

    let objetId: string;
    try {
      const objet = await createObjet.mutateAsync({
        parentType,
        parentId,
        name: name.trim(),
        description: description.trim() || null,
        photoUrl: null,
        barcode,
      });
      objetId = objet.id;
    } catch {
      Alert.alert(t('common.error_generic'));
      return;
    }

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
    onDone();
  };

  return (
    <>
      <ScrollView
        contentContainerClassName="px-6 pt-2"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
      >
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
            <Button label={t('common.cancel')} variant="ghost" onPress={onCancel} />
          </View>
          <View className="flex-1">
            <Button
              label={t(onCollected ? 'common.next' : 'common.save')}
              onPress={handleSubmit}
              loading={createObjet.isPending}
              disabled={!name.trim()}
            />
          </View>
        </View>
      </ScrollView>
      <BarcodeScanner visible={scannerVisible} onClose={() => setScannerVisible(false)} onScanned={handleBarcodeScanned} />
    </>
  );
}
