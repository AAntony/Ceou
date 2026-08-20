import { Redirect, Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSession } from '../../src/features/auth/SessionProvider';

export default function TabsLayout() {
  const { session, isLoading } = useSession();
  const { t } = useTranslation();

  if (isLoading) return <View className="flex-1 bg-sand" />;
  if (!session) return <Redirect href="/(auth)/login" />;

  // La barre d'onglets visible est AppTabBar, rendue depuis app/_layout.tsx
  // (persistante au-delà de ce groupe de routes) — la barre native de Tabs
  // reste montée pour l'animation de bascule instantanée entre écrans mais
  // n'est jamais affichée.
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' } }}>
      <Tabs.Screen name="index" />
      {/* Seul onglet à porter un en-tête natif, et c'est délibéré : Amis
          liste des entités qu'on ajoute (comme Habitations/Pièces/
          Emplacements), il doit donc se présenter comme eux — titre à
          gauche, bouton "Ajouter" à droite, trait de séparation sous
          l'en-tête. Mêmes valeurs de style qu'app/(entities)/_layout.tsx,
          sans quoi le fond et la teinte différeraient d'un écran à l'autre.
          L'Accueil (tableau de bord avec sa propre salutation) et le Profil
          n'ont rien à ajouter et gardent leur pleine hauteur.
          Le bouton lui-même est posé par l'écran via setOptions : c'est lui
          qui porte l'état de la modale d'ajout. */}
      <Tabs.Screen
        name="friends"
        options={{
          headerShown: true,
          title: t('friends.tab_title'),
          headerStyle: { backgroundColor: '#FFFBF8' },
          headerTintColor: '#1591EA',
          headerTitleStyle: { color: '#2D2A26' },
        }}
      />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
