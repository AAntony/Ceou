import { Link } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Button } from '../../src/components/Button';
import { TextField } from '../../src/components/TextField';
import { TextLink } from '../../src/components/TextLink';
import { isPasswordValid } from '../../src/features/auth/validation';
import { supabase } from '../../src/lib/supabase/client';

export default function SignUpScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    setError(null);

    if (!isPasswordValid(password)) {
      setError(t('auth.errors.password_too_short'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('auth.errors.passwords_mismatch'));
      return;
    }

    setLoading(true);
    const { error: signUpError } = await supabase.auth.signUp({ email, password });
    setLoading(false);

    if (signUpError) setError(signUpError.message);
    else setSuccess(true);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-sand">
      <ScrollView contentContainerClassName="flex-1 justify-center px-6" keyboardShouldPersistTaps="handled">
        <Text className="mb-8 text-3xl font-bold text-ink">{t('auth.sign_up.title')}</Text>

        {success ? (
          <Text className="text-base text-ink-soft">{t('auth.sign_up.success')}</Text>
        ) : (
          <>
            <TextField
              label={t('auth.email')}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              textContentType="emailAddress"
            />
            <TextField
              label={t('auth.password')}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="newPassword"
            />
            <TextField
              label={t('auth.confirm_password')}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              textContentType="newPassword"
            />

            {error ? <Text className="mb-4 text-sm text-red-600">{error}</Text> : null}

            <Button label={t('auth.sign_up.submit')} onPress={handleSubmit} loading={loading} />

            <Text className="mt-4 text-center text-xs text-ink-soft">
              {t('auth.sign_up.privacy_notice')}{' '}
              <Link href="/privacy-policy" className="font-semibold text-ink-soft underline">
                {t('profile.privacy_policy')}
              </Link>
            </Text>
          </>
        )}

        <View className="mt-8 flex-row items-center justify-center gap-1">
          <Text className="text-sm text-ink-soft">{t('auth.sign_up.has_account')}</Text>
          <TextLink
            href="/(auth)/login"
            label={t('auth.sign_up.login_link')}
            className="px-1"
            textClassName="text-sm font-semibold text-ink"
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
