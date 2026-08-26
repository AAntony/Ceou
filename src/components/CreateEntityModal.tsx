import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Text, View } from 'react-native';
import { logClientError } from '../lib/errorLogging';
import { BottomSheetModal } from './BottomSheetModal';
import { Button } from './Button';
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
  // Fourni en MODIFICATION seulement (jamais à la création : il n'y a rien
  // à supprimer). C'est la seule porte vers la suppression de cet élément.
  onDelete?: () => void;
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
  onDelete,
  children,
}: CreateEntityModalProps) {
  const { t } = useTranslation();

  // LA FEUILLE SE REFERME AVANT LA DEMANDE DE CONFIRMATION. Deux raisons :
  // une boîte de dialogue posée par-dessus une Modal React Native dépend de
  // la plateforme pour s'afficher au bon endroit, et surtout « Supprimer la
  // pièce ? » n'a pas à se lire à travers un formulaire d'édition resté
  // ouvert derrière elle.
  const handleDeletePress = () => {
    onClose();
    onDelete?.();
  };

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
      // INDISPENSABLE DEPUIS QUE LE TEXTE PEUT GROSSIR : sans borne, la
      // feuille se mesure sur son contenu, et en gros texte photo + champ +
      // boutons dépassaient la hauteur de l'écran — elle sortait alors par le
      // HAUT, le titre disparaissait et rien ne défilait vraiment (retour
      // utilisateur du 2026-08-26).
      scrollable
    >
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
      {/* Sous un trait, à l'écart d'« Enregistrer » : c'est la même feuille,
          mais pas le même genre de geste. */}
      {onDelete ? (
        <View className="mt-5 border-t border-ink/10 pt-4">
          <Button label={t('common.delete')} variant="danger" onPress={handleDeletePress} />
        </View>
      ) : null}
    </BottomSheetModal>
  );
}
