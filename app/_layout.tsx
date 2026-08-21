import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppTabBar } from '../src/components/AppTabBar';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { SessionProvider, useSession } from '../src/features/auth/SessionProvider';
import { useAuthDeepLinks } from '../src/features/auth/useAuthDeepLinks';
import { PushRegistrar } from '../src/features/notifications/PushRegistrar';
import { installNotificationHandler } from '../src/features/notifications/push';
import '../src/lib/i18n';
import { installGlobalErrorHandler } from '../src/lib/globalErrorHandler';
import { queryClient } from '../src/lib/queryClient';
import '../global.css';

installGlobalErrorHandler();
// Doit être posé avant tout rendu : une notification reçue app ouverte n'est
// affichée que si ce gestionnaire est déjà en place à ce moment-là.
installNotificationHandler();

function DeepLinkHandler() {
  useAuthDeepLinks();
  return null;
}

// Rendue ici (racine) plutôt que dans le navigateur Tabs pour rester visible
// en traversant les groupes de routes (tabs) <-> (entities)/habitations.
function AuthedTabBar() {
  const { session } = useSession();
  if (!session) return null;
  return <AppTabBar />;
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <QueryClientProvider client={queryClient}>
          <SessionProvider>
            <DeepLinkHandler />
            <PushRegistrar />
            <StatusBar style="auto" />
            <Stack screenOptions={{ headerShown: false }} />
            <AuthedTabBar />
          </SessionProvider>
        </QueryClientProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
