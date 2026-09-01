import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsOffline } from '../lib/network';
import { useThemeColors } from '../lib/theme';
import { Icon } from './Icon';

// LE BANDEAU QUI DIT QUE CE QU'ON LIT DATE.
//
// Sans réseau, l'application n'affiche plus une erreur : elle montre le
// dernier état connu, relu du disque. C'est nettement mieux qu'un écran
// mort — mais ça devient trompeur si rien ne le dit. Quelqu'un qui cherche
// où il a rangé une perceuse doit pouvoir distinguer « elle est là » de
// « elle y était la dernière fois que j'avais du réseau ».
//
// EN HAUT, ET DANS LE FLUX. Il était en bas, juste au-dessus de la barre
// d'onglets — c'est-à-dire exactement là où se pose le bouton « Demande à
// Céoù » de l'accueil, qu'il masquait. Signalé à l'usage.
//
// Dans le FLUX et non en surimpression : posé par-dessus, il aurait recouvert
// le haut de l'en-tête natif des fiches, donc le titre et la flèche de retour.
// Il pousse donc le reste vers le bas, et ne cache jamais rien. C'est aussi
// pour ça qu'il porte lui-même l'encart de barre d'état : il est le premier
// élément peint, il n'y a plus personne au-dessus pour s'en charger.
export function OfflineBanner() {
  const offline = useIsOffline();
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  if (!offline) return null;

  return (
    <View
      className="flex-row items-center justify-center gap-2 border-b border-ink/10 bg-sand-dark px-4 pb-2"
      style={{ paddingTop: insets.top + 8 }}
      // Annoncé comme une alerte : c'est un changement d'état de
      // l'application, pas un élément de la page qu'on parcourt.
      accessibilityRole="alert"
      accessibilityLabel={`${t('network.offline')} ${t('network.offline_hint')}`}
    >
      <Icon name="alert" size={16} color={colors.inkSoft} />
      <Text numberOfLines={2} className="shrink text-caption text-ink-soft">
        <Text className="font-semibold">{t('network.offline')}</Text>
        {' — '}
        {t('network.offline_hint')}
      </Text>
    </View>
  );
}
