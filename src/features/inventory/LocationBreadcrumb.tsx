import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { useThemeColors } from '../../lib/theme';
import { useObjetLocationChain, type ObjetLocationNode } from './queries';

const ROUTES: Record<ObjetLocationNode['kind'], string> = { habitation: 'habitation', piece: 'piece', emplacement: 'emplacement', conteneur: 'conteneur' };

export function LocationBreadcrumb({ objetId }: { objetId: string }) {
  const { t } = useTranslation();
  const { data: chain } = useObjetLocationChain(objetId);
  const colors = useThemeColors();
  const nodes = (chain ?? []).filter((node) => !(node.kind === 'piece' && node.is_default));
  const destination = nodes[nodes.length - 1];
  if (!destination) return null;
  const open = (node: ObjetLocationNode) => router.dismissTo(`/${ROUTES[node.kind]}/${node.id}`);
  return (
    <View className="mb-5 rounded-3xl bg-coral-light px-5 py-4">
      <Text className="text-label text-coral-dark">{t('redesign.in')}</Text>
      <Pressable onPress={() => open(destination)} accessibilityRole="link" accessibilityLabel={destination.name} className="min-h-[48px] justify-center py-2">
        <Text className="text-title font-bold text-coral-dark">{destination.name}</Text>
      </Pressable>
      <View className="flex-row flex-wrap items-center">
        {nodes.slice(0, -1).map((node, index) => <View key={node.id} className="flex-row items-center">
          {index ? <Icon name="chevron" size={14} color={colors.accentDark} /> : null}
          <Pressable onPress={() => open(node)} accessibilityRole="link" accessibilityLabel={node.name}
            className="min-h-[48px] justify-center px-2 py-2"><Text className="text-label text-coral-dark">{node.name}</Text></Pressable>
        </View>)}
      </View>
    </View>
  );
}
