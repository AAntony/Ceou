import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { cropDetection, detectObjects, preparePhotoForDetection, type PreparedPhoto } from '../../lib/ai/detectObjects';
import { pickImage, takePhoto } from '../../lib/images/pickAndUploadImage';
import type { LocationType } from '../../types/database';
import { useCreateObjetsBulk } from './queries';

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
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const createObjetsBulk = useCreateObjetsBulk();
  const [step, setStep] = useState<Step>('capture');
  const [items, setItems] = useState<ReviewItem[]>([]);

  useEffect(() => {
    if (active) {
      setStep('capture');
      setItems([]);
    }
  }, [active]);

  const runDetection = async (uri: string) => {
    setStep('analyzing');
    try {
      const prepared: PreparedPhoto = await preparePhotoForDetection(uri);
      const detections = await detectObjects(prepared);
      if (detections.length === 0) {
        Alert.alert(t('inventory.aiScan.no_detections'));
        setStep('capture');
        return;
      }
      const crops = await Promise.all(
        detections.map(async (d, index) => ({
          key: `${index}`,
          label: d.label,
          thumbUri: await cropDetection(prepared, d.box),
          selected: true,
        })),
      );
      setItems(crops);
      setStep('review');
    } catch {
      Alert.alert(t('common.error_generic'));
      setStep('capture');
    }
  };

  const handleTakePhoto = async () => {
    const uri = await takePhoto(undefined, false);
    if (uri) runDetection(uri);
  };

  const handlePickPhoto = async () => {
    const uri = await pickImage(undefined, false);
    if (uri) runDetection(uri);
  };

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
    } catch {
      Alert.alert(t('common.error_generic'));
      return;
    }
    onDone();
  };

  if (step === 'capture') {
    return (
      <View className="flex-1 items-center justify-center px-6" style={{ paddingBottom: insets.bottom + 24 }}>
        <Icon name="scan" size={48} color="#E2543A" />
        <Text className="mb-1 mt-4 text-center text-lg font-bold text-ink">{t('inventory.aiScan.capture_title')}</Text>
        <Text className="mb-6 text-center text-sm text-ink-soft">{t('inventory.aiScan.capture_hint')}</Text>
        <View className="w-full gap-3">
          <Button label={t('inventory.aiScan.take_photo')} onPress={handleTakePhoto} />
          <Button label={t('inventory.aiScan.pick_photo')} variant="ghost" onPress={handlePickPhoto} />
          <Button label={t('common.cancel')} variant="ghost" onPress={onCancel} />
        </View>
      </View>
    );
  }

  if (step === 'analyzing') {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <ActivityIndicator size="large" color="#E2543A" />
        <Text className="mt-4 text-center text-sm text-ink-soft">{t('inventory.aiScan.analyzing')}</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerClassName="px-6 pt-2" contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        <Text className="mb-4 text-sm text-ink-soft">{t('inventory.aiScan.review_hint')}</Text>
        {items.map((item) => (
          <View key={item.key} className={`mb-3 flex-row items-center gap-3 rounded-xl bg-sand-dark p-2 ${item.selected ? '' : 'opacity-40'}`}>
            <Image source={{ uri: item.thumbUri }} style={{ width: 56, height: 56, borderRadius: 10 }} />
            <TextInput
              value={item.label}
              onChangeText={(text) => updateLabel(item.key, text)}
              editable={item.selected}
              className="flex-1 rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-base text-ink"
            />
            <Pressable onPress={() => toggleSelected(item.key)} hitSlop={8}>
              <Icon name={item.selected ? 'included' : 'excluded'} size={26} color={item.selected ? '#4CAF50' : '#A39C8F'} />
            </Pressable>
          </View>
        ))}
      </ScrollView>
      <View
        className="absolute bottom-0 left-0 right-0 flex-row gap-3 border-t border-ink/10 bg-white px-6 pt-3"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        <View className="flex-1">
          <Button label={t('common.cancel')} variant="ghost" onPress={onCancel} />
        </View>
        <View className="flex-1">
          <Button
            label={t(onCollected ? 'inventory.aiScan.next' : 'inventory.aiScan.confirm', { count: selectedCount })}
            onPress={handleConfirm}
            loading={createObjetsBulk.isPending}
            disabled={selectedCount === 0}
          />
        </View>
      </View>
    </View>
  );
}
