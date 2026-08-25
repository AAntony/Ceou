import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetModal } from '../../components/BottomSheetModal';
import { Button } from '../../components/Button';
import { FormActions } from '../../components/FormActions';
import { Icon } from '../../components/Icon';
import { TextLink } from '../../components/TextLink';
import { cropDetection, detectObjects, getImageSize, RateLimitedError } from '../../lib/ai/detectObjects';
import { logClientError } from '../../lib/errorLogging';
import { pickImage, takePhoto } from '../../lib/images/pickAndUploadImage';
import type { LocationType } from '../../types/database';
import { useProfile, useSetAiPhotoConsent } from '../profile/useProfile';
import { useCreateObjetsBulk } from './queries';
import { useScaled } from '../../lib/textScale';
import { useThemeColors } from '../../lib/theme';

export type CollectedScanItem = { name: string; localPhotoUri: string };

type AiPhotoScanFlowProps = {
  // Absents quand `onCollected` est fourni (AddObjetModal, mode "objets
  // d'abord, emplacement ensuite"). Présents pour un usage "destination déjà
  // connue" (CreateObjetModal) — même contrat que ObjetFormBody.
  parentType?: LocationType;
  parentId?: string;
  // Même contrat que ObjetFormBody : remonte le flux à zéro quand cette
  // valeur passe à true, pour rester montable d'une ouverture de modale à
  // l'autre sans fuiter l'état de la précédente.
  active: boolean;
  onDone: () => void;
  onCancel: () => void;
  // Quand fourni, le bouton de confirmation devient "Suivant" et remonte la
  // liste retenue au lieu de créer les objets directement — c'est l'appelant
  // (AddObjetModal) qui les crée une fois la destination choisie ensuite.
  onCollected?: (items: CollectedScanItem[]) => void;
};

type ReviewItem = { key: string; label: string; thumbUri: string; selected: boolean };
type Step = 'capture' | 'analyzing' | 'review';

