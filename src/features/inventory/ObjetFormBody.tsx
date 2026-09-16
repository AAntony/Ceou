import { useRecentLocations } from './RecentLocations';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Button } from '../../components/Button';
import { FormActions } from '../../components/FormActions';
import { TextField } from '../../components/TextField';
import { lookupBarcode } from '../../lib/barcode/lookupBarcode';
import { logClientError } from '../../lib/errorLogging';
import { pickImage } from '../../lib/images/pickAndUploadImage';
import type { LocationType } from '../../types/database';
import { useSession } from '../auth/SessionProvider';
import { BarcodeScanner } from './BarcodeScanner';
import { useCreateObjet } from './queries';
import { showMessage } from '../../lib/dialog';

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
  const { session } = useSession();
  const createObjet = useCreateObjet();
  const { remember } = useRecentLocations();
  const nameInput = useRef<TextInput>(null);
  const submitting = useRef(false);
  const barcodeLookup = useRef<AbortController | null>(null);
  const [savedAnother, setSavedAnother] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [localPhotoUri, setLocalPhotoUri] = useState<string | null>(null);
  const [barcode, setBarcode] = useState<string | null>(null);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);

  useEffect(() => {
    if (active) {
      setSavedAnother(false);
      setName('');
      setDescription('');
      setLocalPhotoUri(null);
      setBarcode(null);
      setLookupLoading(false);
    }
    return () => barcodeLookup.current?.abort();
  }, [active]);

  const handlePickPhoto = async () => {
    const uri = await pickImage([1, 1]);
    if (uri) setLocalPhotoUri(uri);
  };

  const handleBarcodeScanned = async (code: string) => {
    barcodeLookup.current?.abort();
    const request = new AbortController();
    barcodeLookup.current = request;
    setScannerVisible(false);
    setBarcode(code);
    setLookupLoading(true);
    try {
      const result = await lookupBarcode(code, request.signal);
      if (request.signal.aborted) return;
      if (result?.title) setName(result.title);
      if (result?.imageUrl) setLocalPhotoUri(result.imageUrl);
      if (!result?.title) showMessage(t('inventory.objet.scan_not_found'));
    } finally {
      if (!request.signal.aborted) setLookupLoading(false);
    }
  };

  const handleSubmit = async (another = false) => {
    if (!name.trim() || submitting.current || lookupLoading) return;

    if (onCollected) {
      onCollected({ name: name.trim(), description: description.trim() || null, localPhotoUri, barcode });
      return;
    }

    if (!session || !parentType || !parentId) return;

    submitting.current = true;
    try {
      await createObjet.mutateAsync({
        parentType,
        parentId,
        name: name.trim(),
        description: description.trim() || null,
        // Le chemin LOCAL, pas une adresse : c'est la file qui enverra le
        // fichier, au retour du réseau s'il le faut. Voir useCreateObjet.
        photoUrl: localPhotoUri ?? null,
        barcode,
      });
    } catch (err) {
      logClientError(err, { source: 'objet_form', step: 'create', parentType });
      showMessage(t('common.error_generic'));
      return;
    } finally { submitting.current = false; }

    remember(parentType, parentId);
    if (another) {
      setName(''); setDescription(''); setLocalPhotoUri(null); setBarcode(null);
      setSavedAnother(true); nameInput.current?.focus();
    } else onDone();
  };

  return (
    <>
      {/* ScrollView NU (aucun style de hauteur ni de flex) : il doit se
          mesurer sur son contenu, aussi bien dans la feuille du bas de
          CreateObjetModal (parent sans hauteur définie) que dans le plein
          écran d'AddObjetModal. Cf. le commentaire de la branche manuelle
          dans CreateObjetModal avant d'y ajouter quoi que ce soit. */}
      <ScrollView contentContainerClassName="px-6 pb-6 pt-2" keyboardShouldPersistTaps="handled">
        <Pressable accessibilityRole="button" accessibilityLabel={t('a11y.change_photo')} onPress={handlePickPhoto} className="mb-4 h-32 w-32 items-center justify-center self-center overflow-hidden rounded-xl bg-sand-dark">
          {lookupLoading ? (
            <ActivityIndicator />
          ) : localPhotoUri ? (
            // La photo remplit son cadre plutot que d'imposer sa taille :
            // le cadre, lui, grandit avec le reglage de taille.
            <Image source={{ uri: localPhotoUri }} style={{ width: '100%', height: '100%' }} />
          ) : (
            <Text className="px-2 text-center text-label text-ink-soft">{t('inventory.objet.add_photo')}</Text>
          )}
        </Pressable>

        <View className="mb-4">
          <Button label={t('inventory.objet.scan_barcode')} variant="ghost" onPress={() => setScannerVisible(true)} />
        </View>

        <TextField ref={nameInput} label={t('inventory.objet.name_label')} value={name} onChangeText={(value) => { setName(value); setSavedAnother(false); }} autoFocus />
        <TextField
          label={t('inventory.objet.description_label')}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
        />

        <View className="mt-2">
          <FormActions
            cancelLabel={t('common.cancel')}
            onCancel={onCancel}
            confirmLabel={t(onCollected ? 'common.next' : 'common.save')}
            onConfirm={() => handleSubmit()}
            loading={createObjet.isPending}
            disabled={!name.trim() || lookupLoading}
          />
          {!onCollected ? <View className="mt-2"><Button variant="outline" label={t('redesign.addAnother')} onPress={() => handleSubmit(true)} disabled={!name.trim() || lookupLoading || createObjet.isPending} /></View> : null}
          {savedAnother ? <Text accessibilityLiveRegion="polite" className="mt-3 text-label text-coral-dark">{t('redesign.savedLocal')}</Text> : null}
        </View>
      </ScrollView>
      <BarcodeScanner visible={scannerVisible} onClose={() => setScannerVisible(false)} onScanned={handleBarcodeScanned} />
    </>
  );
}
