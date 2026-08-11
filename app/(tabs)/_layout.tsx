import { Redirect, Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSession } from '../../src/features/auth/SessionProvider';

export default function TabsLayout() {
  const { session, isLoading } = useSession();
  const { t } = useTranslation();

  if (isLoading) return <View className="flex-1 bg-white" />;
  if (!session) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#171717' }}>
      <Tabs.Screen name="index" options={{ title: t('home.title') }} />
      <Tabs.Screen name="profile" options={{ title: t('profile.title') }} />
    </Tabs>
  );
}
