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
import { useSession } from '../../src/features/auth/SessionProvider';
import { pickAndUploadAvatar } from '../../src/features/profile/uploadAvatar';
import { useProfile, useUpdateProfile } from '../../src/features/profile/useProfile';
import { formatFriendCodeQrValue } from '../../src/features/sharing/queries';
import { ShareInviteModal } from '../../src/features/sharing/ShareInviteModal';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../../src/lib/i18n';
import { supabase } from '../../src/lib/supabase/client';

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { session } = useSession();
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
    <ScrollView className="flex-1 bg-sand" contentContainerClassName="px-6 pt-16 pb-40">
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

      <Text className="mb-2 mt-8 text-sm font-medium text-ink-soft">{t('friends.my_code.title')}</Text>
      <Pressable
        onPress={() => setMyCodeOpen((current) => !current)}
        className="flex-row items-center justify-between rounded-xl border border-ink/10 bg-sand-dark px-4 py-3"
      >
        <Text className="text-base font-bold tracking-widest text-ink">{profile?.friend_code}</Text>
        <Icon name={myCodeOpen ? 'excluded' : 'qrcode'} size={20} color="#6B6459" />
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

      {/* Adresse, mot de passe et suppression vivent sur un écran à part :
          cet écran-ci porte l'identité PUBLIQUE (nom affiché, avatar, code
          ami, langue), pas les clés d'accès. */}
      <TextLink
        href="/account"
        label={t('account.entry')}
        className="mt-8 items-center rounded-2xl border border-ink/10 bg-white px-4 py-3"
        textClassName="text-sm font-semibold text-ink"
      />

      {/* La carte ELLE-MÊME est le bouton : c'était un View inerte dont seul
          le texte réagissait — le défaut signalé par les testeurs. */}
      <TextLink
        href="/privacy-policy"
        label={t('profile.privacy_policy')}
        className="mt-3 items-center rounded-2xl border border-ink/10 bg-white px-4 py-3"
        textClassName="text-sm font-medium text-ink-soft underline"
      />

      <TextLink
        onPress={() => supabase.auth.signOut()}
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
