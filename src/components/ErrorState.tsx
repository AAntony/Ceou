import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { Button } from './Button';
import { Icon } from './Icon';
import { useThemeColors } from '../lib/theme';

type ErrorStateProps = {
  // Typiquement le `refetch` du hook React Query en échec. Omis quand
  // l'appelant n'a rien à relancer (rare) : le bloc reste alors purement
  // informatif plutôt que d'afficher un bouton qui ne ferait rien.
  onRetry?: () => void;
  title?: string;
};

// Pendant du EmptyState, pour l'autre issue possible d'une requête. Sans lui,
// une requête en échec laissait soit un ActivityIndicator qui tourne
// indéfiniment (écrans de détail : `isLoading` retombe à false mais `data`
// reste undefined, donc la garde `isLoading || !data` ne se relâche jamais),
// soit — pire — l'état vide, qui affirme à tort que l'inventaire est vide
// alors que la donnée n'a simplement pas pu être lue. Un utilisateur qui voit
// "Aucune habitation" croit ses données perdues.
// Rouge corail plutôt que le moutarde du EmptyState : les deux blocs se
// ressemblent structurellement, la couleur est ce qui dit au premier coup
// d'œil "problème" et non "rien à afficher".
export function ErrorState({ onRetry, title }: ErrorStateProps) {
  const colors = useThemeColors();
  const { t } = useTranslation();

  return (
    <View className="flex-1 items-center justify-center px-6 py-16">
      <View className="mb-3 h-16 w-16 items-center justify-center rounded-full bg-coral-light">
        <Icon name="alert" size={30} color={colors.accentDark} />
      </View>
      <Text className="mb-1 text-center text-body font-medium text-ink">{title ?? t('common.error_load_title')}</Text>
      <Text className="mb-4 text-center text-label text-ink-soft">{t('common.error_load_hint')}</Text>
      {onRetry ? (
        <View className="w-44">
          <Button label={t('common.retry')} variant="outline" onPress={onRetry} />
        </View>
      ) : null}
    </View>
  );
}
