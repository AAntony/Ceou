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
    <View className="mb-3 rounded-2xl border border-ink/10 bg-surface p-4">
      <View className="mb-2 flex-row items-center gap-2">
        <Icon name="location" size={18} color={colors.accentDark} />
        <Text className="text-label font-semibold text-ink-soft">{t('redesign.in')}</Text>
      </View>
      {nodes.map((node, index) => {
        const last = index === nodes.length - 1;
        return <Pressable key={node.id} onPress={() => open(node)} accessibilityRole="link"
          accessibilityLabel={node.name} className="min-h-[48px] flex-row items-center gap-3 py-2">
          <View className="w-8 items-center">
            <Icon name={node.kind === 'habitation' ? 'home' : node.kind === 'piece' ? 'piece' : node.kind === 'conteneur' ? 'conteneur' : 'armoire'} size={20} color={last ? colors.accentDark : colors.inkSoft} />
          </View>
          <Text className={last ? 'flex-1 text-body font-bold text-coral-dark' : 'flex-1 text-label text-ink-soft'}>{node.name}</Text>
          <Icon name="chevron" size={16} color={colors.inkSoft} />
        </Pressable>;
      })}
    </View>
  );
}
