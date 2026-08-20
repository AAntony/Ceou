import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Button } from '../src/components/Button';
import { TextField } from '../src/components/TextField';
import { TextLink } from '../src/components/TextLink';
import { isPasswordValid } from '../src/features/auth/validation';
import { authRedirectUrl } from '../src/lib/supabase/authRedirect';
import { supabase } from '../src/lib/supabase/client';

// Transformation d'une session VISITEUR en vrai compte.
//
// ⚠️ NE JAMAIS remplacer cet écran par l'inscription classique
// (app/(auth)/sign-up.tsx). C'est toute la raison d'être du fichier :
//
//   - `signUp()` crée un NOUVEL utilisateur, donc un nouvel identifiant. Les
//     lignes de share_invite_redemptions restent attachées à l'ancien
//     identifiant anonyme, et le visiteur PERD tous les accès qu'on lui a
//     partagés — il devrait redemander son code à son hôte.
//   - `updateUser({ email, password })` attache une identité à la session
//     anonyme EXISTANTE. L'identifiant ne bouge pas, donc les accès reçus par
//     code survivent sans aucune migration de données.
//
// C'est exactement ce que demande la specification : « lorsqu'il se connecte,
// il doit voir l'habitation partagée avec lui plus tôt quand il était en
// compte invité, pour éviter d'avoir à renseigner le code une nouvelle fois ».

// Messages bruts de Supabase traduits ici : c'est l'entonnoir de conversion
// d'un visiteur en utilisateur, un message anglais et technique y coûte cher.
//
// `validation_failed` couvre notamment le refus observé en test réel :
// « Updating password of an anonymous user without an email or phone is not
// allowed ». C'est la raison pour laquelle cet écran envoie e-mail ET mot de
// passe DANS LE MÊME appel — les séparer ferait échouer le mot de passe.
const ERROR_KEYS: Record<string, string> = {
  email_address_invalid: 'guest.upgrade.errors.email_invalid',
  email_exists: 'guest.upgrade.errors.email_taken',
  user_already_exists: 'guest.upgrade.errors.email_taken',
  validation_failed: 'guest.upgrade.errors.validation',
  over_email_send_rate_limit: 'guest.upgrade.errors.rate_limit',
};

function upgradeErrorMessage(error: { code?: string; message: string }): string | null {
  return error.code ? (ERROR_KEYS[error.code] ?? null) : null;
}

export default function UpgradeAccountScreen() {
  const { t, i18n } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

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
    const { error: updateError } = await supabase.auth.updateUser(
      { email: email.trim(), password },
      { emailRedirectTo: authRedirectUrl('signup', i18n.language) },
    );
    setLoading(false);

    if (updateError) {
      const key = upgradeErrorMessage(updateError);
      setError(key ? t(key) : updateError.message);
      return;
    }

    setSent(true);
  };

  if (sent) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: t('guest.upgrade.title') }} />
        <View className="flex-1 justify-center bg-sand px-6">
          <Text className="mb-3 text-2xl font-bold text-ink">{t('guest.upgrade.sent_title')}</Text>
          {/* Le compte reste EN MODE VISITEUR tant que l'adresse n'est pas
              confirmée : Supabase ne bascule is_anonymous à false qu'après le
              clic dans l'e-mail. Le dire evite de croire a un echec en voyant
              le bandeau invité toujours présent. */}
          <Text className="mb-8 text-base leading-6 text-ink-soft">
            {t('guest.upgrade.sent_body', { email: email.trim() })}
          </Text>
          <Button label={t('common.close')} onPress={() => router.back()} />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t('guest.upgrade.title') }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-sand">
        <ScrollView contentContainerClassName="flex-1 justify-center px-6" keyboardShouldPersistTaps="handled">
          <Text className="mb-2 text-3xl font-bold text-ink">{t('guest.upgrade.title')}</Text>
          <Text className="mb-8 text-base leading-6 text-ink-soft">{t('guest.upgrade.description')}</Text>

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

          <Button
            label={t('guest.upgrade.submit')}
            onPress={handleSubmit}
            loading={loading}
            disabled={!email.trim() || !password || !confirmPassword}
          />

          <Text className="mt-4 text-center text-xs leading-4 text-ink-soft">{t('guest.upgrade.keeps_access')}</Text>

          <Text className="mt-6 text-center text-xs text-ink-soft">
            {t('auth.sign_up.privacy_notice')}{' '}
          </Text>
          <TextLink
            href="/privacy-policy"
            label={t('profile.privacy_policy')}
            className="items-center"
            textClassName="text-center text-xs font-semibold text-ink-soft underline"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
