import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, Text } from 'react-native';
import { Button } from '../src/components/Button';
import { TextField } from '../src/components/TextField';
import { useSession } from '../src/features/auth/SessionProvider';
import { isPasswordValid } from '../src/features/auth/validation';
import { supabase } from '../src/lib/supabase/client';

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const { session, isLoading } = useSession();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isLoading && !session) return <Redirect href="/(auth)/login" />;

  const handleSubmit = async () => {
    setError(null);
    if (!isPasswordValid(password)) {
      setError(t('auth.errors.password_too_short'));
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) setError(updateError.message);
    else router.replace('/(tabs)');
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-sand">
      <ScrollView contentContainerClassName="flex-1 justify-center px-6" keyboardShouldPersistTaps="handled">
        <Text className="mb-8 text-display font-bold text-ink">{t('auth.reset_password.title')}</Text>

        <TextField
          label={t('auth.reset_password.new_password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="newPassword"
        />

        {error ? <Text className="mb-4 text-label text-danger">{error}</Text> : null}

        <Button label={t('auth.reset_password.submit')} onPress={handleSubmit} loading={loading} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
