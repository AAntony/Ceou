import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { PLACEHOLDER_IMAGES, type EntityLevel } from '../inventory/placeholders';
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

function locationLine(entry: SearchIndexEntry): string {
  if (entry.kind === 'piece') return entry.habitation_name;
  if (entry.kind === 'emplacement') return entry.piece_name;
  return `${entry.parent_label} · ${entry.piece_name}`;
}

type ResultCardProps = {
  entry: SearchIndexEntry;
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
// Le nom descend de 16 à 13 px et se coupe quand il dépasse ; l'emplacement
// de 12 à 10 px. Il RESTE, malgré la place gagnée : dès qu'une recherche est
// tapée, la grille mêle objets, conteneurs, emplacements et pièces, et
// « Boîte à outils » ne se distingue de « Boîte à couture » que par cette
// seconde ligne.
export function ResultCard({ entry }: ResultCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/${ROUTE_BY_KIND[entry.kind]}/${entry.id}`)}
      // 31.5 % : trois tuiles plus les deux écarts de 9 px posés par la
      // rangée (COLUMN_WRAPPER, HomeDashboard) remplissent la largeur utile.
      className="mb-2.5 w-[31.5%] overflow-hidden rounded-[14px] bg-surface active:opacity-70"
    >
      {/* `aspectRatio` plutôt qu'une hauteur fixe : la largeur d'une tuile
          dépend de celle de l'écran, une hauteur en dur déformerait le
          cadrage sur les petits comme sur les grands. */}
      <View style={{ width: '100%', aspectRatio: 4 / 3 }} className="bg-sand">
        <Image
          source={entry.photo_url ? { uri: entry.photo_url } : PLACEHOLDER_IMAGES[LEVEL_BY_KIND[entry.kind]]}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
        />
      </View>

      <View className="px-2 pb-2 pt-1.5">
        <Text numberOfLines={1} className="text-[13px] font-semibold text-ink">
          {entry.name}
        </Text>
        <Text numberOfLines={1} className="mt-px text-[10px] text-ink-soft">
          {locationLine(entry)}
        </Text>
      </View>
    </Pressable>
  );
}
