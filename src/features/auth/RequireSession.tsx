import { Redirect } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { View } from 'react-native';
import { useSession } from './SessionProvider';

export function RequireSession({ children }: PropsWithChildren) {
  const { session, isLoading } = useSession();

  if (isLoading) return <View className="flex-1 bg-sand" />;
  if (!session) return <Redirect href="/(auth)/login" />;

  return <>{children}</>;
}
