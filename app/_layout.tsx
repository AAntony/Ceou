import { focusManager, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
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
import { SplashGateProvider, useSplashGate } from '../src/lib/splashGate';
import { TextScaleProvider } from '../src/lib/textScale';
import { ThemeProvider } from '../src/lib/theme';
import '../global.css';

installGlobalErrorHandler();
// Doit être posé avant tout rendu : une notification reçue app ouverte n'est
// affichée que si ce gestionnaire est déjà en place à ce moment-là.
installNotificationHandler();

// Retient le splash NATIF (l'aplat bleu affiché par le système avant même que
// le JavaScript ne soit chargé). Sans ça, il disparaîtrait dès le premier
// rendu et laisserait un éclair blanc avant notre animation. Il n'est retiré
// qu'une fois notre propre fond bleu peint — voir onPainted plus bas.
try {
  SplashScreen.preventAutoHideAsync().catch(() => {
    // Déjà masqué : rien à rattraper.
  });
} catch {
  // Module natif absent. Cas réel et pas théorique : une mise à jour OTA
  // peut atterrir sur un build antérieur à l'ajout d'expo-splash-screen. Il
  // n'y a alors aucun splash natif à retenir — notre calque prend le relais
  // tout seul, au prix d'un bref éclair blanc avant lui.
}

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
  // La fin du splash n'est plus un état privé : le guide de démarrage doit la
  // connaître pour ne pas ouvrir sa fenêtre par-dessus (voir lib/splashGate).
  const { splashDone, markSplashDone } = useSplashGate();
  const nativeHidden = useRef(false);

  // BRANCHEMENT INDISPENSABLE SUR MOBILE. TanStack Query sait rafraîchir ses
  // données « au retour du focus », mais cette notion est celle d'une FENÊTRE
  // de navigateur : sur un téléphone, rien ne la déclenche jamais. Sans ce
  // pont vers AppState, une donnée modifiée par quelqu'un d'autre pendant que
  // l'app était en arrière-plan restait celle du dernier chargement jusqu'à
  // ce que l'application soit réellement tuée — d'où une demande d'ami ou un
  // retrait d'ami qui n'apparaissaient qu'après avoir fermé puis rouvert.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      // Le web a déjà son propre détecteur de focus ; le doubler ferait se
      // contredire les deux.
      if (Platform.OS !== 'web') focusManager.setFocused(status === 'active');
    });
    return () => subscription.remove();
  }, []);

  const hideNativeSplash = () => {
    // onLayout se déclenche à chaque changement de taille (rotation, clavier)
    // — on ne veut retirer le splash natif qu'une seule fois.
    if (nativeHidden.current) return;
    nativeHidden.current = true;
    try {
      SplashScreen.hideAsync().catch(() => {});
    } catch {
      // Même raison que plus haut : rien à masquer sans le module natif.
    }
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
        <AnimatedSplash ready={!isLoading} onFinish={markSplashDone} onPainted={hideNativeSplash} />
      )}
    </>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <QueryClientProvider client={queryClient}>
          {/* Au-dessus de tout ce qui peint : le theme choisi doit etre
              applique avant le premier rendu colore, pas apres. */}
          <ThemeProvider>
            {/* Sous le theme et au-dessus de tout le reste : il deplace la
                valeur de `rem`, dont depend la taille de CHAQUE classe
                Tailwind de l'app. */}
            <TextScaleProvider>
              <SessionProvider>
                {/* Autour d'AppShell, qui pose le signal, et de tous les
                    écrans, qui le lisent. */}
                <SplashGateProvider>
                  <AppShell />
                </SplashGateProvider>
              </SessionProvider>
            </TextScaleProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
