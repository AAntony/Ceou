import { forwardRef, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useTranslation } from 'react-i18next';
import { applyMaskedEdit, maskValue } from '../lib/text/maskedInput';
import { useThemeColors } from '../lib/theme';
import { Icon } from './Icon';

type TextFieldProps = TextInputProps & {
  label: string;
  error?: string;
};

// Combien de temps la dernière lettre frappée reste visible. Assez pour la
// lire sans la chercher, trop court pour qu'un regard par-dessus l'épaule en
// reconstitue plus d'une.
const REVEAL_MS = 1200;

/**
 * Champ de saisie, avec un traitement particulier pour les mots de passe.
 *
 * Dès qu'on lui passe `secureTextEntry`, il ajoute deux choses que rien
 * n'oblige les écrans à demander : un œil pour dévoiler la saisie, et
 * l'affichage de la dernière lettre le temps de la taper. Les dix champs de
 * mot de passe de l'app en héritent sans qu'aucun ne change.
 *
 * Le masquage est fait ICI plutôt que par `secureTextEntry`, qui ne sait que
 * tout cacher tout le temps (voir lib/text/maskedInput). Deux précautions
 * viennent avec, parce que le champ n'est plus déclaré « secret » au
 * système : le clavier passe en mode mot de passe visible sur Android, ce qui
 * l'empêche d'apprendre ce qu'on tape, et la correction automatique reste
 * désactivée.
 */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, secureTextEntry, value, onChangeText, ...inputProps },
  ref
) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const [revealed, setRevealed] = useState(false);
  const [revealIndex, setRevealIndex] = useState(-1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };
  useEffect(() => clearTimer, []);

  const isPassword = !!secureTextEntry;
  const real = value ?? '';
  const masking = isPassword && !revealed;
  const displayed = masking ? maskValue(real, revealIndex) : real;

  const handleChange = (next: string) => {
    if (!masking) {
      onChangeText?.(next);
      return;
    }
    const edit = applyMaskedEdit(displayed, next, real);
    clearTimer();
    setRevealIndex(edit.revealIndex);
    if (edit.revealIndex >= 0) timerRef.current = setTimeout(() => setRevealIndex(-1), REVEAL_MS);
    onChangeText?.(edit.value);
  };

  const toggleRevealed = () => {
    clearTimer();
    setRevealIndex(-1);
    setRevealed((current) => !current);
  };

  return (
    <View className="mb-4">
      <Text className="mb-1.5 text-sm font-medium text-ink-soft">{label}</Text>
      {/* La bordure porte sur l'ensemble et non sur le champ seul : c'est ce
          qui met l'œil À L'INTÉRIEUR du cadre plutôt qu'à côté. */}
      <View className="flex-row items-center rounded-xl border border-ink/10 bg-sand-dark">
        <TextInput
          ref={ref}
          className="flex-1 px-4 py-3 text-base text-ink"
          placeholderTextColor={colors.inkFaint}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          // Le champ n'est plus déclaré « secret » au système : cet indice
          // devient le seul par lequel un gestionnaire de mots de passe le
          // reconnaît. Avant la diffusion des props, pour qu'un écran puisse
          // le préciser (« password-new » à l'inscription).
          autoComplete={isPassword ? 'password' : undefined}
          {...inputProps}
          // APRÈS la diffusion des props : ces trois-là sont pilotées ici et
          // ne doivent pas pouvoir être écrasées par l'écran appelant, sans
          // quoi le masquage se retrouverait à moitié en place.
          value={displayed}
          onChangeText={handleChange}
          // `visible-password` sur Android : le clavier des mots de passe,
          // sans le masquage. C'est ce qui empêche le dictionnaire prédictif
          // de retenir la saisie maintenant qu'elle n'est plus déclarée
          // secrète. Le remplissage automatique, lui, reste piloté par
          // `autoComplete`/`textContentType` que les écrans passent déjà.
          keyboardType={isPassword && Platform.OS === 'android' ? 'visible-password' : inputProps.keyboardType}
        />
        {isPassword ? (
          <Pressable
            onPress={toggleRevealed}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityState={{ selected: revealed }}
            accessibilityLabel={t(revealed ? 'common.hide_password' : 'common.show_password')}
            className="px-3 py-3 active:opacity-60"
          >
            <Icon name={revealed ? 'eyeOff' : 'eye'} size={20} color={colors.inkFaint} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text className="mt-1 text-sm text-red-600">{error}</Text> : null}
    </View>
  );
});
