import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, Text, View } from 'react-native';
import { logClientError } from '../lib/errorLogging';
import { BottomSheetModal } from './BottomSheetModal';
import { FormActions } from './FormActions';
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

  const handleSubmit = async () => {
    if (!name.trim()) return;
    try {
      await onSubmit(name.trim());
    } catch (err) {
      logClientError(err, { source: 'create_entity_modal', title });
      Alert.alert(t('common.error_generic'));
    }
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      sheetClassName="rounded-t-3xl bg-surface px-6 pb-6 pt-6"
    >
      <ScrollView keyboardShouldPersistTaps="handled">
        <Text className="mb-4 text-heading font-bold text-ink">{title}</Text>
        {children}
        <TextField label={nameLabel} value={name} onChangeText={onNameChange} autoFocus={!children} />
        <View className="mt-2">
          <FormActions
            cancelLabel={cancelLabel}
            onCancel={onClose}
            confirmLabel={submitLabel}
            onConfirm={handleSubmit}
            loading={loading}
            disabled={!name.trim()}
          />
        </View>
      </ScrollView>
    </BottomSheetModal>
  );
}
