import { ProfileSetup } from '../src/features/profile/ProfileSetup';
import { focusManager } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { AppState, Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatedSplash } from '../src/components/AnimatedSplash';
import { AppDialogHost } from '../src/components/AppDialogHost';
import { AppTabBar } from '../src/components/AppTabBar';
import { OfflineBanner, useHasTopBanner } from '../src/components/OfflineBanner';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { SessionProvider, useSession } from '../src/features/auth/SessionProvider';
import { BillingAccountObserver } from '../src/features/billing/BillingAccountObserver';
import { useAuthDeepLinks } from '../src/features/auth/useAuthDeepLinks';
import { useInventorySnapshot } from '../src/features/inventory/offlineSnapshot';
import { PushRegistrar } from '../src/features/notifications/PushRegistrar';
import { installNotificationHandler } from '../src/features/notifications/push';
import '../src/lib/i18n';
import { installGlobalErrorHandler } from '../src/lib/globalErrorHandler';
import { useHeaderOptions } from '../src/lib/headerOptions';
import { installOnlineManager } from '../src/lib/network';
import { persistOptions, queryClient } from '../src/lib/queryClient';
import { registerWriteMutation } from '../src/lib/writeQueue';
import { SplashGateProvider, useSplashGate } from '../src/lib/splashGate';
import { TextScaleProvider } from '../src/lib/textScale';
import { ThemeProvider } from '../src/lib/theme';
import '../global.css';

installGlobalErrorHandler();
// Doit être posé avant tout rendu : une notification reçue app ouverte n'est
// affichée que si ce gestionnaire est déjà en place à ce moment-là.
installNotificationHandler();
// Avant le premier rendu également, et pour une raison voisine : les requêtes
// montées par le premier écran consultent l'état du réseau au moment où elles
// démarrent. Branché plus tard, TanStack se croirait en ligne le temps de
// quelques requêtes — celles-là partiraient et échoueraient au lieu d'être
// mises en attente.
installOnlineManager();
// AVANT LA RELECTURE DU CACHE, impérativement. Une mutation en attente relue
// du disque cherche sa fonction par sa clé : si les défauts ne sont pas encore
// posés, elle ne la trouve pas et la modification reste en attente pour
// toujours. Au niveau du module, donc avant le premier rendu — et donc avant
// que PersistQueryClientProvider ne restaure quoi que ce soit.
registerWriteMutation(queryClient);

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
  const hasBanner = useHasTopBanner();
  // Charge tout l'inventaire d'avance pour qu'il soit consultable sans
  // reseau — y compris les fiches qu'on n'a pas encore ouvertes.
  useInventorySnapshot();
  const insets = useSafeAreaInsets();
  const header = useHeaderOptions();
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
      <BillingAccountObserver />
      <PushRegistrar />
      {/* Icônes claires tant que le bleu occupe l'écran, sinon l'heure et la
          batterie s'écrivent en sombre sur fond soutenu. */}
      <StatusBar style={splashDone ? 'auto' : 'light'} />
      {/* LE BANDEAU POUSSE LE RESTE VERS LE BAS au lieu de le recouvrir : il
          est dans le flux, avant le navigateur. Une bande posée par-dessus
          aurait masqué le titre et la flèche de retour des en-têtes natifs.
          Quand il est absent, il ne rend rien et cette colonne se comporte
          exactement comme le navigateur seul.

          `top: 0` transmis en dessous : le bandeau porte déjà l'encart de
          barre d'état, et sans ça les en-têtes le compteraient une seconde
          fois — un vide de la hauteur de la barre d'état sous le bandeau. */}
      <View className="flex-1">
        <OfflineBanner />
        <SafeAreaInsetsContext.Provider value={hasBanner ? { ...insets, top: 0 } : insets}>
          {/* Éteint par défaut : les groupes (tabs) et (entities) posent
              chacun le leur. Mais les écrans RACINE qui le rallument —
              Prêts, Compte, Invitations, Confidentialité, Passer en compte
              complet — héritaient alors du thème de React Navigation, donc
              d'un fond BLANC en clair comme en sombre. D'où l'apparence
              donnée ici même quand l'en-tête est éteint : elle n'attend que
              d'être rallumée. */}
          <Stack screenOptions={{ headerShown: false, headerBackTitle: '', ...header }} />
        </SafeAreaInsetsContext.Provider>
      </View>
      <AuthedTabBar />
      {splashDone ? <ProfileSetup /> : null}

      {/* En dernier : c'est un calque, il doit passer au-dessus du reste. */}
      {splashDone ? null : (
        <AnimatedSplash ready={!isLoading} onFinish={markSplashDone} onPainted={hideNativeSplash} />
      )}

      {/* APRES LE CALQUE, et monte ici plutot que dans un ecran : toute l'app
          demande ses confirmations et ses messages par `showDialog`, y compris
          depuis des hooks qui n'ont pas d'ecran a eux (voir lib/dialog.ts). */}
      <AppDialogHost />
    </>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={persistOptions}
          // Les modifications faites hors-ligne au lancement PRECEDENT sont
          // relues ici. TanStack reprend tout seul celles mises en pause quand
          // le reseau revient PENDANT une session ; celles qui viennent du
          // disque, elles, n'ont jamais ete mises en pause dans CETTE session,
          // personne ne les reprendrait sans cet appel.
          onSuccess={() => {
            void queryClient.resumePausedMutations();
          }}
        >
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
        </PersistQueryClientProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
