import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AnimatedSplash } from '../src/components/AnimatedSplash';
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

// Retient le splash NATIF (l'aplat bleu affiché par le système avant même que
// le JavaScript ne soit chargé). Sans ça, il disparaîtrait dès le premier
// rendu et laisserait un éclair blanc avant notre animation. Il n'est retiré
// qu'une fois notre propre fond bleu peint — voir onPainted plus bas.
SplashScreen.preventAutoHideAsync().catch(() => {
  // Déjà masqué, ou plateforme sans splash natif : rien à rattraper.
});

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

function AppShell() {
  const { isLoading } = useSession();
  const [splashDone, setSplashDone] = useState(false);
  const nativeHidden = useRef(false);

  const hideNativeSplash = () => {
    // onLayout se déclenche à chaque changement de taille (rotation, clavier)
    // — on ne veut retirer le splash natif qu'une seule fois.
    if (nativeHidden.current) return;
    nativeHidden.current = true;
    SplashScreen.hideAsync().catch(() => {});
  };

  return (
    <>
      <DeepLinkHandler />
      <PushRegistrar />
      {/* Icônes claires tant que le bleu occupe l'écran, sinon l'heure et la
          batterie s'écrivent en sombre sur fond soutenu. */}
      <StatusBar style={splashDone ? 'auto' : 'light'} />
      <Stack screenOptions={{ headerShown: false }} />
      <AuthedTabBar />

      {/* En dernier : c'est un calque, il doit passer au-dessus du reste. */}
      {splashDone ? null : (
        <AnimatedSplash ready={!isLoading} onFinish={() => setSplashDone(true)} onPainted={hideNativeSplash} />
      )}
    </>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <QueryClientProvider client={queryClient}>
          <SessionProvider>
            <AppShell />
          </SessionProvider>
        </QueryClientProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
