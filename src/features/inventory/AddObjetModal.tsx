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
// ranger l'objet (même arborescence que MoveObjetModal), puis le formulaire
// habituel une fois la destination connue.
export function AddObjetModal({ visible, onClose }: AddObjetModalProps) {
  const { t } = useTranslation();
  const [destination, setDestination] = useState<Destination | null>(null);

  useEffect(() => {
    if (visible) setDestination(null);
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-sand pt-16">
        <View className="mb-2 flex-row items-center justify-between px-6">
          {destination ? (
            <Pressable onPress={() => setDestination(null)} hitSlop={8}>
              <Icon name="back" size={22} color="#2D2A26" />
            </Pressable>
          ) : (
            <View style={{ width: 22 }} />
          )}
          <Text className="text-lg font-bold text-ink">
            {destination ? t('inventory.container.create_objet_title') : t('home.choose_location')}
          </Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Icon name="close" size={22} color="#2D2A26" />
          </Pressable>
        </View>

        {destination ? (
          <ObjetFormBody parentType={destination.type} parentId={destination.id} active onDone={onClose} onCancel={onClose} />
        ) : (
          <ScrollView contentContainerClassName="px-6 pb-10 pt-2">
            <LocationTreePicker
              active={visible}
              confirmLabel={t('home.choose_location_here')}
              onChoose={(type, id) => setDestination({ type, id })}
            />
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}
