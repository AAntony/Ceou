import { Redirect, Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { AppTabBar, type AppTabBarProps } from '../../src/components/AppTabBar';
import { useSession } from '../../src/features/auth/SessionProvider';

export default function TabsLayout() {
  const { session, isLoading } = useSession();
  const { t } = useTranslation();

  if (isLoading) return <View className="flex-1 bg-sand" />;
  if (!session) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <AppTabBar {...(props as unknown as AppTabBarProps)} />}
    >
      <Tabs.Screen name="index" options={{ title: t('home.tab_title') }} />
      <Tabs.Screen name="profile" options={{ title: t('profile.title') }} />
    </Tabs>
  );
}
