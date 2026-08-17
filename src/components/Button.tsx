import { ActivityIndicator, Pressable, Text, type PressableProps } from 'react-native';

type ButtonProps = PressableProps & {
  label: string;
  loading?: boolean;
  variant?: 'primary' | 'ghost' | 'danger';
};

// `danger` est une pastille rouge compacte (pas un bloc pleine largeur comme
// primary/ghost) — c'est LE style de bouton de suppression de l'app,
// partagé par toutes les fiches de suppression (Groupe, Ami, Objet, forme du
// Plan, pastille d'Emplacement) pour rester visuellement homogène d'un écran
// à l'autre plutôt que chacun sa variante de texte rouge.
export function Button({ label, loading, variant = 'primary', disabled, ...pressableProps }: ButtonProps) {
  const isPrimary = variant === 'primary';
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
