import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { Icon, type IconName } from '../../components/Icon';
import { getEmplacementIcon, getPieceIcon } from './constants';
import { useThemeColors } from '../../lib/theme';
import { useObjetLocationChain, type ObjetLocationNode } from './queries';

function iconForNode(node: ObjetLocationNode): IconName {
  if (node.kind === 'habitation') return 'home';
  if (node.kind === 'piece') return getPieceIcon(node.preset_key);
  if (node.kind === 'emplacement') return getEmplacementIcon(node.preset_key);
  return 'conteneur';
}

const ROUTE_BY_KIND: Record<ObjetLocationNode['kind'], string> = {
  habitation: 'habitation',
  piece: 'piece',
  emplacement: 'emplacement',
  conteneur: 'conteneur',
};

const LINK = '#1591EA';

type LocationBreadcrumbProps = {
  objetId: string;
};

// Fil d'ariane complet (Habitation > Pièce > Emplacement > Conteneur(s)) —
// même langage visuel (puces + icônes) que le reste de l'app plutôt qu'une
// nouvelle timeline verticale, pour rester cohérent avec les chips déjà
// utilisées ailleurs (filtres d'accueil, PresetPicker).
//
// CHAQUE MAILLON EST UN RACCOURCI vers son écran. Remonter d'un cran sans ça
// obligeait à enchaîner les retours arrière, ou pire à repartir de l'accueil
// quand on était arrivé sur l'objet par la recherche.
export function LocationBreadcrumb({ objetId }: LocationBreadcrumbProps) {
  const { t } = useTranslation();
  const { data: chain } = useObjetLocationChain(objetId);
  const colors = useThemeColors();

  // La pièce par défaut d'une habitation mono-espace (Garage, Cave...) porte
  // le nom de l'habitation et n'est montrée nulle part ailleurs : elle
  // donnait un « Garage > Garage » et mènerait à un écran de Pièce que ce
  // type d'habitation est justement censé ne pas avoir.
  const nodes = (chain ?? []).filter((node) => !(node.kind === 'piece' && node.is_default));

  if (nodes.length === 0) return null;

  return (
    <View className="mb-6 rounded-2xl border border-ink/10 bg-surface px-4 py-3">
      <Text className="mb-2 text-caption font-semibold uppercase tracking-wide text-ink-soft">
        {t('inventory.objet.location_title')}
      </Text>
      <View className="flex-row flex-wrap items-center">
        {nodes.map((node, index) => (
          <View key={`${node.kind}-${node.id}`} className="mb-1.5 flex-row items-center">
            {index > 0 ? <Icon name="chevron" size={14} color={colors.inkFaint} /> : null}
            <Pressable
              // `dismissTo` plutôt que `push` : ces écrans sont presque
              // toujours DÉJÀ dans la pile (on est descendu par eux), donc on
              // y revient au lieu d'en empiler un double. Arrivé sur l'objet
              // par la recherche, aucun n'y est : la fiche est alors
              // remplacée par la destination, et le retour ramène à
              // l'accueil, d'où l'on venait.
              onPress={() => router.dismissTo(`/${ROUTE_BY_KIND[node.kind]}/${node.id}`)}
              accessibilityRole="link"
              accessibilityLabel={node.name}
              // La zone tactile d'une chip de 13 px de texte est courte : le
              // hitSlop la ramène au minimum confortable sans grossir le fil.
              hitSlop={6}
              className="ml-1 flex-row items-center gap-1 rounded-full bg-sand-dark px-2.5 py-1 active:opacity-60"
            >
              <Icon name={iconForNode(node)} size={13} color={LINK} />
              <Text className="text-caption font-medium" style={{ color: LINK }}>
                {node.name}
              </Text>
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  );
}
