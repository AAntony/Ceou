import { ActivityIndicator, Pressable, Text, type PressableProps } from 'react-native';
import { useThemeColors } from '../lib/theme';

type ButtonProps = PressableProps & {
  label: string;
  loading?: boolean;
  variant?: 'primary' | 'ghost' | 'outline' | 'danger';
};

// `danger` est une pastille rouge compacte (pas un bloc pleine largeur comme
// primary/ghost/outline) — c'est LE style de bouton de suppression de l'app,
// partagé par toutes les fiches de suppression (Groupe, Ami, Objet, forme du
// Plan, pastille d'Emplacement) pour rester visuellement homogène d'un écran
// à l'autre plutôt que chacun sa variante de texte rouge.
// `outline` (bordure + fond corail-clair) pour une action secondaire qui doit
// quand même se reconnaître comme cliquable au premier coup d'œil (ex.
// "Partager mon code") — `ghost` reste réservé aux actions discrètes
// (Annuler, etc.) où un vrai bouton serait trop appuyé, ne pas migrer ces
// usages vers `outline` sans raison.
export function Button({ label, loading, variant = 'primary', disabled, ...pressableProps }: ButtonProps) {
  const colors = useThemeColors();
  const isPrimary = variant === 'primary';
  const isOutline = variant === 'outline';
  const isDanger = variant === 'danger';

  if (isDanger) {
    return (
      <Pressable
        disabled={disabled || loading}
        accessibilityRole="button"
        accessibilityState={{ disabled: disabled || loading, busy: loading }}
        className={`items-center justify-center self-center rounded-full bg-red-500 px-6 py-2.5 active:opacity-80 ${disabled || loading ? 'opacity-50' : ''}`}
        {...pressableProps}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text className="text-center text-label font-semibold text-white">{label}</Text>}
      </Pressable>
    );
  }

  if (isOutline) {
    return (
      <Pressable
        disabled={disabled || loading}
        accessibilityRole="button"
        accessibilityState={{ disabled: disabled || loading, busy: loading }}
        className={`items-center justify-center rounded-xl border-2 border-coral bg-coral-light px-4 py-3.5 active:opacity-80 ${disabled || loading ? 'opacity-50' : ''}`}
        {...pressableProps}
      >
        {loading ? <ActivityIndicator color={colors.accentDark} /> : <Text className="text-center text-body font-semibold text-coral-dark">{label}</Text>}
      </Pressable>
    );
  }

  return (
    <Pressable
      disabled={disabled || loading}
      accessibilityRole="button"
      // `busy` fait annoncer « en cours » pendant l'attente : sans lui, un
      // bouton qui tourne est simplement un bouton qui ne répond pas.
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      className={`items-center justify-center rounded-xl px-4 py-3.5 active:opacity-80 ${
        isPrimary ? 'bg-coral' : 'bg-transparent'
      } ${disabled || loading ? 'opacity-50' : ''}`}
      {...pressableProps}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? '#fff' : colors.ink} />
      ) : (
        // Centre : en gros texte un libelle passe sur deux lignes, et un
        // alignement a gauche desaxerait tout le bouton.
        <Text className={`text-center text-body font-semibold ${isPrimary ? 'text-white' : 'text-ink'}`}>{label}</Text>
      )}
    </Pressable>
  );
}
