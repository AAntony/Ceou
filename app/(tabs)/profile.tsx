import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { Button } from '../../src/components/Button';
import { ErrorState } from '../../src/components/ErrorState';
import { Icon } from '../../src/components/Icon';
import { QrCode } from '../../src/components/QrCode';
import { TextField } from '../../src/components/TextField';
import { TextLink } from '../../src/components/TextLink';
import { usePullToRefresh } from '../../src/components/usePullToRefresh';
import { GuestProfile } from '../../src/features/auth/GuestProfile';
import { DisplaySettings } from '../../src/features/profile/DisplaySettings';
import { useIsAnonymous, useSession } from '../../src/features/auth/SessionProvider';
import { cancelAllInviteReminders } from '../../src/features/notifications/inviteReminders';
import { cancelAllLoanReminders } from '../../src/features/notifications/loanReminders';
import { OnboardingGuide } from '../../src/features/onboarding/OnboardingGuide';
import { unregisterPushToken } from '../../src/features/notifications/push';
import { pickAndUploadAvatar } from '../../src/features/profile/uploadAvatar';
import { useProfile, useUpdateProfile } from '../../src/features/profile/useProfile';
import { formatFriendCodeQrValue } from '../../src/features/sharing/queries';
import { ShareInviteModal } from '../../src/features/sharing/ShareInviteModal';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../../src/lib/i18n';
import { useScaled } from '../../src/lib/textScale';
import { supabase } from '../../src/lib/supabase/client';
import { useThemeColors } from '../../src/lib/theme';

