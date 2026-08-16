import type { PropsWithChildren } from 'react';
import { View } from 'react-native';

// EntityCard (et ResultCard) sont câblées en dur sur une largeur de 48% :
// nécessitent donc TOUJOURS un parent flex-row + flex-wrap pour former une
// grille à 2 colonnes, sinon elles s'empilent en une colonne étroite avec la
// moitié de l'écran perdue à droite. Un seul wrapper partagé plutôt que de
// répéter ce même className à chaque écran qui liste des cartes.
export function EntityGrid({ children }: PropsWithChildren) {
  return <View className="flex-row flex-wrap justify-between">{children}</View>;
}
