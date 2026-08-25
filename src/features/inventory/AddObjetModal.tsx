import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { logClientError } from '../../lib/errorLogging';
import { uploadImage } from '../../lib/images/pickAndUploadImage';
import type { LocationType } from '../../types/database';
import { useSession } from '../auth/SessionProvider';
import { AiPhotoScanFlow, type CollectedScanItem } from './AiPhotoScanFlow';
import { LocationTreePicker } from './LocationTreePicker';
import { ObjetFormBody, type CollectedObjet } from './ObjetFormBody';
import { useCreateObjet, useCreateObjetsBulk, useSetObjetPhoto } from './queries';
import { useScaled } from '../../lib/textScale';
import { useThemeColors } from '../../lib/theme';

type AddObjetModalProps = {
  visible: boolean;
  onClose: () => void;
};

// L'utilisateur commence par CE QU'IL AJOUTE (formulaire manuel ou scan
// photo), et choisit l'emplacement de destination en dernier — la
// destination n'a de sens à choisir qu'une fois qu'on sait ce qu'on range
// (retour direct de l'utilisateur : demander l'emplacement AVANT de savoir
// ce qu'on ajoute est contre-intuitif). ObjetFormBody/AiPhotoScanFlow
// tournent donc en mode "collecte" ici (prop `onCollected`, pas de création
// immédiate) ; la création réelle n'a lieu qu'à `handleChooseDestination`,
// une fois la destination connue.
type Step = 'choice' | 'manual' | 'scan' | 'destination';

