import { router, Stack } from 'expo-router';
import { useState, type PropsWithChildren } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { BottomSheetModal } from '../src/components/BottomSheetModal';
import { Button } from '../src/components/Button';
import { TextField } from '../src/components/TextField';
import { useSession } from '../src/features/auth/SessionProvider';
import { isPasswordValid } from '../src/features/auth/validation';
import { logClientError } from '../src/lib/errorLogging';
import { authRedirectUrl } from '../src/lib/supabase/authRedirect';
import { supabase } from '../src/lib/supabase/client';

// Écran « Mon compte » : changer d'adresse, changer de mot de passe,
// supprimer son compte. Regroupés ici plutôt qu'ajoutés au bas de l'écran
// Profil, qui porte déjà l'identité publique (nom affiché, avatar, code
// ami, langue) — deux sujets distincts : ce qu'on montre aux autres d'un
// côté, les clés d'accès de l'autre.

function Section({ title, children }: PropsWithChildren<{ title: string }>) {
  return (
    <View className="mb-6 rounded-2xl border border-ink/10 bg-surface p-5">
      <Text className="mb-4 text-base font-bold text-ink">{title}</Text>
      {children}
    </View>
  );
}

function Feedback({ error, success }: { error: string | null; success: string | null }) {
  if (error) return <Text className="mb-3 text-sm text-red-600">{error}</Text>;
  if (success) return <Text className="mb-3 text-sm text-green-600">{success}</Text>;
  return null;
}

