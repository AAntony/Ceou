import { Link } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Button } from '../../src/components/Button';
import { TextField } from '../../src/components/TextField';
import { supabase } from '../../src/lib/supabase/client';

export default function LoginScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) setError(signInError.message);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-sand">
      <ScrollView contentContainerClassName="flex-1 justify-center px-6" keyboardShouldPersistTaps="handled">
        <Text className="mb-8 text-3xl font-bold text-ink">{t('auth.login.title')}</Text>

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
          textContentType="password"
        />

        {error ? <Text className="mb-4 text-sm text-red-600">{error}</Text> : null}

        <Button label={t('auth.login.submit')} onPress={handleSubmit} loading={loading} />

        <Link href="/(auth)/forgot-password" className="mt-4 text-center text-sm text-ink-soft">
          {t('auth.login.forgot_password_link')}
        </Link>

        <View className="mt-8 flex-row justify-center gap-1">
          <Text className="text-sm text-ink-soft">{t('auth.login.no_account')}</Text>
          <Link href="/(auth)/sign-up" className="text-sm font-semibold text-ink">
            {t('auth.login.sign_up_link')}
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
