import { ActivityIndicator, Pressable, Text, type PressableProps } from 'react-native';

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
  const isPrimary = variant === 'primary';
  const isOutline = variant === 'outline';
  const isDanger = variant === 'danger';

  if (isDanger) {
    return (
      <Pressable
        disabled={disabled || loading}
        className={`items-center justify-center self-center rounded-full bg-red-500 px-6 py-2.5 active:opacity-80 ${disabled || loading ? 'opacity-50' : ''}`}
        {...pressableProps}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text className="text-sm font-semibold text-white">{label}</Text>}
      </Pressable>
    );
  }

  if (isOutline) {
    return (
      <Pressable
        disabled={disabled || loading}
        className={`items-center justify-center rounded-xl border-2 border-coral bg-coral-light py-3.5 active:opacity-80 ${disabled || loading ? 'opacity-50' : ''}`}
        {...pressableProps}
      >
        {loading ? <ActivityIndicator color="#0B5E9E" /> : <Text className="text-base font-semibold text-coral-dark">{label}</Text>}
      </Pressable>
    );
  }

  return (
    <Pressable
      disabled={disabled || loading}
      className={`items-center justify-center rounded-xl py-3.5 active:opacity-80 ${
        isPrimary ? 'bg-coral' : 'bg-transparent'
      } ${disabled || loading ? 'opacity-50' : ''}`}
      {...pressableProps}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? '#fff' : '#2D2A26'} />
      ) : (
        <Text className={`text-base font-semibold ${isPrimary ? 'text-white' : 'text-ink'}`}>{label}</Text>
      )}
    </Pressable>
  );
}
