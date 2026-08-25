import { type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { Icon, type IconName } from './Icon';

type EmptyStateProps = {
  icon?: IconName;
  title: string;
  subtitle?: string;
  /**
   * Ce qu'il y a à FAIRE ici, quand l'écran vide a une réponse à proposer.
   *
   * Un écran vide qui ne dit que « rien à afficher » laisse la personne au
   * même endroit qu'avant. L'accueil s'en sert pour tendre le guide de
   * démarrage — c'est précisément là que quelqu'un qui débute se retrouve
   * bloqué.
   */
  action?: ReactNode;
};

export function EmptyState({ icon = 'empty', title, subtitle, action }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-6 py-16">
      <View className="mb-3 h-16 w-16 items-center justify-center rounded-full bg-mustard-light">
        <Icon name={icon} size={30} color="#E0A93C" />
      </View>
      <Text className="mb-1 text-center text-body font-medium text-ink-soft">{title}</Text>
      {subtitle ? <Text className="text-center text-label text-ink-soft">{subtitle}</Text> : null}
      {action ? <View className="mt-5 w-full">{action}</View> : null}
    </View>
  );
}
