import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { Icon, type IconName } from '../../components/Icon';
import { getEmplacementIcon } from './constants';
import { useObjetLocationChain, type ObjetLocationNode } from './queries';

function iconForNode(node: ObjetLocationNode): IconName {
  if (node.kind === 'habitation') return 'home';
  if (node.kind === 'piece') return 'piece';
  if (node.kind === 'emplacement') return getEmplacementIcon(node.preset_key);
  return 'conteneur';
}

type LocationBreadcrumbProps = {
  objetId: string;
};

// Fil d'ariane complet (Habitation > Pièce > Emplacement > Conteneur(s)) —
// même langage visuel (puces + icônes) que le reste de l'app plutôt qu'une
// nouvelle timeline verticale, pour rester cohérent avec les chips déjà
// utilisées ailleurs (filtres d'accueil, PresetPicker).
export function LocationBreadcrumb({ objetId }: LocationBreadcrumbProps) {
  const { t } = useTranslation();
  const { data: chain } = useObjetLocationChain(objetId);

  if (!chain || chain.length === 0) return null;

  return (
    <View className="mb-6 rounded-2xl border border-ink/10 bg-white px-4 py-3">
      <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">
        {t('inventory.objet.location_title')}
      </Text>
      <View className="flex-row flex-wrap items-center">
        {chain.map((node, index) => (
          <View key={`${node.kind}-${node.id}`} className="mb-1.5 flex-row items-center">
            {index > 0 ? <Icon name="chevron" size={14} color="#D9D2C4" /> : null}
            <View className="ml-1 flex-row items-center gap-1 rounded-full bg-sand-dark px-2.5 py-1">
              <Icon name={iconForNode(node)} size={13} color="#6B6459" />
              <Text className="text-xs font-medium text-ink-soft">{node.name}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
