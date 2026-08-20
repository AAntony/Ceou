import { Image } from 'expo-image';
import { router, usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsAnonymous } from '../features/auth/SessionProvider';
import { useProfile } from '../features/profile/useProfile';
import { useFriendships } from '../features/sharing/queries';
import { Icon, type IconName } from './Icon';

const ACTIVE_COLOR = '#1591EA';
const INACTIVE_COLOR = '#A39C8F';
const AVATAR_SIZE = 24;

// Tout le parcours Habitation > Pièce > Emplacement > Conteneur > Objet, plus
// les plans et les habitations partagées par un ami : on met en évidence la
// SECTION où l'on se trouve, pas l'écran exact. Sans ça, aucun onglet ne
// serait allumé sur la majorité des écrans de l'app.
const HABITATION_PREFIXES = [
  '/habitations',
  '/habitation/',
  '/piece/',
  '/emplacement/',
  '/conteneur/',
  '/objet/',
  '/plans/',
  '/plan/',
  '/friend-habitations/',
];

type TabItemProps = {
  label: string;
  iconName: IconName;
  active: boolean;
  onPress: () => void;
  avatarUrl?: string | null;
  badgeCount?: number;
};

function TabItem({ label, iconName, active, onPress, avatarUrl, badgeCount = 0 }: TabItemProps) {
  const color = active ? ACTIVE_COLOR : INACTIVE_COLOR;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      className="flex-1 items-center justify-center py-2"
    >
      <View style={{ position: 'relative' }}>
        {avatarUrl ? (
          // Photo de profil réelle plutôt qu'un pictogramme, comme le fait
          // Instagram : c'est ce qui distingue sans ambiguïté cet onglet de
          // "Amis" juste à côté, deux silhouettes étant sinon très proches
          // à cette taille.
          <View
            style={{
              width: AVATAR_SIZE,
              height: AVATAR_SIZE,
              borderRadius: AVATAR_SIZE / 2,
              overflow: 'hidden',
              borderWidth: active ? 2 : 0,
              borderColor: ACTIVE_COLOR,
            }}
          >
            <Image source={{ uri: avatarUrl }} style={{ width: '100%', height: '100%' }} />
          </View>
        ) : (
          <Icon name={iconName} size={22} color={color} />
        )}

        {badgeCount > 0 ? (
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
            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{badgeCount > 9 ? '9+' : badgeCount}</Text>
          </View>
        ) : null}
      </View>

      {/* 11px et une seule ligne : "Habitations" est le plus long des quatre
          libellés et doit tenir dans un quart de la largeur sur un écran
          étroit. Taille en style plutôt qu'en className — une classe
          NativeWind erronée échoue en silence, sans erreur de typage. */}
      <Text numberOfLines={1} className="mt-0.5 font-medium" style={{ color, fontSize: 11 }}>
        {label}
      </Text>
    </Pressable>
  );
}

// Rendu depuis app/_layout.tsx (racine), pas depuis le navigateur Tabs :
// toujours visible, quel que soit l'écran — Piece/Emplacement/Conteneur
// n'ont sinon aucun moyen rapide de revenir à l'Accueil ou au Profil
// (uniquement le fil de navigation natif, écran par écran).
//
// Quatre destinations FIXES. La version précédente n'avait qu'un bouton de
// gauche qui basculait entre Accueil et Habitations en changeant de libellé
// selon l'écran courant : un contrôle de navigation dont la destination
// dépend de l'endroit où l'on se trouve déjà ne s'apprend pas. Le "+"
// central (ajout d'objet) est parti dans l'en-tête de l'Accueil : il
// annonçait un ajout contextuel alors qu'il ajoutait toujours un Objet, sur
// des écrans qui ont déjà leur propre bouton "Ajouter" contextuel dans
// l'en-tête natif (retour testeurs). L'Accueil est le seul écran SANS
// contexte, donc le seul où un "+" n'a qu'un sens possible.
export function AppTabBar() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  // Pastille de demandes d'ami en attente — pas de notification push (voir
  // Phase 8, hors scope explicite), mais au moins un signal visible dès que
  // l'app est ouverte plutôt que de devoir penser à vérifier l'onglet Amis.
  const { data: friendships } = useFriendships();
  const { data: profile } = useProfile();
  const isGuest = useIsAnonymous();

  const pendingIncomingCount = (friendships ?? []).filter((f) => f.status === 'pending' && f.direction === 'incoming').length;

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
  // `/guest-invite` s'ajoute à la liste : l'écran ouvre une session anonyme
  // en cours de route, si bien que la barre apparaîtrait par-dessus un écran
  // encore en train de décider où envoyer le visiteur.
  if (pathname === '/privacy-policy' || pathname === '/guest-invite' || pathname.startsWith('/plan/')) return null;

  const onHome = pathname === '/';
  const onHabitations = HABITATION_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const onFriends = pathname === '/friends';
  const onProfile = pathname === '/profile';

  return (
    /* Barre pleine largeur collée au bas, PAS une pastille flottante : le
       fond blanc descend jusqu'au bord de l'écran en traversant
       `insets.bottom`, si bien que les boutons/gestes natifs du téléphone
       se posent sur le même blanc que le menu au lieu de flotter sur le
       fond de l'app. Le rembourrage bas garde les libellés au-dessus de
       cette zone système. */
    <View
      className="absolute bottom-0 left-0 right-0 border-t border-ink/10 bg-white"
      style={{ paddingBottom: insets.bottom }}
    >
      <View className="h-16 flex-row items-center px-1">
        {/* Le pin reprend le "o" du logo Céoù — clin d'œil au nom, et
            surtout la seule façon de ne pas mettre deux maisons côte à côte
            dans une app qui parle justement d'habitations. */}
        <TabItem label={t('app_name')} iconName="location" active={onHome} onPress={() => router.navigate('/')} />
        <TabItem
          label={t('inventory.habitations.title')}
          iconName="habitations"
          active={onHabitations}
          onPress={() => router.navigate('/habitations')}
        />
        {/* Un visiteur anonyme n'a pas de vie sociale dans l'app : ni code
            ami exploitable, ni possibilité d'être ajouté en retour (une
            session anonyme n'est joignable par personne). L'onglet ne mène
            qu'à une page vide, autant ne pas le montrer. */}
        {isGuest ? null : (
          <TabItem
            label={t('friends.tab_title')}
            iconName="friends"
            active={onFriends}
            badgeCount={pendingIncomingCount}
            onPress={() => router.navigate('/friends')}
          />
        )}
        <TabItem
          label={t('profile.title')}
          iconName="profile"
          avatarUrl={profile?.avatar_url ?? null}
          active={onProfile}
          onPress={() => router.navigate('/profile')}
        />
      </View>
    </View>
  );
}
