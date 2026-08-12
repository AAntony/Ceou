import { Redirect, Tabs } from 'expo-router';
import { View } from 'react-native';
import { useSession } from '../../src/features/auth/SessionProvider';

export default function TabsLayout() {
  const { session, isLoading } = useSession();

  if (isLoading) return <View className="flex-1 bg-sand" />;
  if (!session) return <Redirect href="/(auth)/login" />;

  // La barre d'onglets visible est AppTabBar, rendue depuis app/_layout.tsx
  // (persistante au-delà de ce groupe de routes) — la barre native de Tabs
  // reste montée pour l'animation de bascule instantanée entre écrans mais
  // n'est jamais affichée.
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' } }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
