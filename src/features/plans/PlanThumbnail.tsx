import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { Icon } from '../../components/Icon';
import { useThemeColors } from '../../lib/theme';
import type { PlanForme } from '../../types/database';
import { WALL_COLOR } from './constants';

// Miniature d'un plan : ses pièces, dessinées en petit.
//
// POURQUOI PAS UNE ILLUSTRATION GÉNÉRIQUE, comme pour les autres niveaux :
// un croquis de « pièce » sert à représenter une pièce qu'on n'a pas
// photographiée. Un plan, lui, EST déjà un dessin — sa propre image est
// disponible gratuitement, et elle distingue immédiatement le
// rez-de-chaussée de l'étage, ce qu'aucune illustration commune ne ferait.
//
// Dessinée en View et non en SVG (react-native-svg est absent du projet, cf.
// IconBadge) ni en Skia (le canevas complet pour une vignette serait
// disproportionné, et il faudrait le monter une fois par rangée).
//
// CADRÉE SUR LES PIÈCES et non sur le monde : les formes occupent rarement
// plus d'un coin des 1200×1200 de l'espace de travail, à l'échelle du monde
// la vignette serait un timbre au milieu du vide.
//
// ELLE SE MESURE ELLE-MÊME plutôt que de recevoir sa taille. Elle recevait
// 84×63, la vignette compacte d'une rangée — et continuait de dessiner à
// cette taille-là quand la rangée passait en cartes empilées et lui offrait
// toute la largeur : le plan apparaissait minuscule au milieu de sa case
// (retour utilisateur du 2026-08-26). En se mesurant, elle remplit ce qu'on
// lui donne, quelle que soit la disposition.

type PlanThumbnailProps = {
  formes: PlanForme[];
  /** Même couleur que sur le canevas — la vignette doit ressembler au plan. */
  colorForForme: (forme: PlanForme) => string;
};

const PADDING = 4;

export function PlanThumbnail({ formes, colorForForme }: PlanThumbnailProps) {
  const colors = useThemeColors();
  const [box, setBox] = useState({ width: 0, height: 0 });

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    // Comparaison avant écriture : onLayout se déclenche à chaque mesure, et
    // reposer le même état ferait boucler le rendu.
    setBox((current) => (current.width === width && current.height === height ? current : { width, height }));
  };

  if (formes.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-sand">
        <Icon name="plan" size={26} color={colors.inkFaint} />
      </View>
    );
  }

  const minX = Math.min(...formes.map((f) => f.x));
  const minY = Math.min(...formes.map((f) => f.y));
  const maxX = Math.max(...formes.map((f) => f.x + f.width));
  const maxY = Math.max(...formes.map((f) => f.y + f.height));

  const innerWidth = Math.max(box.width - PADDING * 2, 1);
  const innerHeight = Math.max(box.height - PADDING * 2, 1);
  // Une seule échelle pour les deux axes : un plan étiré ne serait plus le
  // plan de personne.
  const scale = Math.min(innerWidth / Math.max(maxX - minX, 1), innerHeight / Math.max(maxY - minY, 1));

  // Reste de place après mise à l'échelle, réparti des deux côtés : le
  // logement est centré dans la vignette plutôt que collé en haut à gauche.
  const offsetX = PADDING + (innerWidth - (maxX - minX) * scale) / 2;
  const offsetY = PADDING + (innerHeight - (maxY - minY) * scale) / 2;

  return (
    <View className="flex-1 bg-sand" onLayout={handleLayout}>
      {/* Rien tant que la case n'est pas mesurée : au premier rendu la taille
          vaut zéro, et toutes les pièces s'y écraseraient sur un point. */}
      {box.width > 0 && box.height > 0
        ? formes.map((forme) => (
            <View
              key={forme.id}
              style={{
                position: 'absolute',
                left: offsetX + (forme.x - minX) * scale,
                top: offsetY + (forme.y - minY) * scale,
                width: Math.max(forme.width * scale, 2),
                height: Math.max(forme.height * scale, 2),
                backgroundColor: colorForForme(forme),
                borderWidth: 0.5,
                // Le MUR du canevas, valeur fixe et non jeton de theme : les
                // pieces gardent leurs pastels dans les deux themes, leur trait
                // doit donc rester sombre lui aussi — sinon la miniature ne
                // ressemble plus au plan qu'elle annonce.
                borderColor: WALL_COLOR,
              }}
            />
          ))
        : null}
    </View>
  );
}
