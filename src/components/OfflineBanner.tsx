import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsOffline } from '../lib/network';
import { readSyncFailures, SYNC_FAILURES_KEY, type SyncFailure } from '../lib/syncFailures';
import { useThemeColors } from '../lib/theme';
import { BottomSheetModal } from './BottomSheetModal';
import { Icon } from './Icon';
import { SyncFailuresSheetContent } from './SyncFailuresSheet';

/**
 * Les échecs d'envoi, en lecture réactive.
 *
 * `queryFn` se contente de relire ce que le cache contient déjà : la liste
 * n'est pas une donnée serveur, elle est écrite par `recordSyncFailure`. Elle
 * n'existe que pour donner un état de départ vide au premier rendu, et pour
 * qu'un rafraîchissement égaré reste sans effet — il rendrait exactement ce
 * qui s'y trouve.
 */
export function useSyncFailures(): SyncFailure[] {
  const { data } = useQuery({
    queryKey: SYNC_FAILURES_KEY,
    queryFn: ({ client }) => readSyncFailures(client),
    staleTime: Infinity,
  });
  return data ?? [];
}

/**
 * Y a-t-il un bandeau en haut de l'écran, quel qu'il soit ?
 *
 * Le layout doit le savoir pour ne pas compter DEUX FOIS l'encart de barre
 * d'état : le bandeau le porte déjà. La question n'est plus « est-on
 * hors-ligne », depuis que la bande rouge des échecs s'affiche aussi EN
 * LIGNE — sans quoi un vide de la hauteur de la barre d'état s'ouvrirait
 * juste en dessous.
 */
export function useHasTopBanner(): boolean {
  const offline = useIsOffline();
  const failures = useSyncFailures();
  return offline || failures.length > 0;
}

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
//
// ═══ IL PORTE DEUX MESSAGES, ET L'ÉCHEC PASSE DEVANT ═══
//
// « Hors ligne » est une information : le réseau reviendra tout seul, il n'y
// a rien à faire. Une écriture REFUSÉE est le contraire — c'est du travail
// perdu si personne ne s'en occupe, et ça ne se répare pas tout seul. Quand
// les deux sont vrais en même temps, ce qui arrive à chaque fois que le
// réseau retombe juste après un refus, c'est donc l'échec qui s'affiche.
//
// UN SEUL BANDEAU, JAMAIS DEUX EMPILÉS : superposés, ils repousseraient
// l'en-tête de deux hauteurs et le second serait pris pour un doublon.
export function OfflineBanner() {
  const offline = useIsOffline();
  const failures = useSyncFailures();
  const [sheetOpen, setSheetOpen] = useState(false);
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  // LA FEUILLE EST RENDUE DANS LES TROIS CAS, y compris quand il n'y a plus
  // rien à montrer, et ça se voit à l'usage : rendue seulement à l'intérieur
  // du bandeau rouge, elle disparaissait D'UN COUP à l'abandon du dernier
  // échec — le bandeau s'effaçait, emportant la modale avant que son
  // animation de sortie ait pu commencer.
  const sheet = (
    <BottomSheetModal
      visible={sheetOpen && failures.length > 0}
      onClose={() => setSheetOpen(false)}
      sheetClassName="rounded-t-3xl bg-surface px-6 pb-6 pt-6"
      scrollable
    >
      <SyncFailuresSheetContent failures={failures} />
    </BottomSheetModal>
  );

  if (failures.length > 0) {
    const count = failures.length;

    return (
      <>
        <Pressable
          onPress={() => setSheetOpen(true)}
          className="flex-row items-center justify-center gap-2 border-b border-ink/10 bg-danger px-4 pb-2 active:opacity-80"
          style={{ paddingTop: insets.top + 8 }}
          // Un BOUTON et pas une alerte, contrairement au bandeau hors-ligne :
          // celui-ci se touche, et son seul intérêt est qu'on le touche.
          accessibilityRole="button"
          accessibilityLabel={`${t('sync.banner', { count })} — ${t('sync.banner_hint')}`}
        >
          <Icon name="alert" size={16} color="#fff" />
          <Text numberOfLines={2} className="shrink text-caption text-white">
            <Text className="font-semibold">{t('sync.banner', { count })}</Text>
            {' — '}
            {t('sync.banner_hint')}
          </Text>
        </Pressable>
        {sheet}
      </>
    );
  }

  if (!offline) return sheet;

  return (
    <>
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
      {sheet}
    </>
  );
}
