import { Redirect, Stack } from 'expo-router';
import { View } from 'react-native';
import { useSession } from '../../src/features/auth/SessionProvider';

export default function AuthLayout() {
  const { session, isLoading } = useSession();

  if (isLoading) return <View className="flex-1 bg-sand" />;
  if (session) return <Redirect href="/(tabs)" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
