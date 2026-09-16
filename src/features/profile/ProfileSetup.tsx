import { unregisterPushToken } from '../notifications/push';
import { cancelAllInviteReminders } from '../notifications/inviteReminders';
import { cancelAllLoanReminders } from '../notifications/loanReminders';
import { cancelAllWarrantyReminders } from '../notifications/warrantyReminders';
import { usePathname } from 'expo-router';
import { Image } from 'expo-image';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { CeouAvatar } from '../../components/CeouAvatar';
import { TextField } from '../../components/TextField';
import { useSession } from '../auth/SessionProvider';
import { useMediaSource } from '../../lib/images/media';
import { useProfile, useUpdateProfile } from './useProfile';
import { pickAndUploadAvatar } from './uploadAvatar';
import { needsProfileSetup } from './setupRules';
import { supabase } from '../../lib/supabase/client';

export function ProfileSetup() {
  const { session } = useSession();
  const pathname = usePathname();
  const { data: profile } = useProfile();
  if (!session || !profile || !needsProfileSetup({ signedIn: true, anonymous: !!session.user.is_anonymous,
    profileLoaded: true, name: profile.display_name, pathname })) return null;
  return <SetupForm key={session.user.id} userId={session.user.id} initialAvatar={profile.avatar_url} initialName={typeof session.user.user_metadata?.display_name === 'string' ? session.user.user_metadata.display_name : ''} />;
}

function SetupForm({ userId, initialAvatar, initialName }: { userId: string; initialAvatar: string | null; initialName: string }) {
  const { t } = useTranslation();
  const [name, setName] = useState(initialName.slice(0, 50));
  const [avatarUrl, setAvatarUrl] = useState(initialAvatar);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(false);
  const update = useUpdateProfile();
  const photo = useMediaSource(avatarUrl);
  const save = async () => {
    if (!name.trim() || uploading || update.isPending) return;
    setError(false);
    try { await update.mutateAsync({ display_name: name.trim(), avatar_url: avatarUrl }); }
    catch { setError(true); }
  };
  const choosePhoto = async () => {
    setUploading(true); setError(false);
    try { const url = await pickAndUploadAvatar(userId); if (url) setAvatarUrl(url); }
    catch { setError(true); }
    finally { setUploading(false); }
  };
  return <Modal visible animationType="fade" onRequestClose={() => {}}>
    <KeyboardAvoidingView className="flex-1 bg-sand" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, paddingVertical: 56 }} keyboardShouldPersistTaps="handled">
        <Text accessibilityRole="header" className="mb-3 text-title font-bold text-ink">{t('profile.setup.title')}</Text>
        <Text className="mb-6 text-body text-ink-soft">{t('profile.setup.hint')}</Text>
        <View className="mb-3 self-center overflow-hidden rounded-full" accessible accessibilityLabel={t('profile.setup.avatar')}>
          {photo ? <Image source={photo} style={{ width: 100, height: 100 }} /> : <CeouAvatar size={100} />}
        </View>
        <Button label={t('profile.avatar.change')} variant="ghost" onPress={choosePhoto} loading={uploading} disabled={update.isPending} />
        <Text className="mb-6 text-center text-caption text-ink-soft">{t('profile.setup.photo_hint')}</Text>
        <TextField label={t('profile.setup.name')} value={name} onChangeText={setName} maxLength={50} autoCapitalize="words" autoComplete="nickname" editable={!update.isPending} />
        {error ? <Text accessibilityRole="alert" className="mb-3 text-label text-danger">{t('profile.setup.error')}</Text> : null}
        <Button label={t('profile.setup.continue')} onPress={save} disabled={!name.trim() || uploading} loading={update.isPending} />
        <View className="mt-4"><Button label={t('profile.sign_out')} variant="ghost" disabled={uploading || update.isPending} onPress={async () => { try { await unregisterPushToken(); await cancelAllInviteReminders(); await cancelAllLoanReminders(); await cancelAllWarrantyReminders(); await supabase.auth.signOut(); } catch { setError(true); } }} /></View>
      </ScrollView>
    </KeyboardAvoidingView>
  </Modal>;
}
