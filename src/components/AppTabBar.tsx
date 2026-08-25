import { Image } from 'expo-image';
import { router, usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsAnonymous } from '../features/auth/SessionProvider';
import { useProfile } from '../features/profile/useProfile';
import { useFriendships } from '../features/sharing/queries';
import { MAX_CHROME_SCALE, useChromeScale } from '../lib/textScale';
import { useThemeColors } from '../lib/theme';
import { Icon, type IconName } from './Icon';

const ACTIVE_COLOR = '#1591EA';
const AVATAR_SIZE = 24;
const ICON_SIZE = 22;
const LABEL_SIZE = 11;

// Hauteur de la rangée d'onglets, hors zone système, à taille de texte
// normale.
const BASE_TAB_BAR_HEIGHT = 64;

// LA BARRE GRANDIT MOINS QUE LE RESTE DE L'APP (voir MAX_CHROME_SCALE).
//
// Quatre onglets se partagent la largeur de l'écran : « Habitations » ne
// dispose que d'un quart, soit ~90 points sur un téléphone étroit. À
// l'échelle pleine (x1,6) le libellé y serait coupé — or c'est LE mot qui
// distingue cet onglet de l'accueil.
//
// Ce n'est pas un refus d'agrandir : à x1,3 les pictogrammes passent de 22 à
// 29 points et la barre de 64 à 83, ce qui rend les cibles franchement plus
// faciles à viser. C'est le libellé seul qui plafonne.

// Même plafond appliqué au réglage de police DU TÉLÉPHONE, que `rem` ne
// contrôle pas : à 200 % un libellé de 11 points passerait à 22 et serait
// coupé sans que l'app puisse s'y opposer autrement. Les personnes qui
// dépendent d'un lecteur d'écran ne perdent rien — chaque onglet porte déjà
// son `accessibilityLabel` complet.
const MAX_LABEL_FONT_MULTIPLIER = MAX_CHROME_SCALE;

/**
 * Hauteur réelle de la rangée d'onglets, réglage de taille compris.
 *
 * Le bouton flottant de l'assistant doit se poser juste au-dessus : deux
 * calculs séparés finiraient par diverger et le feraient chevaucher la barre.
 */
export function useAppTabBarHeight(): number {
  return Math.round(BASE_TAB_BAR_HEIGHT * useChromeScale());
}

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
  const colors = useThemeColors();
  const chrome = useChromeScale();
  const color = active ? ACTIVE_COLOR : colors.inkFaint;
  const avatarSize = Math.round(AVATAR_SIZE * chrome);
  // `fixedSize` a l'usage : la taille porte deja le plafond de la barre,
  // Icon ne doit pas la remultiplier par le reglage de l'app.
  const iconSize = Math.round(ICON_SIZE * chrome);

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
              width: avatarSize,
              height: avatarSize,
              borderRadius: avatarSize / 2,
              overflow: 'hidden',
              borderWidth: active ? 2 : 0,
              borderColor: ACTIVE_COLOR,
            }}
          >
            <Image source={{ uri: avatarUrl }} style={{ width: '100%', height: '100%' }} />
          </View>
        ) : (
          <Icon name={iconName} size={iconSize} color={color} fixedSize />
        )}

        {badgeCount > 0 ? (
          <View
            style={{
              position: 'absolute',
              top: -4,
              right: -8,
              minWidth: Math.round(16 * chrome),
              height: Math.round(16 * chrome),
              borderRadius: Math.round(8 * chrome),
              paddingHorizontal: 3,
              backgroundColor: '#E5484D',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Le chiffre est plafonne comme le libelle : la pastille est
                ronde et dimensionnee en dur, un 2 passe a 20 points y serait
                rogne. */}
            <Text
              maxFontSizeMultiplier={MAX_LABEL_FONT_MULTIPLIER}
              style={{ color: '#fff', fontSize: Math.round(10 * chrome), fontWeight: '700' }}
            >
              {badgeCount > 9 ? '9+' : badgeCount}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Une seule ligne : "Habitations" est le plus long des quatre libellés
          et doit tenir dans un quart de la largeur sur un écran étroit.
          Taille en style plutôt qu'en className — une classe NativeWind
          erronée échoue en silence, sans erreur de typage. */}
      <Text
        numberOfLines={1}
        maxFontSizeMultiplier={MAX_LABEL_FONT_MULTIPLIER}
        className="mt-0.5 font-medium"
        style={{ color, fontSize: Math.round(LABEL_SIZE * chrome) }}
      >
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
  const height = useAppTabBarHeight();
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
      className="absolute bottom-0 left-0 right-0 border-t border-ink/10 bg-surface"
      style={{ paddingBottom: insets.bottom }}
    >
      <View className="flex-row items-center px-1" style={{ height }}>
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
