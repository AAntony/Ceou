import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Button } from '../../src/components/Button';
import { TextField } from '../../src/components/TextField';
import { useSession } from '../../src/features/auth/SessionProvider';
import { pickAndUploadAvatar } from '../../src/features/profile/uploadAvatar';
import { useProfile, useUpdateProfile } from '../../src/features/profile/useProfile';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../../src/lib/i18n';
import { supabase } from '../../src/lib/supabase/client';

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { session } = useSession();
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();

  const [displayName, setDisplayName] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [saved, setSaved] = useState(false);

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

      <Pressable onPress={() => supabase.auth.signOut()} className="mt-12">
        <Text className="text-center text-sm font-semibold text-red-600">{t('profile.sign_out')}</Text>
      </Pressable>
    </ScrollView>
  );
}
