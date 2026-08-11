import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

// Habitations list lands here in Phase 2 — placeholder until then.
export default function HomeScreen() {
  const { t } = useTranslation();

  return (
    <View className="flex-1 items-center justify-center bg-white px-6">
      <Text className="mb-2 text-2xl font-bold text-neutral-900">{t('home.title')}</Text>
      <Text className="text-base text-neutral-500">{t('home.empty')}</Text>
    </View>
  );
}
