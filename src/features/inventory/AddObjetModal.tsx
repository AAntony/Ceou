import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import type { LocationType } from '../../types/database';
import { LocationTreePicker } from './LocationTreePicker';
import { ObjetFormBody } from './ObjetFormBody';

type AddObjetModalProps = {
  visible: boolean;
  onClose: () => void;
};

type Destination = { type: LocationType; id: string };

// Point d'entrée global du "+" de la barre d'onglets : choisir d'abord où
// ranger l'objet (même arborescence que MoveObjetModal, avec création à la
// volée à chaque niveau — voir LocationTreePicker), puis le formulaire
// habituel une fois la destination connue.
export function AddObjetModal({ visible, onClose }: AddObjetModalProps) {
  const { t } = useTranslation();
  const [destination, setDestination] = useState<Destination | null>(null);
  // Séparé de `destination` : le bouton retour repasse par le sélecteur pour
  // changer de destination SANS démonter ObjetFormBody, donc sans perdre le
  // nom/la photo déjà saisis. Seule la fermeture de la modale (visible ->
  // false -> true) doit vraiment repartir de zéro.
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (visible) {
      setDestination(null);
      setShowForm(false);
    }
  }, [visible]);

  const handleChoose = (type: LocationType, id: string) => {
    setDestination({ type, id });
    setShowForm(true);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-sand pt-16">
        <View className="mb-2 flex-row items-center justify-between px-6">
          {showForm ? (
            <Pressable onPress={() => setShowForm(false)} hitSlop={8}>
              <Icon name="back" size={22} color="#2D2A26" />
            </Pressable>
          ) : (
            <View style={{ width: 22 }} />
          )}
          <Text className="text-lg font-bold text-ink">
            {showForm ? t('inventory.container.create_objet_title') : t('home.choose_location')}
          </Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Icon name="close" size={22} color="#2D2A26" />
          </Pressable>
        </View>

        <View style={{ flex: 1, display: showForm ? 'none' : 'flex' }}>
          <ScrollView contentContainerClassName="px-6 pb-10 pt-2">
            <LocationTreePicker active={visible} confirmLabel={t('home.choose_location_here')} onChoose={handleChoose} />
          </ScrollView>
        </View>

        {destination ? (
          <View style={{ flex: 1, display: showForm ? 'flex' : 'none' }}>
            <ObjetFormBody parentType={destination.type} parentId={destination.id} active={false} onDone={onClose} onCancel={onClose} />
          </View>
        ) : null}
      </View>
    </Modal>
  );
}
