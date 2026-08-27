import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, Text } from 'react-native';
import { Button } from '../../src/components/Button';
import { TextField } from '../../src/components/TextField';
import { TextLink } from '../../src/components/TextLink';
import { authRedirectUrl } from '../../src/lib/supabase/authRedirect';
import { supabase } from '../../src/lib/supabase/client';

export default function ForgotPasswordScreen() {
  const { t, i18n } = useTranslation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    // Linking.createURL() produisait un lien `ceou://` placé DIRECTEMENT
    // dans l'e-mail : beaucoup de clients de messagerie refusent d'ouvrir un
    // schéma non-http, et le lien y paraissait mort. On passe maintenant par
    // la page `welcome` (https, donc toujours cliquable), qui propose
    // ensuite un bouton vers `ceou://reset-password?code=...` — le lien
    // profond n'est plus ouvert par le client mail mais par le navigateur,
    // sur un geste explicite de l'utilisateur. useAuthDeepLinks le reçoit
    // exactement comme avant, rien à changer côté app.
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: authRedirectUrl('recovery', i18n.language),
    });
    setLoading(false);

    if (resetError) setError(resetError.message);
    else setSuccess(true);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-sand">
      <ScrollView contentContainerClassName="flex-1 justify-center px-6" keyboardShouldPersistTaps="handled">
        <Text className="mb-2 text-display font-bold text-ink">{t('auth.forgot_password.title')}</Text>

        {success ? (
          <Text className="mt-4 text-body text-ink-soft">{t('auth.forgot_password.success')}</Text>
        ) : (
          <>
            <Text className="mb-8 text-body text-ink-soft">{t('auth.forgot_password.description')}</Text>

            <TextField
              label={t('auth.email')}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              textContentType="emailAddress"
            />

            {error ? <Text className="mb-4 text-label text-danger">{error}</Text> : null}

            <Button label={t('auth.forgot_password.submit')} onPress={handleSubmit} loading={loading} />
          </>
        )}

        <TextLink
          href="/(auth)/login"
          label={t('auth.forgot_password.back_to_login')}
          className="mt-8 items-center"
          textClassName="text-center text-label font-semibold text-ink"
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
