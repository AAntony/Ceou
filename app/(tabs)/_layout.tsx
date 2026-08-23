import { Redirect, Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '../../src/features/auth/SessionProvider';
import { useThemeColors } from '../../src/lib/theme';

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
  const colors = useThemeColors();

  if (isLoading) return <View className="flex-1 bg-sand" />;
  if (!session) return <Redirect href="/(auth)/login" />;

  // La barre d'onglets visible est AppTabBar, rendue depuis app/_layout.tsx
  // (persistante au-delà de ce groupe de routes) — la barre native de Tabs
  // reste montée pour l'animation de bascule instantanée entre écrans mais
  // n'est jamais affichée.
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' } }}>
      <Tabs.Screen name="index" />
      {/* Seul onglet à porter un en-tête, et c'est délibéré : Amis liste des
          entités qu'on ajoute (comme Habitations/Pièces/Emplacements), il
          doit donc se présenter comme eux — titre à gauche, bouton
          "Ajouter" à droite, trait de séparation sous l'en-tête. Mêmes
          valeurs de style qu'app/(entities)/_layout.tsx, sans quoi le fond
          et la teinte différeraient d'un écran à l'autre.
          Attention : ce n'est PAS le même composant d'en-tête que celui des
          écrans (entities) — eux ont l'en-tête natif du Stack, celui-ci est
          l'en-tête JS du navigateur d'onglets. D'où la hauteur forcée
          ci-dessus ; toute autre différence de rendu entre les deux se
          règlera ici, pas dans l'écran.
          L'Accueil (tableau de bord avec sa propre salutation) et le Profil
          n'ont rien à ajouter et gardent leur pleine hauteur.
          Le bouton lui-même est posé par l'écran via setOptions : c'est lui
          qui porte l'état de la modale d'ajout. */}
      <Tabs.Screen
        name="friends"
        options={{
          headerShown: true,
          title: t('friends.tab_title'),
          headerStyle: { backgroundColor: colors.sand, height: NATIVE_STACK_HEADER_HEIGHT + insets.top },
          headerTintColor: colors.accent,
          headerTitleStyle: { color: colors.ink },
        }}
      />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
