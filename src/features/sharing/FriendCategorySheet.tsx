import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Text, View } from 'react-native';
import { BottomSheetModal } from '../../components/BottomSheetModal';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { confirmDelete } from '../../lib/confirmDelete';
import { logClientError } from '../../lib/errorLogging';
import { useCreateFriendCategory, useDeleteFriendCategory, useRenameFriendCategory, type FriendCategory } from './categories';

// Création et modification d'une catégorie d'amis.
//
// Une seule feuille pour les deux, comme les modales d'entité de
// l'inventaire : `category === null` crée, sinon renomme. La suppression ne
// vit que dans le second cas, et elle passe par la confirmation partagée —
// c'est la seule action irréversible de cet écran.

type FriendCategorySheetProps = {
  visible: boolean;
  /** `null` = création. */
  category: FriendCategory | null;
  onClose: () => void;
};

export function FriendCategorySheet({ visible, category, onClose }: FriendCategorySheetProps) {
  const { t } = useTranslation();
  const createCategory = useCreateFriendCategory();
  const renameCategory = useRenameFriendCategory();
  const deleteCategory = useDeleteFriendCategory();
  const [name, setName] = useState('');

  // Le champ suit la catégorie ouverte. Sans cette synchronisation, rouvrir
  // la feuille sur une AUTRE catégorie garderait le nom de la précédente.
  useEffect(() => {
    if (visible) setName(category?.name ?? '');
  }, [visible, category]);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      if (category) {
        await renameCategory.mutateAsync({ id: category.id, name: trimmed });
      } else {
        await createCategory.mutateAsync(trimmed);
      }
      onClose();
    } catch (error) {
      logClientError(error, { source: 'friend_category_sheet' });
      Alert.alert(t('common.error_generic'));
    }
  };

  const remove = () => {
    if (!category) return;
    confirmDelete(t, 'friends.categories.delete_confirm_title', 'friends.categories.delete_confirm_message', async () => {
      try {
        await deleteCategory.mutateAsync(category.id);
        onClose();
      } catch (error) {
        logClientError(error, { source: 'friend_category_sheet_delete' });
        Alert.alert(t('common.error_generic'));
      }
    });
  };

  return (
    <BottomSheetModal visible={visible} onClose={onClose} sheetClassName="rounded-t-3xl bg-white px-6 pb-6 pt-6">
      <Text className="mb-4 text-xl font-bold text-ink">
        {category ? t('friends.categories.edit_title') : t('friends.categories.create_title')}
      </Text>

      <TextField
        label={t('friends.categories.name_label')}
        placeholder={t('friends.categories.name_placeholder')}
        value={name}
        onChangeText={setName}
        autoFocus
      />

      <View className="mt-2 flex-row gap-3">
        <View className="flex-1">
          <Button label={t('common.cancel')} variant="ghost" onPress={onClose} />
        </View>
        <View className="flex-1">
          <Button
            label={t('common.save')}
            onPress={submit}
            loading={createCategory.isPending || renameCategory.isPending}
            disabled={!name.trim()}
          />
        </View>
      </View>

      {category ? (
        <View className="mt-4 border-t border-ink/10 pt-4">
          <Button
            label={t('friends.categories.delete')}
            variant="ghost"
            onPress={remove}
            loading={deleteCategory.isPending}
          />
        </View>
      ) : null}
    </BottomSheetModal>
  );
}
