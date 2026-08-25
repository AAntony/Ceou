import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { PLACEHOLDER_IMAGES, type EntityLevel } from '../inventory/placeholders';
import { useScaled } from '../../lib/textScale';
import type { SearchIndexEntry, SearchKind } from './queries';

const ROUTE_BY_KIND: Record<SearchKind, string> = {
  objet: 'objet',
  conteneur: 'conteneur',
  emplacement: 'emplacement',
  piece: 'piece',
};

// Les quatre types de résultat correspondent un pour un à un niveau de
// l'inventaire, donc à une illustration par défaut déjà dessinée.
const LEVEL_BY_KIND: Record<SearchKind, EntityLevel> = {
  objet: 'objet',
  conteneur: 'conteneur',
  emplacement: 'emplacement',
  piece: 'piece',
};

// Largeur d'une tuile selon le nombre de colonnes. Les écarts de 9 px sont
// posés par la rangée (COLUMN_WRAPPER, HomeDashboard) : les pourcentages
// laissent juste la place qu'ils occupent.
const TILE_WIDTH: Record<number, `${number}%`> = {
  3: '31.5%',
  2: '48.5%',
};

// Largeur de la vignette en disposition RANGÉE, avant mise à l'échelle.
const ROW_THUMB_WIDTH = 96;

function locationLine(entry: SearchIndexEntry): string {
  if (entry.kind === 'piece') return entry.habitation_name;
  if (entry.kind === 'emplacement') return entry.piece_name;
  return `${entry.parent_label} · ${entry.piece_name}`;
}

type ResultCardProps = {
  entry: SearchIndexEntry;
  /** 3, 2 ou 1 — décidé par l'écran selon la taille de texte en cours. */
  columns: number;
};

// Tuile de résultat de l'accueil.
//
// Ne délègue plus à EntityCard : la carte y était bâtie autour d'une
// PASTILLE de 52 px (photo rognée en rond, ou icône à défaut) posée sur un
// fond pastel. La photo y était donc l'élément le plus petit de la tuile,
// alors que c'est elle qui permet de reconnaître un objet d'un coup d'œil —
// tout l'intérêt d'avoir des photos.
//
// Ici l'image occupe toute la largeur de la tuile, au même ratio 4:3 que la
// vignette des rangées d'Emplacement : un objet a la même tête partout dans
// l'app, qu'on le croise en cherchant ou en naviguant.
//
// Aucune icône par-dessus l'image (demande explicite) : quand la photo
// manque, c'est l'illustration du NIVEAU qui s'affiche, et elle distingue
// déjà un objet d'une pièce ou d'une boîte.
//
// TROIS PAR RANGÉE depuis le 2026-08-24 (deux auparavant). La tuile passe de
// 164 à 108 px de large et de 181 à 126 px de haut : une dizaine d'objets
// tiennent maintenant à l'écran au lieu de cinq. Une photo de 82 px suffit
// largement à reconnaître un objet — c'est le PARCOURS qui coûtait cher, pas
// la reconnaissance.
//
// EN GROS TEXTE, LA TUILE DEVIENT UNE RANGÉE (`columns === 1`). Une tuile
// pleine largeur aurait porté une photo de 240 px de haut : un objet et demi
// par écran, soit le contraire du service rendu. Couchée, la même carte garde
// une vignette lisible et laisse au nom toute la largeur — c'est le passage
// que font les listes du système quand le texte grossit.
//
// Deux lignes pour le nom, une pour l'emplacement : à x1,6 « Chargeur
// d'ordinateur portable » tenait sur une ligne de tuile étroite comme
// « Charg… », ce qui ne distingue plus rien.
export function ResultCard({ entry, columns }: ResultCardProps) {
  const rowThumbWidth = useScaled(ROW_THUMB_WIDTH);
  const asRow = columns <= 1;

  const image = (
    <Image
      source={entry.photo_url ? { uri: entry.photo_url } : PLACEHOLDER_IMAGES[LEVEL_BY_KIND[entry.kind]]}
      style={{ width: '100%', height: '100%' }}
      contentFit="cover"
    />
  );

  if (asRow) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push(`/${ROUTE_BY_KIND[entry.kind]}/${entry.id}`)}
        className="mb-2.5 w-full flex-row items-center overflow-hidden rounded-[14px] bg-surface active:opacity-70"
      >
        <View style={{ width: rowThumbWidth, aspectRatio: 4 / 3 }} className="bg-sand">
          {image}
        </View>
        <View className="flex-1 px-3 py-2">
          <Text numberOfLines={2} className="text-base font-semibold text-ink">
            {entry.name}
          </Text>
          <Text numberOfLines={1} className="mt-0.5 text-sm text-ink-soft">
            {locationLine(entry)}
          </Text>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/${ROUTE_BY_KIND[entry.kind]}/${entry.id}`)}
      style={{ width: TILE_WIDTH[columns] ?? TILE_WIDTH[3] }}
      className="mb-2.5 overflow-hidden rounded-[14px] bg-surface active:opacity-70"
    >
      {/* `aspectRatio` plutôt qu'une hauteur fixe : la largeur d'une tuile
          dépend de celle de l'écran, une hauteur en dur déformerait le
          cadrage sur les petits comme sur les grands. */}
      <View style={{ width: '100%', aspectRatio: 4 / 3 }} className="bg-sand">
        {image}
      </View>

      <View className="px-2 pb-2 pt-1.5">
        {/* Tailles en `rem` et non en pixels : c'est ce qui les fait suivre le
            réglage de taille de l'app, comme le reste des classes Tailwind.
            0,93rem et 0,71rem valent 13 px et 10 px à taille normale — les
            valeurs d'origine, au dixième près. */}
        <Text numberOfLines={2} className="text-[0.93rem] font-semibold text-ink">
          {entry.name}
        </Text>
        <Text numberOfLines={1} className="mt-px text-[0.71rem] text-ink-soft">
          {locationLine(entry)}
        </Text>
      </View>
    </Pressable>
  );
}
