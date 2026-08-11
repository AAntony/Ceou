import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SessionProvider } from '../src/features/auth/SessionProvider';
import { useAuthDeepLinks } from '../src/features/auth/useAuthDeepLinks';
import '../src/lib/i18n';
import { queryClient } from '../src/lib/queryClient';
import '../global.css';

function DeepLinkHandler() {
  useAuthDeepLinks();
  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <DeepLinkHandler />
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false }} />
        </SessionProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
