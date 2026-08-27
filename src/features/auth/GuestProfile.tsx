import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { Icon, type IconName } from '../../components/Icon';
import { TextLink } from '../../components/TextLink';
import { DisplaySettings } from '../profile/DisplaySettings';
import { supabase } from '../../lib/supabase/client';

// Écran Profil d'un VISITEUR (session anonyme).
//
// Un visiteur n'a ni nom affiché, ni avatar, ni code ami, ni langue
// enregistrée en base — lui présenter les mêmes champs qu'à un utilisateur
// connecté afficherait une fiche vide et sans objet. Cet écran prend donc
// entièrement la place du Profil normal : il explique ce qu'est Ceou et
// propose de créer un compte.
//
// Le bouton mène à /upgrade-account et NON à l'inscription classique : voir
// le commentaire de cet écran, la distinction n'est pas cosmétique (elle
// décide si le visiteur conserve ou perd les accès qu'on lui a partagés).

const SELLING_POINTS: { icon: IconName; key: string }[] = [
  { icon: 'search', key: 'guest.pitch.search' },
  { icon: 'habitations', key: 'guest.pitch.organise' },
  { icon: 'plan', key: 'guest.pitch.plan' },
  { icon: 'friends', key: 'guest.pitch.share' },
];

export function GuestProfile() {
  const { t } = useTranslation();

  return (
    <ScrollView className="flex-1 bg-sand" contentContainerClassName="px-6 pb-32 pt-12">
      <View className="items-center">
        <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-coral-light">
          <Icon name="location" size={40} color="#1591EA" />
        </View>
        <Text className="text-display font-bold text-ink">{t('app_name')}</Text>
        <Text className="mt-2 text-center text-body leading-6 text-ink-soft">{t('guest.pitch.tagline')}</Text>
      </View>

      <View className="mt-8 rounded-2xl border border-ink/10 bg-surface p-5">
        {SELLING_POINTS.map((point, index) => (
          <View key={point.key} className={`flex-row items-start gap-3 ${index > 0 ? 'mt-4' : ''}`}>
            <View className="mt-0.5 h-8 w-8 items-center justify-center rounded-full bg-coral-light">
              <Icon name={point.icon} size={18} color="#1591EA" />
            </View>
            <Text className="flex-1 text-label leading-5 text-ink-soft">{t(point.key)}</Text>
          </View>
        ))}
      </View>

      <View className="mt-8">
        <Button label={t('guest.upgrade.entry')} onPress={() => router.push('/upgrade-account')} />
      </View>

      {/* Argument décisif et vrai : l'identifiant du compte ne change pas
          lors de la conversion, donc les accès reçus par code survivent. Le
          dire ici évite au visiteur de croire qu'il devra redemander le code
          à son hôte. */}
      <Text className="mt-3 text-center text-caption leading-4 text-ink-soft">{t('guest.upgrade.keeps_access')}</Text>

      <View className="mt-10">
        <DisplaySettings />
      </View>

      <TextLink
        href="/privacy-policy"
        label={t('profile.privacy_policy')}
        className="mt-10 items-center"
        textClassName="text-center text-label text-ink-soft underline"
      />

      {/* Quitter le mode invité perd l'accès : le libellé le dit, et c'est
          volontairement le lien le plus discret de l'écran. */}
      <Pressable accessibilityRole="button" onPress={() => supabase.auth.signOut({ scope: 'local' })} className="mt-6 py-2">
        <Text className="text-center text-label font-semibold text-danger">{t('guest.leave')}</Text>
      </Pressable>
    </ScrollView>
  );
}
