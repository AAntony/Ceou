import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { supabase } from '../../lib/supabase/client';
import { useGuestAccessStatus } from './guestAccess';
import { useIsAnonymous } from './SessionProvider';

/**
 * Vrai quand la personne est un visiteur dont le code ne donne plus rien.
 * Exposé à part : l'écran Habitations doit pouvoir remplacer son état vide
 * par l'explication, sans afficher pour autant le bandeau de l'accueil.
 */
export function useGuestAccessLost() {
  const isGuest = useIsAnonymous();
  const { data } = useGuestAccessStatus(isGuest);
  const status = data?.status;
  return {
    lost: status === 'expired' || status === 'revoked',
    expired: status === 'expired',
    expiresAt: data?.expiresAt ?? null,
  };
}

/**
 * L'explication d'un accès éteint.
 *
 * SANS ELLE L'APP SE CONTENTE DE SE VIDER. L'accès d'un invité est dérivé de
 * son code : il s'éteint tout seul à la date prévue, ou à la seconde où
 * l'hôte supprime le code. Rien ne se passe côté visiteur — pas de
 * déconnexion, pas d'erreur — ses écrans deviennent simplement vides, ce qui
 * ressemble beaucoup plus à une panne qu'à une fin d'accès.
 */
export function GuestAccessLostCard() {
  const { t } = useTranslation();
  const { expired, expiresAt } = useGuestAccessLost();

  const message = expired
    ? t('guest.access_lost.expired_message', {
        date: expiresAt ? new Date(expiresAt).toLocaleDateString() : '',
      })
    : t('guest.access_lost.revoked_message');

  return (
    <View className="mb-6 rounded-2xl border border-coral/40 bg-coral-light px-4 py-3">
      <View className="flex-row items-center gap-2">
        <Icon name="alert" size={18} color="#E2571F" />
        <Text className="flex-1 text-sm font-semibold text-ink">
          {expired ? t('guest.access_lost.expired_title') : t('guest.access_lost.revoked_title')}
        </Text>
      </View>
      <Text className="mt-1.5 text-xs leading-4 text-ink-soft">{message}</Text>

      {/* La seule porte de sortie : un visiteur n'a pas d'écran de connexion
          tant qu'il reste sur sa session anonyme, et c'est de là que se
          saisit un nouveau code. */}
      <Pressable onPress={() => supabase.auth.signOut({ scope: 'local' })} className="mt-2 self-start py-1">
        <Text className="text-xs font-semibold text-red-600">{t('guest.leave')}</Text>
      </Pressable>
    </View>
  );
}

/**
 * Bandeau visiteur de l'accueil : dit ce qu'on peut faire, ou pourquoi on ne
 * peut plus rien faire. Un seul composant pour les deux, parce que les deux
 * messages ne doivent JAMAIS coexister — « tu vois ce qui t'a été partagé »
 * au-dessus d'un écran vide est précisément ce qu'on corrige ici.
 */
export function GuestBanner() {
  const { t } = useTranslation();
  const { lost } = useGuestAccessLost();

  if (lost) return <GuestAccessLostCard />;

  // Un visiteur n'a AUCUNE donnee a lui dans l'app (la RLS lui refuse toute
  // ecriture), donc pas de "cree un compte pour ne rien perdre" ici -- il n'a
  // rien a perdre, et lui dire le contraire serait faux.
  return (
    <View className="mb-6 flex-row items-center gap-2 rounded-2xl border border-teal/40 bg-teal/10 px-4 py-3">
      <Icon name="profile" size={18} color="#2EC4B6" />
      <Text className="flex-1 text-xs leading-4 text-ink-soft">{t('guest.banner')}</Text>
    </View>
  );
}
