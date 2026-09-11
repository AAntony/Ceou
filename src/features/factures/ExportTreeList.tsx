import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, Text, View } from 'react-native';
import { Icon, type IconName } from '../../components/Icon';
import { useScaled } from '../../lib/textScale';
import { useThemeColors } from '../../lib/theme';
import { aplatir, etatDe, type EtatCase, type NodeKind, type TreeNode } from './exportTree';

// L'ARBORESCENCE À COCHER.
//
// ═══ DEUX GESTES SUR UNE MÊME RANGÉE, ET C'EST ASSUMÉ ═══
//
// Le chevron déplie, tout le reste de la rangée coche. C'est la seule
// répartition qui marche : cocher est ce qu'on vient faire ici, donc ça doit
// être la cible large ; déplier est une exploration, et son chevron dit déjà
// où appuyer. L'inverse — la rangée déplie, une petite case coche — obligerait
// à viser une case de 22 points à chaque objet, c'est-à-dire à chaque geste
// utile.
//
// ═══ TROIS ÉTATS, PAS DEUX ═══
//
// Une branche dont une partie seulement est cochée doit le DIRE. Sans le
// troisième état, une Pièce à moitié sélectionnée apparaîtrait soit cochée
// (et on exporterait moins que ce qu'on croit), soit vide (et on croirait
// n'avoir rien sélectionné dedans). Le trait horizontal est la convention
// universelle pour ça.
//
// LE BLANC EST POSÉ SUR `coral` ET NON SUR `coral-dark`, et c'est un détail
// de thème sombre : `coral-dark` y devient un bleu CLAIR, sur lequel un trait
// blanc disparaîtrait. `coral` vaut #1591EA dans les deux thèmes — 3,35:1
// avec le blanc, au-dessus des 3:1 exigés pour un élément non textuel.

const ICONES: Record<NodeKind, IconName> = {
  habitation: 'habitations',
  piece: 'piece',
  emplacement: 'etagere',
  conteneur: 'conteneur',
  objet: 'objet',
};

type ExportTreeListProps = {
  racines: TreeNode[];
  ouverts: Set<string>;
  selection: Set<string>;
  onBasculer: (noeud: TreeNode) => void;
  onDeplier: (noeud: TreeNode) => void;
  /** Rendu en tête de liste : intro et compteurs appartiennent à l'écran. */
  entete?: React.ReactElement;
};

const CONTENT_STYLE = { paddingHorizontal: 24, paddingTop: 4, paddingBottom: 24 };

export function ExportTreeList({
  racines,
  ouverts,
  selection,
  onBasculer,
  onDeplier,
  entete,
}: ExportTreeListProps) {
  // APLATI À CHAQUE DÉPLIAGE, ET SEULEMENT LÀ. La sélection change bien plus
  // souvent que les replis — à chaque appui — et elle ne bouge pas une seule
  // rangée de place. La recalculer aussi pour elle ferait reparcourir tout
  // l'arbre à chaque coche.
  const lignes = useMemo(() => aplatir(racines, ouverts), [racines, ouverts]);

  const renderItem = useCallback(
    ({ item }: { item: { noeud: TreeNode; profondeur: number } }) => (
      <Rangee
        noeud={item.noeud}
        profondeur={item.profondeur}
        etat={etatDe(item.noeud, selection)}
        ouvert={ouverts.has(item.noeud.key)}
        onBasculer={() => onBasculer(item.noeud)}
        onDeplier={() => onDeplier(item.noeud)}
      />
    ),
    [selection, ouverts, onBasculer, onDeplier],
  );

  return (
    <FlatList
      className="flex-1"
      data={lignes}
      keyExtractor={(ligne) => ligne.noeud.key}
      renderItem={renderItem}
      ListHeaderComponent={entete}
      contentContainerStyle={CONTENT_STYLE}
      initialNumToRender={14}
      windowSize={7}
    />
  );
}

function Rangee({
  noeud,
  profondeur,
  etat,
  ouvert,
  onBasculer,
  onDeplier,
}: {
  noeud: TreeNode;
  profondeur: number;
  etat: EtatCase;
  ouvert: boolean;
  onBasculer: () => void;
  onDeplier: () => void;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const retrait = useScaled(profondeur * 15);
  const chevron = useScaled(26);
  const depliable = noeud.children.length > 0;

  return (
    <View style={{ paddingLeft: retrait }} className="flex-row items-center">
      {/* LA PLACE DU CHEVRON EST TENUE MÊME QUAND IL N'Y EN A PAS : sans ça,
          les objets d'un emplacement se décaleraient vers la gauche par
          rapport aux conteneurs qui les côtoient, et le retrait cesserait de
          dire la hiérarchie. */}
      {depliable ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: ouvert }}
          accessibilityLabel={t(ouvert ? 'factures.export.a11y_collapse' : 'factures.export.a11y_expand', {
            name: noeud.name,
          })}
          onPress={onDeplier}
          hitSlop={6}
          style={{ width: chevron, height: chevron }}
          className="items-center justify-center active:opacity-60"
        >
          <Icon name={ouvert ? 'moveDown' : 'chevron'} size={18} color={colors.inkSoft} />
        </Pressable>
      ) : (
        <View style={{ width: chevron }} />
      )}

      <Pressable
        accessibilityRole="checkbox"
        // `'mixed'` EST UNE VALEUR DE `checked`, pas un état à part : c'est
        // ainsi que les deux systèmes annoncent une case partiellement
        // cochée. Sans elle, un lecteur d'écran dirait « non coché » d'une
        // Pièce dont la moitié des objets est sélectionnée.
        accessibilityState={{ checked: etat === 'all' ? true : etat === 'some' ? 'mixed' : false }}
        accessibilityLabel={noeud.name}
        accessibilityHint={t('factures.export.count', { count: noeud.factureIds.length })}
        onPress={onBasculer}
        className="flex-1 flex-row items-center gap-2.5 py-2.5 pr-1 active:opacity-60"
      >
        <Case etat={etat} />
        <Icon name={ICONES[noeud.kind]} size={18} color={colors.inkFaint} />
        <Text numberOfLines={1} className={`flex-1 ${noeud.kind === 'objet' ? 'text-label' : 'text-body'} text-ink`}>
          {noeud.name}
        </Text>
        <Text className="text-caption text-ink-soft" style={{ fontVariant: ['tabular-nums'] }}>
          {noeud.factureIds.length}
        </Text>
      </Pressable>
    </View>
  );
}

function Case({ etat }: { etat: EtatCase }) {
  const taille = useScaled(22);
  const trait = useScaled(10);

  return (
    <View
      style={{ width: taille, height: taille }}
      className={`items-center justify-center rounded-md border-2 ${
        etat === 'none' ? 'border-ink/25' : 'border-coral bg-coral'
      }`}
    >
      {etat === 'all' ? <Icon name="validate" size={14} color="#FFFFFF" /> : null}
      {etat === 'some' ? <View style={{ width: trait, height: 2 }} className="rounded-full bg-white" /> : null}
    </View>
  );
}