export function AddObjetModal({ visible, onClose }: AddObjetModalProps) {
  const colors = useThemeColors();
  const spacerWidth = useScaled(22);
  const { t } = useTranslation();
  const { session } = useSession();
  const createObjet = useCreateObjet();
  const createObjetsBulk = useCreateObjetsBulk();
  const setObjetPhoto = useSetObjetPhoto();
  const [step, setStep] = useState<Step>('choice');
  const [pendingManual, setPendingManual] = useState<CollectedObjet | null>(null);
  const [pendingScan, setPendingScan] = useState<CollectedScanItem[] | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setStep('choice');
      setPendingManual(null);
      setPendingScan(null);
      setSaving(false);
    }
  }, [visible]);

  const handleBack = () => {
    if (step === 'destination') {
      setStep(pendingManual ? 'manual' : 'scan');
      return;
    }
    setStep('choice');
  };

  const handleChooseDestination = async (type: LocationType, id: string) => {
    if (!session) return;
    setSaving(true);
    try {
      if (pendingManual) {
        const objet = await createObjet.mutateAsync({
          parentType: type,
          parentId: id,
          name: pendingManual.name,
          description: pendingManual.description,
          photoUrl: null,
          barcode: pendingManual.barcode,
        });
        if (pendingManual.localPhotoUri) {
          try {
            const photoUrl = await uploadImage(pendingManual.localPhotoUri, {
              bucket: 'objets',
              path: `${session.user.id}/${objet.id}.jpg`,
            });
            await setObjetPhoto.mutateAsync({ objetId: objet.id, photoUrl });
          } catch (err) {
            logClientError(err, { source: 'add_objet_modal', step: 'photo_upload', objetId: objet.id });
            Alert.alert(t('inventory.objet.saved_without_photo'));
          }
        }
      } else if (pendingScan) {
        const result = await createObjetsBulk.mutateAsync({ parentType: type, parentId: id, items: pendingScan });
        if (result.photoFailures > 0) {
          Alert.alert(t('inventory.aiScan.saved_with_photo_failures', { count: result.photoFailures }));
        }
      }
      onClose();
    } catch (err) {
      logClientError(err, { source: 'add_objet_modal', step: 'save', mode: pendingScan ? 'scan' : 'manual' });
      Alert.alert(t('common.error_generic'));
    } finally {
      setSaving(false);
    }
  };

  const title =
    step === 'choice'
      ? t('inventory.aiScan.mode_choice_title')
      : step === 'manual'
        ? t('inventory.container.create_objet_title')
        : step === 'scan'
          ? t('inventory.aiScan.title')
          : t('home.choose_location');

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-sand pt-16">
        <View className="mb-2 flex-row items-center justify-between px-6">
          {step !== 'choice' ? (
            <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={handleBack} hitSlop={8}>
              <Icon name="back" size={22} color={colors.ink} />
            </Pressable>
          ) : (
            // Espaceur de la largeur de l'icone qu'il remplace, pour que le
            // titre reste centre. Mis a l'echelle comme elle.
            <View style={{ width: spacerWidth }} />
          )}
          {/* Deux lignes : « Comment veux-tu ajouter un objet ? » ne tient
              pas sur une, et un titre coupe ne pose plus de question. */}
          <Text numberOfLines={2} className="flex-1 px-2 text-center text-subheading font-bold text-ink">
            {title}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={onClose} hitSlop={8}>
            <Icon name="close" size={22} color={colors.ink} />
          </Pressable>
        </View>

        <View style={{ flex: 1, display: step === 'choice' ? 'flex' : 'none' }}>
          <ModeChoiceStep onChooseManual={() => setStep('manual')} onChooseScan={() => setStep('scan')} />
        </View>

        <View style={{ flex: 1, display: step === 'manual' ? 'flex' : 'none' }}>
          <ObjetFormBody
            active={visible}
            onCancel={onClose}
            onDone={onClose}
            onCollected={(data) => {
              setPendingManual(data);
              setStep('destination');
            }}
          />
        </View>

        <View style={{ flex: 1, display: step === 'scan' ? 'flex' : 'none' }}>
          <AiPhotoScanFlow
            active={visible && step === 'scan'}
            onCancel={onClose}
            onDone={onClose}
            onCollected={(items) => {
              setPendingScan(items);
              setStep('destination');
            }}
          />
        </View>

        <View style={{ flex: 1, display: step === 'destination' ? 'flex' : 'none' }}>
          <ScrollView contentContainerClassName="px-6 pb-10 pt-2">
            <LocationTreePicker
              active={visible && step === 'destination'}
              confirmLabel={t('home.choose_location_here')}
              loading={saving}
              onChoose={handleChooseDestination}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function ModeChoiceStep({ onChooseManual, onChooseScan }: { onChooseManual: () => void; onChooseScan: () => void }) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  // DEFILANT, et centre seulement s'il reste de la place (`grow` +
  // `justify-center`). Les deux cartes grandissent avec le reglage de
  // taille : sur un ecran court et en tres grand texte, un simple View
  // centre aurait pousse la seconde hors de l'ecran, sans moyen de
  // l'atteindre.
  return (
    <ScrollView contentContainerClassName="grow justify-center gap-4 px-6 pb-16 pt-4">
      <Pressable
        accessibilityRole="button"
        onPress={onChooseScan}
        className="items-center gap-2 rounded-2xl border-2 border-coral bg-coral-light px-6 py-6 active:opacity-70"
      >
        <Icon name="scan" size={32} color={colors.accentDark} />
        {/* Le titre de chacune des deux seules options de l'ecran : c'est le
            texte qu'on lit en premier, il porte donc un role de titre. */}
        <Text className="text-center text-subheading font-bold text-coral-dark">{t('inventory.aiScan.entry_title')}</Text>
        <Text className="text-center text-label text-coral-dark/80">{t('inventory.aiScan.entry_hint')}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={onChooseManual}
        className="items-center gap-2 rounded-2xl border border-ink/10 bg-sand-dark px-6 py-6 active:opacity-70"
      >
        <Icon name="objet" size={32} color={colors.ink} />
        {/* « Manuellement » et non « Ajouter un objet » : les deux options
            ajoutent un objet, ce n'est donc pas ce qui les distingue. Ce qui
            les distingue, c'est QUI fait le travail — d'ou un sous-texte de
            part et d'autre, pour qu'on choisisse entre deux methodes
            decrites plutot qu'entre une methode et un intitule d'ecran. */}
        <Text className="text-center text-subheading font-bold text-ink">
          {t('inventory.aiScan.manual_entry_title')}
        </Text>
        <Text className="text-center text-label text-ink-soft">{t('inventory.aiScan.manual_entry_hint')}</Text>
      </Pressable>
    </ScrollView>
  );
}
