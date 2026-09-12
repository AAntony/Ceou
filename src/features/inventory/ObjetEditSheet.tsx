import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { BottomSheetModal } from '../../components/BottomSheetModal';
import { FormActions } from '../../components/FormActions';
import { TextField } from '../../components/TextField';
import { showDialog, showMessage } from '../../lib/dialog';
import { useUpdateObjet } from './queries';

type Props = { id: string; name: string; description: string | null; onClose: () => void };

/** Mounted for one edit session; background refetches never reset the draft. */
export function ObjetEditSheet({ id, name: originalName, description: originalDescription, onClose }: Props) {
  const { t } = useTranslation();
  const [initial] = useState({ name: originalName, description: originalDescription ?? '' });
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const update = useUpdateObjet(id);
  const dirty = name !== initial.name || description !== initial.description;
  const close = () => {
    if (update.isPending) return;
    if (!dirty) { onClose(); return; }
    showDialog({ title: t('redesign.discardTitle'), message: t('redesign.discardBody'), actions: [
      { label: t('redesign.keepEditing'), cancel: true },
      { label: t('redesign.discard'), destructive: true, onPress: onClose },
    ] });
  };
  const save = async () => {
    if (!name.trim() || update.isPending) return;
    // Avoid silently overwriting a newer remote edit discovered while this sheet was open.
    if (originalName !== initial.name || (originalDescription ?? '') !== initial.description) {
      showMessage(t('redesign.nameConflict'));
      return;
    }
    try {
      await update.mutateAsync({ name: name.trim(), description: description.trim() || null });
      onClose();
    } catch { showMessage(t('common.error_generic')); }
  };
  return (
    <BottomSheetModal visible onClose={close} scrollable sheetClassName="rounded-t-3xl bg-surface px-6 py-6">
      <Text accessibilityRole="header" className="mb-5 text-heading font-bold text-ink">{t('redesign.edit')}</Text>
      <TextField label={t('inventory.objet.name_label')} value={name} onChangeText={setName}
        error={!name.trim() ? t('redesign.nameRequired') : undefined} autoFocus editable={!update.isPending} />
      <TextField label={t('inventory.objet.description_label')} value={description} onChangeText={setDescription}
        multiline numberOfLines={4} editable={!update.isPending} />
      <View className="mt-3"><FormActions cancelLabel={t('common.cancel')} onCancel={close}
        confirmLabel={t('common.save')} onConfirm={save} loading={update.isPending} disabled={!name.trim() || !dirty} /></View>
    </BottomSheetModal>
  );
}
