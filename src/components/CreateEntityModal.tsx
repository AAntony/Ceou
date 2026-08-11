import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Modal, ScrollView, Text, View } from 'react-native';
import { Button } from './Button';
import { TextField } from './TextField';

type CreateEntityModalProps = {
  visible: boolean;
  title: string;
  nameLabel: string;
  submitLabel: string;
  cancelLabel: string;
  initialName?: string;
  onClose: () => void;
  onSubmit: (name: string) => void | Promise<void>;
  loading?: boolean;
  children?: ReactNode;
};

export function CreateEntityModal({
  visible,
  title,
  nameLabel,
  submitLabel,
  cancelLabel,
  initialName,
  onClose,
  onSubmit,
  loading,
  children,
}: CreateEntityModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');

  useEffect(() => {
    if (visible) setName(initialName ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

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
        <View className="rounded-t-3xl bg-white px-6 pb-10 pt-6">
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text className="mb-4 text-xl font-bold text-neutral-900">{title}</Text>
            <TextField label={nameLabel} value={name} onChangeText={setName} autoFocus />
            {children}
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
