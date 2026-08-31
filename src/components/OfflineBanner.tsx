import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsOffline } from '../lib/network';
import { useThemeColors } from '../lib/theme';
import { useAppTabBarHeight, useAppTabBarVisible } from './AppTabBar';
import { Icon } from './Icon';

// LE BANDEAU QUI DIT QUE CE QU'ON LIT DATE.
//
// Sans réseau, l'application n'affiche plus une erreur : elle montre le
// dernier état connu, relu du disque. C'est nettement mieux qu'un écran
// mort — mais ça devient trompeur si rien ne le dit. Quelqu'un qui cherche
// où il a rangé une perceuse doit pouvoir distinguer « elle est là » de
// « elle y était la dernière fois que j'avais du réseau ».
//
// EN BAS, JUSTE AU-DESSUS DE LA BARRE D'ONGLETS, et non en haut : le haut est
// occupé par l'en-tête natif, dont il masquerait le titre — c'est-à-dire le
// nom de la pièce ou de l'objet qu'on est en train de regarder. Là où il est,
// il ne recouvre que du fond.
//
// Il se retire aussi de lui-même sur les écrans où la barre d'onglets
// disparaît (voir useAppTabBarVisible) : sur l'éditeur de plan, la moindre
// bande fixe mange une zone de geste.
const ICON_SIZE = 16;

export function OfflineBanner() {
  const offline = useIsOffline();
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const tabBarVisible = useAppTabBarVisible();
  const tabBarHeight = useAppTabBarHeight();

  if (!offline) return null;

  // Au-dessus de la barre quand elle est là, au ras du bord sinon — et dans
  // ce second cas c'est le bandeau qui prend en charge la zone système.
  const bottom = tabBarVisible ? tabBarHeight + insets.bottom : 0;

  return (
    <View
      // `pointerEvents="none"` : c'est une information, pas une commande. Une
      // bande fixe qui intercepte le doigt rendrait inatteignable ce qui
      // passe dessous.
      pointerEvents="none"
      className="absolute left-0 right-0 flex-row items-center justify-center gap-2 border-t border-ink/10 bg-sand-dark px-4 py-2"
      style={{ bottom, paddingBottom: tabBarVisible ? 8 : insets.bottom + 8 }}
      // Annoncé comme une alerte : c'est un changement d'état de
      // l'application, pas un élément de la page qu'on parcourt.
      accessibilityRole="alert"
      accessibilityLabel={`${t('network.offline')} ${t('network.offline_hint')}`}
    >
      <Icon name="alert" size={ICON_SIZE} color={colors.inkSoft} />
      <Text numberOfLines={2} className="shrink text-caption text-ink-soft">
        <Text className="font-semibold">{t('network.offline')}</Text>
        {' — '}
        {t('network.offline_hint')}
      </Text>
    </View>
  );
}
