import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import type { LocationType } from '../../types/database';
import { AiPhotoScanFlow } from './AiPhotoScanFlow';
import { LocationTreePicker } from './LocationTreePicker';
import { ObjetFormBody } from './ObjetFormBody';

type AddObjetModalProps = {
  visible: boolean;
  onClose: () => void;
};

type Destination = { type: LocationType; id: string };
type Mode = 'choice' | 'manual' | 'scan';

// Point d'entrée global du "+" de la barre d'onglets : choisir d'abord où
// ranger l'objet (même arborescence que MoveObjetModal, avec création à la
// volée à chaque niveau — voir LocationTreePicker), puis CHOISIR la façon
// d'ajouter (formulaire manuel ou scan photo IA — voir AiPhotoScanFlow),
// avant d'atteindre le formulaire/flux choisi.
export function AddObjetModal({ visible, onClose }: AddObjetModalProps) {
  const { t } = useTranslation();
  const [destination, setDestination] = useState<Destination | null>(null);
  // Séparé de `destination` : le bouton retour repasse par l'étape
  // précédente (choix du mode, puis sélecteur de destination) SANS démonter
  // ObjetFormBody/AiPhotoScanFlow, donc sans perdre leur état en cours. Seule
  // la fermeture de la modale (visible -> false -> true) repart de zéro.
  const [mode, setMode] = useState<Mode>('choice');

  useEffect(() => {
    if (visible) {
      setDestination(null);
      setMode('choice');
    }
  }, [visible]);

  const handleChoose = (type: LocationType, id: string) => {
    setDestination({ type, id });
    setMode('choice');
  };

  const handleBack = () => {
    if (destination && mode !== 'choice') {
      setMode('choice');
      return;
    }
    setDestination(null);
  };

  const title = !destination
    ? t('home.choose_location')
    : mode === 'choice'
      ? t('inventory.aiScan.mode_choice_title')
      : mode === 'scan'
        ? t('inventory.aiScan.title')
        : t('inventory.container.create_objet_title');

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-sand pt-16">
        <View className="mb-2 flex-row items-center justify-between px-6">
          {destination ? (
            <Pressable onPress={handleBack} hitSlop={8}>
              <Icon name="back" size={22} color="#2D2A26" />
            </Pressable>
          ) : (
            <View style={{ width: 22 }} />
          )}
          <Text className="text-lg font-bold text-ink">{title}</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Icon name="close" size={22} color="#2D2A26" />
          </Pressable>
        </View>

        <View style={{ flex: 1, display: !destination ? 'flex' : 'none' }}>
          <ScrollView contentContainerClassName="px-6 pb-10 pt-2">
            <LocationTreePicker active={visible} confirmLabel={t('home.choose_location_here')} onChoose={handleChoose} />
          </ScrollView>
        </View>

        {destination ? (
          <>
            <View style={{ flex: 1, display: mode === 'choice' ? 'flex' : 'none' }}>
              <ModeChoiceStep onChooseManual={() => setMode('manual')} onChooseScan={() => setMode('scan')} />
            </View>
            <View style={{ flex: 1, display: mode === 'manual' ? 'flex' : 'none' }}>
              <ObjetFormBody parentType={destination.type} parentId={destination.id} active={false} onDone={onClose} onCancel={onClose} />
            </View>
            <View style={{ flex: 1, display: mode === 'scan' ? 'flex' : 'none' }}>
              <AiPhotoScanFlow parentType={destination.type} parentId={destination.id} active={false} onDone={onClose} onCancel={onClose} />
            </View>
          </>
        ) : null}
      </View>
    </Modal>
  );
}

function ModeChoiceStep({ onChooseManual, onChooseScan }: { onChooseManual: () => void; onChooseScan: () => void }) {
  const { t } = useTranslation();
  return (
    <View className="flex-1 justify-center gap-4 px-6 pb-16">
      <Pressable
        onPress={onChooseScan}
        className="items-center gap-2 rounded-2xl border-2 border-coral bg-coral-light px-6 py-6 active:opacity-70"
      >
        <Icon name="scan" size={32} color="#E2543A" />
        <Text className="text-base font-bold text-coral-dark">{t('inventory.aiScan.entry_title')}</Text>
        <Text className="text-center text-sm text-coral-dark/80">{t('inventory.aiScan.entry_hint')}</Text>
      </Pressable>
      <Pressable
        onPress={onChooseManual}
        className="items-center gap-2 rounded-2xl border border-ink/10 bg-sand-dark px-6 py-6 active:opacity-70"
      >
        <Icon name="objet" size={32} color="#2D2A26" />
        <Text className="text-base font-bold text-ink">{t('inventory.container.add_objet')}</Text>
      </Pressable>
    </View>
  );
}
