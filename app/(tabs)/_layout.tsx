import { Redirect, Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '../../src/features/auth/SessionProvider';
import { useHeaderOptions } from '../../src/lib/headerOptions';
import { useChromeScale } from '../../src/lib/textScale';

// Les écrans (entities) — Habitations, Pièce, Emplacement — utilisent
// l'en-tête NATIF d'un Stack, qui reprend l'actionBarSize d'Android : 56 dp.
// Le navigateur d'onglets, lui, rend un en-tête JS
// (@react-navigation/elements) dont la hauteur par défaut sur Android est
// 64 dp (getDefaultHeaderHeight.js). D'où 8 dp d'écart visible entre
// Habitations et Amis, alors que le titre fait bien 20 sp des deux côtés.
// On force donc ici la valeur du Stack natif.
//
// La hauteur du conteneur INCLUT l'encart de barre d'état — Header.js pose
// un espaceur de `headerStatusBarHeight` À L'INTÉRIEUR de cette hauteur —
// il faut donc l'ajouter explicitement, sinon l'en-tête viendrait mordre
// sur la barre d'état.
//
// Sur iOS les deux valent déjà 44 : ce correctif ne change rien là-bas.
const NATIVE_STACK_HEADER_HEIGHT = Platform.OS === 'ios' ? 44 : 56;

export default function TabsLayout() {
  const { session, isLoading } = useSession();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const chrome = useChromeScale();
  const header = useHeaderOptions();

  if (isLoading) return <View className="flex-1 bg-sand" />;
  if (!session) return <Redirect href="/(auth)/login" />;

  // Attention : ce n'est PAS le même composant d'en-tête que celui des écrans
  // (entities) — eux ont l'en-tête natif du Stack, celui-ci est l'en-tête JS
  // du navigateur d'onglets. D'où la hauteur forcée ci-dessous ; toute autre
  // différence de rendu entre les deux se règlera ici, pas dans l'écran.
  const headerOptions = {
    ...header,
    headerShown: true,
    // Contrairement à l'en-tête natif de (entities), celui-ci est rendu
    // en JavaScript : sa hauteur suit donc le réglage, elle aussi.
    headerStyle: {
      ...header.headerStyle,
      height: Math.round(NATIVE_STACK_HEADER_HEIGHT * chrome) + insets.top,
    },
  };

  // La barre d'onglets visible est AppTabBar, rendue depuis app/_layout.tsx
  // (persistante au-delà de ce groupe de routes) — la barre native de Tabs
  // reste montée pour l'animation de bascule instantanée entre écrans mais
  // n'est jamais affichée.
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' } }}>
      {/* Seul onglet SANS en-tête, et c'est délibéré : le tableau de bord
          ouvre sur sa propre salutation, qui tient déjà lieu de titre. */}
      <Tabs.Screen name="index" />
      {/* Amis liste des entités qu'on ajoute (comme Habitations/Pièces/
          Emplacements), il doit donc se présenter comme eux — titre à gauche,
          bouton "Ajouter" à droite, trait de séparation sous l'en-tête.
          Le bouton lui-même est posé par l'écran via setOptions : c'est lui
          qui porte l'état de la modale d'ajout. */}
      <Tabs.Screen name="friends" options={{ ...headerOptions, title: t('friends.tab_title') }} />
      {/* Le Profil n'avait rien à mettre dans un en-tête tant que son
          « Enregistrer » vivait au milieu du formulaire. Il porte maintenant
          la disquette, posée par l'écran via setOptions comme le "Ajouter"
          d'Amis — l'état de saisie appartient à l'écran, pas au layout. */}
      <Tabs.Screen name="profile" options={{ ...headerOptions, title: t('profile.title') }} />
    </Tabs>
  );
}
