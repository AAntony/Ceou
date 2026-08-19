import { router, usePathname } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AddObjetModal } from '../features/inventory/AddObjetModal';
import { useFriendships } from '../features/sharing/queries';
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
  // Pastille de demandes d'ami en attente — pas de notification push (voir
  // Phase 8, hors scope explicite), mais au moins un signal visible dès que
  // l'app est ouverte plutôt que de devoir penser à vérifier l'onglet Amis.
  const { data: friendships } = useFriendships();
  const pendingIncomingCount = (friendships ?? []).filter((f) => f.status === 'pending' && f.direction === 'incoming').length;

  const onHome = pathname === '/';
  const leftLabel = onHome ? t('home.tab_title') : t('app_name');
  const leftOnPress = () => router.navigate(onHome ? '/habitations' : '/');
  const rightActive = pathname === '/friends';
  const leftActive = !rightActive;

  // Deux écrans se lisent/s'utilisent mal avec la barre par-dessus :
  // - la politique de confidentialité, dont le texte passait sous le menu
  //   (retour utilisateur du 2026-08-18) ;
  // - l'éditeur de Plan, où le canvas occupe toute la hauteur restante et se
  //   pilote au doigt : la barre y masquait le bas du plan ET interceptait
  //   les gestes, donc glisser une pièce vers le bas revenait à appuyer sur
  //   "Amis". Une zone morte dans un outil de manipulation directe, pas une
  //   simple gêne visuelle.
  // `/plan/` ne capture QUE l'éditeur : la liste des plans est `/plans/`,
  // qui ne correspond pas à ce préfixe (le `s` tombe avant le `/`).
  if (pathname === '/privacy-policy' || pathname.startsWith('/plan/')) return null;

  return (
    <>
      {/* Barre pleine largeur collée au bas, PAS une pastille flottante : le
          fond blanc descend jusqu'au bord de l'écran en traversant
          `insets.bottom`, si bien que les boutons/gestes natifs du téléphone
          se posent sur le même blanc que le menu au lieu de flotter sur le
          fond de l'app. Le rembourrage bas garde les libellés au-dessus de
          cette zone système. */}
      <View
        className="absolute bottom-0 left-0 right-0 border-t border-ink/10 bg-white"
        style={{ paddingBottom: insets.bottom }}
      >
        <View className="h-16 flex-row items-center px-2">
          <Pressable onPress={leftOnPress} className="flex-1 items-center justify-center py-2">
            <Icon name="home" size={22} color={leftActive ? '#FF6B4A' : '#A39C8F'} />
            <Text className="mt-0.5 text-xs font-medium" style={{ color: leftActive ? '#FF6B4A' : '#A39C8F' }}>
              {leftLabel}
            </Text>
          </Pressable>

          <Pressable onPress={() => router.navigate('/friends')} className="flex-1 items-center justify-center py-2">
            <View style={{ position: 'relative' }}>
              <Icon name="friends" size={22} color={rightActive ? '#FF6B4A' : '#A39C8F'} />
              {pendingIncomingCount > 0 ? (
                <View
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: -8,
                    minWidth: 16,
                    height: 16,
                    borderRadius: 8,
                    paddingHorizontal: 3,
                    backgroundColor: '#E5484D',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{pendingIncomingCount > 9 ? '9+' : pendingIncomingCount}</Text>
                </View>
              ) : null}
            </View>
            <Text className="mt-0.5 text-xs font-medium" style={{ color: rightActive ? '#FF6B4A' : '#A39C8F' }}>
              {t('friends.tab_title')}
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