export default function ProfileScreen() {
  const refreshControl = usePullToRefresh();
  const colors = useThemeColors();
  // La pastille d'avatar est dessinee en pixels (image ronde recadree), donc
  // hors de portee de `rem` : elle est mise a l'echelle a la main pour ne pas
  // rester une vignette au milieu d'un ecran agrandi.
  const avatarSize = useScaled(96);
  const { t, i18n } = useTranslation();
  const { session } = useSession();
  const isGuest = useIsAnonymous();
  const { data: profile, isLoading, isError, refetch } = useProfile();
  const updateProfile = useUpdateProfile();

  const [displayName, setDisplayName] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [myCodeOpen, setMyCodeOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    if (profile) setDisplayName(profile.display_name ?? '');
  }, [profile]);

  const handleSave = async () => {
    setSaved(false);
    await updateProfile.mutateAsync({ display_name: displayName });
    setSaved(true);
  };

  const handleLanguageChange = async (language: SupportedLanguage) => {
    await i18n.changeLanguage(language);
    updateProfile.mutate({ locale: language });
  };

  // Le code ami se dicte aussi bien qu'il se scanne : quelqu'un qui n'est pas
  // dans la pièce a besoin de le recevoir par message. C'est ce que promettait
  // « Partager mon code », qui envoyait en réalité un tout autre code.
  const handleShareFriendCode = async () => {
    if (!profile?.friend_code) return;
    try {
      await Share.share({ message: t('friends.my_code.share_message', { code: profile.friend_code }) });
    } catch {
      // Feuille de partage simplement refermée — rien à faire.
    }
  };

  const handleAvatarPress = async () => {
    if (!session) return;
    setAvatarUploading(true);
    try {
      const avatarUrl = await pickAndUploadAvatar(session.user.id);
      if (avatarUrl) updateProfile.mutate({ avatar_url: avatarUrl });
    } finally {
      setAvatarUploading(false);
    }
  };

  // Un visiteur n’a ni nom affiche, ni avatar, ni code ami : le Profil normal
  // lui presenterait une fiche vide. Il obtient a la place une presentation de
  // Ceou et une invitation a creer un compte. Place APRES tous les hooks pour
  // ne pas changer leur ordre d’appel d’un rendu a l’autre.
  if (isGuest) return <GuestProfile />;

  if (isError) {
    return (
      <View className="flex-1 bg-sand">
        <ErrorState onRetry={() => refetch()} />
      </View>
    );
  }

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-sand">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-sand" contentContainerClassName="px-6 pt-16 pb-40" refreshControl={refreshControl}>
      <Pressable accessibilityRole="button" onPress={handleAvatarPress} className="mb-8 items-center">
        <View
          className="items-center justify-center overflow-hidden rounded-full bg-sand-dark"
          style={{ width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }}
        >
          {avatarUploading ? (
            <ActivityIndicator />
          ) : profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={{ width: avatarSize, height: avatarSize }} />
          ) : (
            <Text className="text-display font-semibold text-ink-soft">
              {(displayName || session?.user.email || '?').charAt(0).toUpperCase()}
            </Text>
          )}
        </View>
        <Text className="mt-2 text-label font-medium text-ink-soft">{t('profile.avatar.change')}</Text>
      </Pressable>

      <TextField label={t('profile.display_name')} value={displayName} onChangeText={setDisplayName} />

      {saved ? <Text className="mb-4 text-label text-green-600">{t('profile.saved')}</Text> : null}

      <Button label={t('common.save')} onPress={handleSave} loading={updateProfile.isPending} />

      <Text className="mb-2 mt-8 text-label font-medium text-ink-soft">{t('profile.language')}</Text>
      <View className="flex-row gap-2">
        {SUPPORTED_LANGUAGES.map((language) => (
          <Pressable
            accessibilityRole="button"
            key={language}
            onPress={() => handleLanguageChange(language)}
            className={`rounded-xl border px-4 py-2 ${
              i18n.language === language ? 'border-coral bg-coral' : 'border-ink/10'
            }`}
          >
            <Text className={i18n.language === language ? 'font-semibold text-white' : 'text-ink-soft'}>
              {language.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </View>

      <View className="mt-8">
        <DisplaySettings />
      </View>

      {/* Le guide de démarrage se rejoue à volonté. Il n'est pas rangé avec
          les liens de bas de page (Compte, Confidentialité) : ce n'est pas
          une mention légale, c'est la porte de secours de quelqu'un qui ne
          sait plus comment on range — elle doit se voir. */}
      <Pressable
        accessibilityRole="button"
        onPress={() => setGuideOpen(true)}
        className="mt-8 flex-row items-center gap-3 rounded-2xl border border-ink/10 bg-surface px-4 py-3 active:opacity-70"
      >
        <Icon name="guide" size={22} color={colors.accentDark} />
        <View className="flex-1">
          <Text className="text-label font-semibold text-ink">{t('onboarding.replay')}</Text>
          <Text className="mt-0.5 text-caption text-ink-soft">{t('onboarding.entry_hint')}</Text>
        </View>
        <Icon name="chevron" size={20} color={colors.inkFaint} />
      </Pressable>

      {/* Le code ami et le code d'invité sont deux choses différentes, donc
          deux sections distinctes. Réunis sous un même bouton « Partager mon
          code », ils produisaient un code d'ami que personne ne pouvait
          saisir à la main — le défaut corrigé le 26/08. */}
      <Text className="mb-1 mt-8 text-label font-medium text-ink-soft">{t('friends.my_code.title')}</Text>
      <Text className="mb-2 text-caption leading-4 text-ink-soft">{t('friends.my_code.subtitle')}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => setMyCodeOpen((current) => !current)}
        className="flex-row items-center justify-between rounded-xl border border-ink/10 bg-sand-dark px-4 py-3"
      >
        <Text className="text-body font-bold tracking-widest text-ink">{profile?.friend_code}</Text>
        <Icon name={myCodeOpen ? 'excluded' : 'qrcode'} size={20} color={colors.inkSoft} />
      </Pressable>
      {myCodeOpen && profile ? (
        <View className="mt-3 items-center">
          <QrCode value={formatFriendCodeQrValue(profile.friend_code)} size={160} />
          <Text className="mt-2 text-center text-caption text-ink-soft">{t('friends.my_code.hint')}</Text>
        </View>
      ) : null}

      <View className="mt-3">
        <Button label={t('friends.my_code.share')} variant="outline" onPress={handleShareFriendCode} />
      </View>

      <Text className="mb-1 mt-8 text-label font-medium text-ink-soft">{t('friends.share.section_title')}</Text>
      <Text className="mb-2 text-caption leading-4 text-ink-soft">{t('friends.share.section_hint')}</Text>
      <Button label={t('friends.share.entry')} variant="outline" onPress={() => setShareModalOpen(true)} />

      {/* Nécessaire dès lors qu'un code peut être permanent et multi-usage :
          un code éphémère à usage unique se gérait tout seul en expirant, un
          QR laissé affiché dans un logement demande de pouvoir savoir qui
          l'a utilisé et de le couper. */}
      <TextLink
        href="/invites"
        label={t('invites.entry')}
        className="mt-3 items-center rounded-2xl border border-ink/10 bg-surface px-4 py-3"
        textClassName="text-label font-semibold text-ink"
      />

      {/* Adresse, mot de passe et suppression vivent sur un écran à part :
          cet écran-ci porte l'identité PUBLIQUE (nom affiché, avatar, code
          ami, langue), pas les clés d'accès. */}
      <TextLink
        href="/account"
        label={t('account.entry')}
        className="mt-8 items-center rounded-2xl border border-ink/10 bg-surface px-4 py-3"
        textClassName="text-label font-semibold text-ink"
      />

      {/* La carte ELLE-MÊME est le bouton : c'était un View inerte dont seul
          le texte réagissait — le défaut signalé par les testeurs. */}
      <TextLink
        href="/privacy-policy"
        label={t('profile.privacy_policy')}
        className="mt-3 items-center rounded-2xl border border-ink/10 bg-surface px-4 py-3"
        textClassName="text-label font-medium text-ink-soft underline"
      />

      <TextLink
        onPress={async () => {
          // Détache l'appareil AVANT de perdre la session : la suppression
          // du jeton passe par la RLS (`user_id = auth.uid()`), elle
          // échouerait silencieusement une fois déconnecté — et le compte
          // continuerait de recevoir les notifications de ce téléphone.
          await unregisterPushToken();
          // Les rappels sont programmés sur l'appareil : sans ce ménage,
          // celui d'un code du compte précédent surgirait chez la personne
          // suivante, en nommant une Habitation qui ne la concerne pas.
          await cancelAllInviteReminders();
          await cancelAllLoanReminders();
          await supabase.auth.signOut();
        }}
        label={t('profile.sign_out')}
        className="mt-6"
        textClassName="text-center text-label font-semibold text-red-600"
      />

      {/* Le numéro "1.0.0" seul ne bouge presque jamais — le hash de commit
          (injecté par app.config.js à chaque bundle/build) est ce qui
          permet réellement de savoir quelle version est en train de tourner
          sur un appareil de test. */}
      <Text className="mt-10 text-center text-caption text-ink-soft">
        {t('profile.version_label')} {Constants.expoConfig?.version ?? '?'} ({Constants.expoConfig?.extra?.gitCommit ?? '?'})
      </Text>

      <ShareInviteModal visible={shareModalOpen} onClose={() => setShareModalOpen(false)} />

      <OnboardingGuide visible={guideOpen} onClose={() => setGuideOpen(false)} />
    </ScrollView>
  );
}