export default function AccountScreen() {
  const { t, i18n } = useTranslation();
  const { session } = useSession();
  const currentEmail = session?.user.email ?? '';

  const [newEmail, setNewEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Revalide le mot de passe courant avant toute opération sensible.
  // Supabase n'exige rien de tel par défaut (`secure_password_change` est
  // désactivé côté projet) : sans cette étape, un téléphone déverrouillé
  // laissé sans surveillance suffirait à changer le mot de passe ou à
  // détruire le compte. L'effet de bord — rafraîchir la session — est utile
  // au passage, puisque l'API refuse ces opérations sur un jeton trop vieux.
  const reauthenticate = async (password: string): Promise<boolean> => {
    const { error } = await supabase.auth.signInWithPassword({ email: currentEmail, password });
    return !error;
  };

  const handleEmailChange = async () => {
    setEmailError(null);
    setEmailSuccess(null);

    const target = newEmail.trim();
    if (!target) return;
    if (target.toLowerCase() === currentEmail.toLowerCase()) {
      setEmailError(t('account.email.errors.same'));
      return;
    }

    setEmailLoading(true);
    const { error } = await supabase.auth.updateUser(
      { email: target },
      { emailRedirectTo: authRedirectUrl('email_change', i18n.language) },
    );
    setEmailLoading(false);

    if (error) {
      setEmailError(error.message);
      return;
    }

    // L'adresse ne change PAS tout de suite : le projet exige une
    // confirmation sur l'ancienne ET la nouvelle adresse
    // (`double_confirm_changes`). Le dire explicitement, sinon l'utilisateur
    // voit son ancienne adresse toujours affichée et croit à un échec.
    setNewEmail('');
    setEmailSuccess(t('account.email.success', { email: target }));
  };

  const handlePasswordChange = async () => {
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!isPasswordValid(newPassword)) {
      setPasswordError(t('auth.errors.password_too_short'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t('auth.errors.passwords_mismatch'));
      return;
    }

    setPasswordLoading(true);
    if (!(await reauthenticate(currentPassword))) {
      setPasswordLoading(false);
      setPasswordError(t('account.errors.wrong_password'));
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordLoading(false);

    if (error) {
      setPasswordError(error.message);
      return;
    }

    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordSuccess(t('account.password.success'));
  };

  const handleDelete = async () => {
    setDeleteError(null);
    setDeleteLoading(true);

    if (!(await reauthenticate(deletePassword))) {
      setDeleteLoading(false);
      setDeleteError(t('account.errors.wrong_password'));
      return;
    }

    // La fonction ne prend aucun paramètre : elle supprime l'utilisateur du
    // jeton, jamais un autre (voir supabase/functions/delete-account).
    const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });

    if (error) {
      setDeleteLoading(false);
      // Une suppression qui échoue sans laisser de trace serait invisible
      // pour nous : c'est exactement le type d'incident qu'on veut pouvoir
      // reconstituer, l'utilisateur ne pouvant plus le signaler après coup.
      await logClientError(error, { scope: 'delete-account' });
      setDeleteError(t('account.delete.errors.failed'));
      return;
    }

    // `scope: 'local'` et pas une déconnexion serveur : le compte n'existe
    // plus, donc le jeton n'est plus valide et un appel de déconnexion
    // classique répondrait 401. Ici on se contente de vider le stockage
    // local, ce qui fait tomber la session à null et renvoie au login.
    await supabase.auth.signOut({ scope: 'local' });
    setDeleteLoading(false);
    setDeleteOpen(false);
    router.replace('/(auth)/login');
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t('account.title') }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-sand">
        <ScrollView className="flex-1" contentContainerClassName="px-5 pb-32 pt-5" keyboardShouldPersistTaps="handled">
          <Section title={t('account.email.title')}>
            <Text className="mb-1 text-sm text-ink-soft">{t('account.email.current')}</Text>
            <Text className="mb-4 text-base font-semibold text-ink">{currentEmail}</Text>

            <TextField
              label={t('account.email.new')}
              value={newEmail}
              onChangeText={setNewEmail}
              keyboardType="email-address"
              textContentType="emailAddress"
              placeholder={t('account.email.placeholder')}
            />

            <Feedback error={emailError} success={emailSuccess} />
            <Button
              label={t('account.email.submit')}
              onPress={handleEmailChange}
              loading={emailLoading}
              disabled={!newEmail.trim()}
            />
            <Text className="mt-3 text-xs leading-4 text-ink-soft">{t('account.email.hint')}</Text>
          </Section>

          <Section title={t('account.password.title')}>
            <TextField
              label={t('account.password.current')}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
              textContentType="password"
            />
            <TextField
              label={t('account.password.new')}
              value={newPassword}
              onChangeText={setNewPassword}
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

            <Feedback error={passwordError} success={passwordSuccess} />
            <Button
              label={t('account.password.submit')}
              onPress={handlePasswordChange}
              loading={passwordLoading}
              disabled={!currentPassword || !newPassword || !confirmPassword}
            />
          </Section>

          {/* Bordure rouge plutôt que la bordure neutre des deux autres
              cartes : cette section détruit des données de façon
              irréversible, elle ne doit pas se lire comme un réglage de
              plus qu'on parcourt distraitement. */}
          <View className="rounded-2xl border border-red-500/40 bg-surface p-5">
            <Text className="mb-2 text-base font-bold text-ink">{t('account.delete.title')}</Text>
            <Text className="mb-4 text-sm leading-5 text-ink-soft">{t('account.delete.description')}</Text>
            <Button label={t('account.delete.entry')} variant="danger" onPress={() => setDeleteOpen(true)} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Contenu court : aucune propriété flex et pas de `sheetStyle` — la
          seule forme dont BottomSheetModal documente qu'elle se mesure
          correctement sur l'appareil. */}
      <BottomSheetModal
        visible={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setDeletePassword('');
          setDeleteError(null);
        }}
        sheetClassName="rounded-t-3xl bg-surface px-5 pb-4 pt-6"
      >
        <Text className="mb-2 text-xl font-bold text-ink">{t('account.delete.confirm_title')}</Text>
        <Text className="mb-5 text-sm leading-5 text-ink-soft">{t('account.delete.confirm_body')}</Text>

        <TextField
          label={t('account.delete.confirm_password')}
          value={deletePassword}
          onChangeText={setDeletePassword}
          secureTextEntry
          textContentType="password"
        />

        {deleteError ? <Text className="mb-3 text-sm text-red-600">{deleteError}</Text> : null}

        <View className="mt-1 gap-3">
          <Button
            label={t('account.delete.confirm_submit')}
            variant="danger"
            onPress={handleDelete}
            loading={deleteLoading}
            disabled={!deletePassword}
          />
          <Button
            label={t('common.cancel')}
            variant="ghost"
            onPress={() => {
              setDeleteOpen(false);
              setDeletePassword('');
              setDeleteError(null);
            }}
          />
        </View>
      </BottomSheetModal>
    </>
  );
}
