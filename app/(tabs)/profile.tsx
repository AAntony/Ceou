import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Button } from '../../src/components/Button';
import { ErrorState } from '../../src/components/ErrorState';
import { Icon } from '../../src/components/Icon';
import { QrCode } from '../../src/components/QrCode';
import { TextField } from '../../src/components/TextField';
import { TextLink } from '../../src/components/TextLink';
import { ThemeToggle } from '../../src/components/ThemeToggle';
import { usePullToRefresh } from '../../src/components/usePullToRefresh';
import { GuestProfile } from '../../src/features/auth/GuestProfile';
import { useIsAnonymous, useSession } from '../../src/features/auth/SessionProvider';
import { cancelAllInviteReminders } from '../../src/features/notifications/inviteReminders';
import { unregisterPushToken } from '../../src/features/notifications/push';
import { pickAndUploadAvatar } from '../../src/features/profile/uploadAvatar';
import { useProfile, useUpdateProfile } from '../../src/features/profile/useProfile';
import { formatFriendCodeQrValue } from '../../src/features/sharing/queries';
import { ShareInviteModal } from '../../src/features/sharing/ShareInviteModal';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../../src/lib/i18n';
import { supabase } from '../../src/lib/supabase/client';
import { useThemeColors } from '../../src/lib/theme';

export default function ProfileScreen() {
  const refreshControl = usePullToRefresh();
  const colors = useThemeColors();
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
      <Pressable onPress={handleAvatarPress} className="mb-8 items-center">
        <View className="h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-sand-dark">
          {avatarUploading ? (
            <ActivityIndicator />
          ) : profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={{ width: 96, height: 96 }} />
          ) : (
            <Text className="text-3xl font-semibold text-ink-soft">
              {(displayName || session?.user.email || '?').charAt(0).toUpperCase()}
            </Text>
          )}
        </View>
        <Text className="mt-2 text-sm font-medium text-ink-soft">{t('profile.avatar.change')}</Text>
      </Pressable>

      <TextField label={t('profile.display_name')} value={displayName} onChangeText={setDisplayName} />

      {saved ? <Text className="mb-4 text-sm text-green-600">{t('profile.saved')}</Text> : null}

      <Button label={t('common.save')} onPress={handleSave} loading={updateProfile.isPending} />

      <Text className="mb-2 mt-8 text-sm font-medium text-ink-soft">{t('profile.language')}</Text>
      <View className="flex-row gap-2">
        {SUPPORTED_LANGUAGES.map((language) => (
          <Pressable
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
        <ThemeToggle />
      </View>

      <Text className="mb-2 mt-8 text-sm font-medium text-ink-soft">{t('friends.my_code.title')}</Text>
      <Pressable
        onPress={() => setMyCodeOpen((current) => !current)}
        className="flex-row items-center justify-between rounded-xl border border-ink/10 bg-sand-dark px-4 py-3"
      >
        <Text className="text-base font-bold tracking-widest text-ink">{profile?.friend_code}</Text>
        <Icon name={myCodeOpen ? 'excluded' : 'qrcode'} size={20} color={colors.inkSoft} />
      </Pressable>
      {myCodeOpen && profile ? (
        <View className="mt-3 items-center">
          <QrCode value={formatFriendCodeQrValue(profile.friend_code)} size={160} />
          <Text className="mt-2 text-center text-xs text-ink-soft">{t('friends.my_code.hint')}</Text>
        </View>
      ) : null}

      <View className="mt-3">
        <Button label={t('friends.share.entry')} variant="outline" onPress={() => setShareModalOpen(true)} />
      </View>

      {/* Nécessaire dès lors qu'un code peut être permanent et multi-usage :
          un code éphémère à usage unique se gérait tout seul en expirant, un
          QR laissé affiché dans un logement demande de pouvoir savoir qui
          l'a utilisé et de le couper. */}
      <TextLink
        href="/invites"
        label={t('invites.entry')}
        className="mt-3 items-center rounded-2xl border border-ink/10 bg-surface px-4 py-3"
        textClassName="text-sm font-semibold text-ink"
      />

      {/* Adresse, mot de passe et suppression vivent sur un écran à part :
          cet écran-ci porte l'identité PUBLIQUE (nom affiché, avatar, code
          ami, langue), pas les clés d'accès. */}
      <TextLink
        href="/account"
        label={t('account.entry')}
        className="mt-8 items-center rounded-2xl border border-ink/10 bg-surface px-4 py-3"
        textClassName="text-sm font-semibold text-ink"
      />

      {/* La carte ELLE-MÊME est le bouton : c'était un View inerte dont seul
          le texte réagissait — le défaut signalé par les testeurs. */}
      <TextLink
        href="/privacy-policy"
        label={t('profile.privacy_policy')}
        className="mt-3 items-center rounded-2xl border border-ink/10 bg-surface px-4 py-3"
        textClassName="text-sm font-medium text-ink-soft underline"
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
          await supabase.auth.signOut();
        }}
        label={t('profile.sign_out')}
        className="mt-6"
        textClassName="text-center text-sm font-semibold text-red-600"
      />

      {/* Le numéro "1.0.0" seul ne bouge presque jamais — le hash de commit
          (injecté par app.config.js à chaque bundle/build) est ce qui
          permet réellement de savoir quelle version est en train de tourner
          sur un appareil de test. */}
      <Text className="mt-10 text-center text-xs text-ink-soft">
        {t('profile.version_label')} {Constants.expoConfig?.version ?? '?'} ({Constants.expoConfig?.extra?.gitCommit ?? '?'})
      </Text>

      <ShareInviteModal visible={shareModalOpen} onClose={() => setShareModalOpen(false)} />
    </ScrollView>
  );
}