// Photographier une étagère/un tiroir entier et laisser l'IA (Gemini, via
// l'Edge Function detect-objects) proposer un objet par élément détecté,
// plutôt que de les saisir un par un — voir la discussion Lead Dev qui a
// motivé cette fonctionnalité. Même props shape que ObjetFormBody
// (parentType/parentId/active/onDone/onCancel) : les deux sont interchangeables
// dans CreateObjetModal/AddObjetModal selon le mode choisi par l'utilisateur.
export function AiPhotoScanFlow({ parentType, parentId, active, onDone, onCancel, onCollected }: AiPhotoScanFlowProps) {
  const colors = useThemeColors();
  // La vignette d'un objet detecte : elle sert a reconnaitre ce que l'IA a
  // decoupe, donc elle doit grandir avec le nom qu'on relit a cote.
  const thumbSize = useScaled(56);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const createObjetsBulk = useCreateObjetsBulk();
  const { data: profile } = useProfile();
  const setAiPhotoConsent = useSetAiPhotoConsent();
  const [step, setStep] = useState<Step>('capture');
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [pendingSource, setPendingSource] = useState<'camera' | 'library' | null>(null);

  useEffect(() => {
    if (active) {
      setStep('capture');
      setItems([]);
      setPendingSource(null);
    }
  }, [active]);

  const runDetection = async (uri: string) => {
    setStep('analyzing');
    try {
      const detections = await detectObjects(uri);
      if (detections.length === 0) {
        Alert.alert(t('inventory.aiScan.no_detections'));
        setStep('capture');
        return;
      }
      // Découpage depuis la photo ORIGINALE (voir cropDetection) : les
      // vignettes gardent la pleine résolution source, indépendamment de la
      // copie réduite envoyée à Gemini pour la détection.
      const originalSize = await getImageSize(uri);
      const crops = await Promise.all(
        detections.map(async (d, index) => ({
          key: `${index}`,
          label: d.label,
          thumbUri: await cropDetection(uri, originalSize, d.box),
          selected: true,
        })),
      );
      setItems(crops);
      setStep('review');
    } catch (err) {
      // Le throttling du quota Gemini partagé est un cas NORMAL, déjà
      // expliqué à l'utilisateur par son propre message — le journaliser
      // noierait les vraies pannes de détection sous du bruit attendu.
      if (!(err instanceof RateLimitedError)) {
        logClientError(err, { source: 'ai_photo_scan', step: 'detect' });
      }
      Alert.alert(
        err instanceof RateLimitedError
          ? t('inventory.aiScan.rate_limited', { seconds: err.retryAfterSeconds })
          : t('common.error_generic'),
      );
      setStep('capture');
    }
  };

  const startCapture = async (source: 'camera' | 'library') => {
    const uri = source === 'camera' ? await takePhoto(undefined, false) : await pickImage(undefined, false);
    if (uri) runDetection(uri);
  };

  // Gate le tout premier scan derrière un consentement explicite (photos
  // envoyées à Google Gemini, tiers hors UE — voir la politique de
  // confidentialité) avant même de déclencher la prise/le choix de photo.
  // `pendingSource` mémorise CE que l'utilisateur voulait faire pour
  // l'enchaîner automatiquement une fois le consentement accordé.
  const requestCapture = (source: 'camera' | 'library') => {
    if (profile?.ai_photo_consent_at) {
      startCapture(source);
      return;
    }
    setPendingSource(source);
  };

  const handleTakePhoto = () => requestCapture('camera');
  const handlePickPhoto = () => requestCapture('library');

  const handleConsentAccept = async () => {
    const source = pendingSource;
    setPendingSource(null);
    try {
      await setAiPhotoConsent.mutateAsync();
    } catch (err) {
      logClientError(err, { source: 'ai_photo_scan', step: 'consent' });
      Alert.alert(t('common.error_generic'));
      return;
    }
    if (source) startCapture(source);
  };

  const handleConsentCancel = () => setPendingSource(null);

  const toggleSelected = (key: string) =>
    setItems((current) => current.map((i) => (i.key === key ? { ...i, selected: !i.selected } : i)));
  const updateLabel = (key: string, label: string) =>
    setItems((current) => current.map((i) => (i.key === key ? { ...i, label } : i)));

  const selectedCount = items.filter((i) => i.selected && i.label.trim()).length;

  const handleConfirm = async () => {
    const toCreate = items.filter((i) => i.selected && i.label.trim());
    if (toCreate.length === 0) return;
    const collected = toCreate.map((i) => ({ name: i.label.trim(), localPhotoUri: i.thumbUri }));

    if (onCollected) {
      onCollected(collected);
      return;
    }

    if (!parentType || !parentId) return;
    try {
      const result = await createObjetsBulk.mutateAsync({ parentType, parentId, items: collected });
      if (result.photoFailures > 0) {
        Alert.alert(t('inventory.aiScan.saved_with_photo_failures', { count: result.photoFailures }));
      }
    } catch (err) {
      logClientError(err, { source: 'ai_photo_scan', step: 'bulk_create', count: collected.length });
      Alert.alert(t('common.error_generic'));
      return;
    }
    onDone();
  };

  if (step === 'capture') {
    return (
      <View className="flex-1 items-center justify-center px-6" style={{ paddingBottom: insets.bottom + 24 }}>
        <Icon name="scan" size={48} color={colors.accentDark} />
        <Text className="mb-1 mt-4 text-center text-subheading font-bold text-ink">{t('inventory.aiScan.capture_title')}</Text>
        <Text className="mb-6 text-center text-label text-ink-soft">{t('inventory.aiScan.capture_hint')}</Text>
        <View className="w-full gap-3">
          <Button label={t('inventory.aiScan.take_photo')} onPress={handleTakePhoto} />
          <Button label={t('inventory.aiScan.pick_photo')} variant="ghost" onPress={handlePickPhoto} />
          <Button label={t('common.cancel')} variant="ghost" onPress={onCancel} />
        </View>

        <BottomSheetModal
          visible={pendingSource !== null}
          onClose={handleConsentCancel}
          sheetClassName="rounded-t-3xl bg-surface px-6 pb-8 pt-6"
          scrollable
        >
          <Text className="mb-3 text-subheading font-bold text-ink">{t('inventory.aiScan.consent_title')}</Text>
          <Text className="mb-4 text-label leading-5 text-ink-soft">{t('inventory.aiScan.consent_body')}</Text>
          <TextLink
            href="/privacy-policy"
            label={t('profile.privacy_policy')}
            className="mb-6 self-start"
            textClassName="text-label font-semibold text-coral-dark underline"
          />
          <FormActions
            cancelLabel={t('common.cancel')}
            onCancel={handleConsentCancel}
            confirmLabel={t('inventory.aiScan.consent_accept')}
            onConfirm={handleConsentAccept}
            loading={setAiPhotoConsent.isPending}
          />
        </BottomSheetModal>
      </View>
    );
  }

  if (step === 'analyzing') {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <ActivityIndicator size="large" color={colors.accentDark} />
        <Text className="mt-4 text-center text-label text-ink-soft">{t('inventory.aiScan.analyzing')}</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerClassName="px-6 pt-2" contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        <Text className="mb-4 text-label text-ink-soft">{t('inventory.aiScan.review_hint')}</Text>
        {items.map((item) => (
          <View key={item.key} className={`mb-3 flex-row items-center gap-3 rounded-xl bg-sand-dark p-2 ${item.selected ? '' : 'opacity-40'}`}>
            <Image source={{ uri: item.thumbUri }} style={{ width: thumbSize, height: thumbSize, borderRadius: 10 }} />
            <TextInput
              value={item.label}
              onChangeText={(text) => updateLabel(item.key, text)}
              editable={item.selected}
              // `min-w-0` : voir TextField, meme raison cote web.
              className="min-w-0 flex-1 rounded-xl border border-ink/10 bg-surface px-3 py-2.5 text-body text-ink"
            />
            {/* Coche verte contre croix grise : la couleur seule
                distinguait « je garde » de « j'écarte ». Le libellé nomme
                l'objet, l'état dit lequel des deux est en cours. */}
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: item.selected }}
              accessibilityLabel={t('a11y.select_named', { name: item.label })}
              onPress={() => toggleSelected(item.key)}
              hitSlop={8}
            >
              <Icon name={item.selected ? 'included' : 'excluded'} size={26} color={item.selected ? '#4CAF50' : colors.inkFaint} />
            </Pressable>
          </View>
        ))}
      </ScrollView>
      <View
        className="absolute bottom-0 left-0 right-0 border-t border-ink/10 bg-surface px-6 pt-3"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        <FormActions
          cancelLabel={t('common.cancel')}
          onCancel={onCancel}
          confirmLabel={t(onCollected ? 'inventory.aiScan.next' : 'inventory.aiScan.confirm', { count: selectedCount })}
          onConfirm={handleConfirm}
          loading={createObjetsBulk.isPending}
          disabled={selectedCount === 0}
        />
      </View>
    </View>
  );
}
