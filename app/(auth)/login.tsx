import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Button } from '../../src/components/Button';
import { TextField } from '../../src/components/TextField';
import { TextLink } from '../../src/components/TextLink';
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
        <Text className="mb-8 text-display font-bold text-ink">{t('auth.login.title')}</Text>

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

        {error ? <Text className="mb-4 text-label text-danger">{error}</Text> : null}

        <Button label={t('auth.login.submit')} onPress={handleSubmit} loading={loading} />

        <TextLink
          href="/(auth)/forgot-password"
          label={t('auth.login.forgot_password_link')}
          className="mt-4 items-center"
          textClassName="text-center text-label text-ink-soft"
        />

        {/* Seule porte d'entrée sans compte. Placée AVANT l'inscription :
            un visiteur qui vient de scanner le QR d'un hôte n'a aucune raison
            de créer un compte, et c'est précisément ce qu'il ferait s'il ne
            trouvait que « S'inscrire » sur cet écran. */}
        <TextLink
          href="/guest-invite"
          label={t('guest.entry')}
          className="mt-8 items-center rounded-2xl border border-ink/10 bg-surface px-4 py-3"
          textClassName="text-center text-label font-semibold text-ink"
        />

        {/* items-center : le lien a désormais une hauteur de cible minimale,
            sans quoi le texte voisin s'étirerait et se décalerait vers le haut. */}
        <View className="mt-6 flex-row flex-wrap items-center justify-center gap-1">
          <Text className="text-label text-ink-soft">{t('auth.login.no_account')}</Text>
          <TextLink
            href="/(auth)/sign-up"
            label={t('auth.login.sign_up_link')}
            className="px-1"
            textClassName="text-label font-semibold text-ink"
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
