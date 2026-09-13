import { Redirect, Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { SectionHeader } from '../../src/components/SectionHeader';
import { useSession } from '../../src/features/auth/SessionProvider';
import { useThemeColors } from '../../src/lib/theme';

export default function TabsLayout() {
  const { session, isLoading } = useSession();
  const { t } = useTranslation();
  const colors = useThemeColors();
  if (isLoading) return <View className="flex-1 bg-sand" />;
  if (!session) return <Redirect href="/(auth)/login" />;

  // The visible bottom navigation is AppTabBar in the root layout.
  // Main section headers share their geometry with Lieux, outside this group.
  return (
    <Tabs screenOptions={{ headerShown: true, tabBarStyle: { display: 'none' },
      header: ({ options }) => <SectionHeader title={options.title ?? ''}
        action={options.headerRight?.({ tintColor: colors.accentDark, canGoBack: false })} /> }}>
      <Tabs.Screen name="index" options={{ headerShown: false }} />
      <Tabs.Screen name="friends" options={{ title: t('redesign.shares') }} />
      <Tabs.Screen name="profile" options={{ title: t('profile.title') }} />
    </Tabs>
  );
}
