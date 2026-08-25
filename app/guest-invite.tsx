import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Button } from '../src/components/Button';
import { TextField } from '../src/components/TextField';
import { TextLink } from '../src/components/TextLink';
import { redeemInviteAsGuest } from '../src/features/auth/guestAccess';
import { parseScannedCode } from '../src/features/sharing/queries';
import { QrScanner } from '../src/features/sharing/QrScanner';
import { rpcErrorCode } from '../src/features/sharing/rpcError';

// Entrée d'un visiteur par code d'invitation.
//
// Volontairement à la RACINE et non dans le groupe (auth) : ce dernier
// redirige vers (tabs) dès qu'une session existe, or ouvrir la session
// anonyme est la PREMIÈRE étape de cet écran. Placé dans (auth), il serait
// démonté en plein milieu de la consommation du code, avant même de savoir
// vers quelle Habitation envoyer le visiteur.

const ERROR_KEYS: Record<string, string> = {
  invite_not_found: 'guest.errors.not_found',
  invite_expired: 'guest.errors.expired',
  invite_exhausted: 'guest.errors.exhausted',
  cannot_redeem_own_invite: 'guest.errors.own_invite',
  invite_is_friend_type: 'guest.errors.friend_code',
  invite_already_redeemed: 'guest.errors.not_found',
};

export default function GuestInviteScreen() {
  const { t } = useTranslation();
  // Code pré-rempli quand on arrive par lien profond (QR scanné avec
  // l'appareil photo natif, puis bouton de la page web).
  const params = useLocalSearchParams<{ code?: string }>();
  const [code, setCode] = useState(params.code ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scannerVisible, setScannerVisible] = useState(false);

  // Une tentative automatique et une seule : sans ce garde, un échec
  // relancerait l'essai à chaque rendu, en boucle.
  const autoAttempted = useRef(false);

  const enter = useCallback(
    async (rawCode: string) => {
      const trimmed = rawCode.trim();
      if (!trimmed) return;

      setError(null);
      setLoading(true);
      try {
        const { habitationIds } = await redeemInviteAsGuest(trimmed);

        // Une seule Habitation partagée : on y emmène directement, c'est la
        // demande explicite (« il arrive directement sur la ou les
        // Habitations partagées »). Plusieurs : l'accueil, qui les liste
        // toutes — elles ont été mises en favori par la RPC, donc la
        // recherche et l'accueil les remontent déjà.
        if (habitationIds.length === 1) router.replace(`/habitation/${habitationIds[0]}`);
        else router.replace('/(tabs)');
      } catch (caught) {
        setError(t(ERROR_KEYS[rpcErrorCode(caught)] ?? 'common.error_generic'));
        setLoading(false);
      }
    },
    [t],
  );

  // Le QR d'une invitation encode une URL web (voir formatInviteQrValue) :
  // l'appareil photo natif de quelqu'un qui n'a pas encore l'app doit
  // pouvoir en faire quelque chose. Le scanner integre lit la meme valeur,
  // parseScannedCode se charge des trois formes possibles.
  const handleScanned = (raw: string) => {
    setScannerVisible(false);
    const parsed = parseScannedCode(raw);
    // Un code AMI scanne ici ne mene nulle part : il demande un compte, et
    // c'est justement ce que cet ecran permet d'eviter. Le dire plutot que
    // de laisser le serveur refuser avec un message plus obscur.
    if (parsed.type === 'friend') return setError(t('guest.errors.friend_code'));
    if (parsed.type !== 'invite') return setError(t('guest.errors.invalid_qr'));
    setCode(parsed.code);
    void enter(parsed.code);
  };

  useEffect(() => {
    if (autoAttempted.current || !params.code) return;
    autoAttempted.current = true;
    void enter(params.code);
  }, [params.code, enter]);

  // Arrivée par lien : on ne montre pas un formulaire pré-rempli que le
  // visiteur devrait valider lui-même, juste l'attente.
  if (loading && params.code && !error) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View className="flex-1 items-center justify-center bg-sand px-6">
          <ActivityIndicator />
          <Text className="mt-4 text-center text-body text-ink-soft">{t('guest.joining')}</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-sand">
        <ScrollView contentContainerClassName="flex-1 justify-center px-6" keyboardShouldPersistTaps="handled">
          <Text className="mb-2 text-display font-bold text-ink">{t('guest.title')}</Text>
          <Text className="mb-8 text-body leading-6 text-ink-soft">{t('guest.description')}</Text>

          <TextField
            label={t('guest.code_label')}
            value={code}
            onChangeText={(value) => setCode(value.toUpperCase())}
            autoCapitalize="characters"
            placeholder="ABCD123456"
            maxLength={10}
          />

          {error ? <Text className="mb-4 text-label text-red-600">{error}</Text> : null}

          <Button label={t('guest.submit')} onPress={() => enter(code)} loading={loading} disabled={!code.trim()} />

          <View className="my-4 flex-row items-center gap-3">
            <View className="h-px flex-1 bg-ink/10" />
            <Text className="text-caption text-ink-soft">{t('guest.or')}</Text>
            <View className="h-px flex-1 bg-ink/10" />
          </View>

          <Button label={t('guest.scan')} variant="ghost" onPress={() => setScannerVisible(true)} />

          <Text className="mt-6 text-center text-caption leading-4 text-ink-soft">{t('guest.no_account_note')}</Text>

          <TextLink
            href="/(auth)/login"
            label={t('guest.back_to_login')}
            className="mt-6 items-center"
            textClassName="text-center text-label font-semibold text-ink"
          />
        </ScrollView>
      </KeyboardAvoidingView>
      <QrScanner visible={scannerVisible} onClose={() => setScannerVisible(false)} onScanned={handleScanned} />
    </>
  );
}
