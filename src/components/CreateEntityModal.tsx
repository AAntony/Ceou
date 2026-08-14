import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Modal, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from './Button';
import { TextField } from './TextField';

type CreateEntityModalProps = {
  visible: boolean;
  title: string;
  nameLabel: string;
  submitLabel: string;
  cancelLabel: string;
  // Contrôlé par l'appelant (plutôt qu'un `initialName` + état interne) :
  // nécessaire pour que sélectionner une catégorie dans `children` puisse
  // préremplir ce champ (voir les écrans appelants) — l'utilisateur reste
  // libre de le modifier ensuite.
  name: string;
  onNameChange: (name: string) => void;
  onClose: () => void;
  onSubmit: (name: string) => void | Promise<void>;
  loading?: boolean;
  children?: ReactNode;
};

// `children` (le choix de catégorie, quand il y en a un) précède le champ
// Nom : le préremplissage catégorie -> nom n'a de sens que dans cet ordre.
export function CreateEntityModal({
  visible,
  title,
  nameLabel,
  submitLabel,
  cancelLabel,
  name,
  onNameChange,
  onClose,
  onSubmit,
  loading,
  children,
}: CreateEntityModalProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const handleSubmit = async () => {
    if (!name.trim()) return;
    try {
      await onSubmit(name.trim());
    } catch {
      Alert.alert(t('common.error_generic'));
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <View className="rounded-t-3xl bg-white px-6 pt-6" style={{ paddingBottom: insets.bottom + 24 }}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text className="mb-4 text-xl font-bold text-ink">{title}</Text>
            {children}
            <TextField label={nameLabel} value={name} onChangeText={onNameChange} autoFocus={!children} />
            <View className="mt-2 flex-row gap-3">
              <View className="flex-1">
                <Button label={cancelLabel} variant="ghost" onPress={onClose} />
              </View>
              <View className="flex-1">
                <Button label={submitLabel} onPress={handleSubmit} loading={loading} disabled={!name.trim()} />
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
