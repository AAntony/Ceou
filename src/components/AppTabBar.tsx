import { router, usePathname } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AddObjetModal } from '../features/inventory/AddObjetModal';
import { Icon } from './Icon';

// Rendu depuis app/_layout.tsx (racine), pas depuis le navigateur Tabs :
// toujours visible, quel que soit l'écran — Piece/Emplacement/Conteneur
// n'ont sinon aucun moyen rapide de revenir à l'Accueil ou au Profil
// (uniquement le fil de navigation natif, écran par écran).
export function AppTabBar() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [addObjetOpen, setAddObjetOpen] = useState(false);

  const onHome = pathname === '/';
  const leftLabel = onHome ? t('home.tab_title') : t('app_name');
  const leftOnPress = () => router.navigate(onHome ? '/habitations' : '/');
  const leftActive = pathname !== '/profile';
  const rightActive = pathname === '/profile';

  return (
    <>
      <View className="absolute left-6 right-6" style={{ bottom: insets.bottom + 12 }}>
        <View className="h-16 flex-row items-center rounded-full bg-white px-2 shadow-lg">
          <Pressable onPress={leftOnPress} className="flex-1 items-center justify-center py-2">
            <Icon name="home" size={22} color={leftActive ? '#FF6B4A' : '#A39C8F'} />
            <Text className="mt-0.5 text-xs font-medium" style={{ color: leftActive ? '#FF6B4A' : '#A39C8F' }}>
              {leftLabel}
            </Text>
          </Pressable>

          <Pressable onPress={() => router.navigate('/profile')} className="flex-1 items-center justify-center py-2">
            <Icon name="profile" size={22} color={rightActive ? '#FF6B4A' : '#A39C8F'} />
            <Text className="mt-0.5 text-xs font-medium" style={{ color: rightActive ? '#FF6B4A' : '#A39C8F' }}>
              {t('profile.title')}
            </Text>
          </Pressable>
        </View>

        <Pressable
          onPress={() => setAddObjetOpen(true)}
          className="absolute self-center items-center justify-center active:opacity-85"
          style={{
            top: -22,
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: '#FF6B4A',
            elevation: 6,
            shadowColor: '#2D2A26',
            shadowOpacity: 0.25,
            shadowOffset: { width: 0, height: 4 },
            shadowRadius: 8,
          }}
        >
          <Icon name="add" size={26} color="#fff" />
        </Pressable>
      </View>

      <AddObjetModal visible={addObjetOpen} onClose={() => setAddObjetOpen(false)} />
    </>
  );
}
