import { Image } from 'expo-image';
import { useCallback, useMemo, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, Text, View, type RefreshControlProps } from 'react-native';
import { useSpaceForAppTabBar } from '../../components/AppTabBar';
import { Icon } from '../../components/Icon';
import { useMediaSource } from '../../lib/images/media';
import { useScaled } from '../../lib/textScale';
import { useThemeColors } from '../../lib/theme';
import { PLACEHOLDER_IMAGES } from '../inventory/placeholders';
import { FactureFormSheet } from './FactureFormSheet';
import { useCreateFacture, useObjetsSansFacture } from './queries';
import { useFeuilleFacture } from './useFeuilleFacture';

// CE QU'IL RESTE À PROUVER — la liste qu'on cherche à vider.
//
// L'autre onglet dit ce qu'on a fait ; celui-ci dit ce qui manque, et c'est
// lui qui fait vivre la fonctionnalité. On n'ouvre son dossier d'assurance
// qu'après un sinistre — donc trop tard. Une liste de ce qui n'est pas
// couvert, elle, se traite un dimanche après-midi, pièce par pièce.
//
// TOUCHER UNE RANGÉE OUVRE LE FORMULAIRE, ce n'est pas un raccourci mais LE
// geste de cet écran. Les autres listes de l'app naviguent quand on les
// touche ; celle-ci est une liste de TÂCHES, et sa tâche est d'ajouter une
// preuve. La faire naviguer vers la fiche de l'objet ferait perdre sa place
// dans la liste à chaque objet traité. D'où l'absence de chevron — qui
// promettrait une navigation — et la pastille « + » à droite, qui annonce
// l'ajout.
//
// VIRTUALISÉE, contrairement aux autres listes de l'app. C'est la deuxième
// liste NON BORNÉE qu'on écrive, après l'accueil : elle contient tous les
// objets d'un logement, et au premier jour elle les contient TOUS, puisque
// personne n'a encore photographié un seul ticket. Les autres écrans listent
// le contenu d'une pièce ou d'un tiroir, où une FlatList coûterait plus
// qu'elle ne rapporte ; ici, chaque rangée monte une image signée, et les
// monter toutes d'emblée se paie au chargement comme à la mémoire.

type ObjetSansFacture = NonNullable<ReturnType<typeof useObjetsSansFacture>['data']>[number];

type ObjetsSansFactureListProps = {
  habitationId: string;
  objets: ObjetSansFacture[];
  /** Le même geste que sur l'autre onglet : il appartient à l'écran, pas à la liste. */
  refreshControl: ReactElement<RefreshControlProps>;
};

export function ObjetsSansFactureList({ habitationId, objets, refreshControl }: ObjetsSansFactureListProps) {
  const { t } = useTranslation();
  const creer = useCreateFacture();

  // LA BARRE D'ONGLETS EST RENDUE PAR-DESSUS TOUT L'ÉCRAN (voir
  // app/_layout.tsx) : sans cette réserve, la dernière rangée se termine
  // dessous. Calculée et non écrite en dur — la barre grandit avec le
  // réglage de taille du texte.
  const espaceBarre = useSpaceForAppTabBar();
  const contentStyle = useMemo(
    () => ({ paddingHorizontal: 24, paddingTop: 4, paddingBottom: espaceBarre + 16 }),
    [espaceBarre],
  );

  const [cible, setCible] = useState<ObjetSansFacture | null>(null);
  const feuille = useFeuilleFacture();

  const ouvrirFeuille = feuille.ouvrir;
  const ouvrir = useCallback(
    (objet: ObjetSansFacture) => {
      setCible(objet);
      ouvrirFeuille();
    },
    [ouvrirFeuille],
  );

  const renderItem = useCallback(
    ({ item }: { item: ObjetSansFacture }) => <ObjetRow objet={item} onPress={() => ouvrir(item)} />,
    [ouvrir],
  );

  return (
    <>
      <FlatList
        className="flex-1"
        data={objets}
        refreshControl={refreshControl}
        keyExtractor={(objet) => objet.id}
        renderItem={renderItem}
        contentContainerStyle={contentStyle}
        ListHeaderComponent={
          <Text className="mb-4 text-label leading-5 text-ink-soft">{t('factures.list.without_intro')}</Text>
        }
        initialNumToRender={8}
        windowSize={5}
      />

      <FactureFormSheet
        key={feuille.cle}
        visible={feuille.visible}
        onClose={feuille.fermer}
        onSubmit={(valeurs) => {
          // `habitationId` ne part pas en base : il dit seulement quelles
          // listes du dossier corriger sans attendre le réseau — la facture
          // entre dans l'une, l'objet sort de celle-ci.
          if (cible) creer.mutate({ objetId: cible.id, habitationId, ...valeurs });
          feuille.fermer();
        }}
        loading={creer.isPending}
      />
    </>
  );
}

function ObjetRow({ objet, onPress }: { objet: ObjetSansFacture; onPress: () => void }) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const photo = useMediaSource(objet.photo_url);

  // 4:3, le ratio des illustrations par défaut — un carré les recadrerait.
  // Dessinée en pixels, donc mise à l'échelle avec le texte posé à côté.
  const largeur = useScaled(56);
  const hauteur = useScaled(42);
  const pastille = useScaled(36);

  return (
    <Pressable
      accessibilityRole="button"
      // CE QUE LE GESTE FAIT, PAS CE QUE LA RANGÉE MONTRE. Lire « Lampe de
      // chevet » à voix haute laisserait croire qu'on ouvre l'objet.
      accessibilityLabel={t('factures.list.add_for', { name: objet.name })}
      onPress={onPress}
      className="mb-3 flex-row items-center gap-3 rounded-2xl border border-ink/10 bg-surface p-3 active:opacity-70"
    >
      <View style={{ width: largeur, height: hauteur }} className="overflow-hidden rounded-lg bg-sand">
        <Image
          source={photo ?? PLACEHOLDER_IMAGES.objet}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
        />
      </View>

      {/* DEUX LIGNES, TOUJOURS — même règle que les cartes de l'autre onglet :
          c'est ce qui donne à toutes les rangées la même hauteur sans figer un
          nombre de pixels, donc une liste qui reste régulière à 200 % de
          texte. */}
      <View className="flex-1">
        <Text numberOfLines={1} className="text-body font-semibold text-ink">
          {objet.name}
        </Text>
        {/* OÙ IL EST POSÉ, et pas seulement dans quelle pièce : c'est ce qui
            permet de reconnaître laquelle des trois lampes est concernée. */}
        <Text numberOfLines={1} className="text-caption text-ink-soft">
          {[objet.piece_name, objet.parent_label].filter(Boolean).join(' · ')}
        </Text>
      </View>

      <View
        style={{ width: pastille, height: pastille }}
        className="items-center justify-center rounded-full bg-coral-light"
      >
        <Icon name="add" size={20} color={colors.accentDark} />
      </View>
    </Pressable>
  );
}
