import { Pressable, Text } from 'react-native';
import { Icon } from './Icon';

type HeaderAddButtonProps = {
  onPress: () => void;
  // Sert À LA FOIS de texte visible et de libellé d'accessibilité : le
  // bouton dit ce qu'il ajoute, donc les deux ne peuvent pas diverger.
  label: string;
};

// L'en-tête natif applique déjà son propre retrait à droite (~16 dp). On
// ajoute le complément pour retomber sur les 24 px de marge du contenu de
// l'app (px-6), au lieu de coller le bouton au bord.
const EXTRA_RIGHT_MARGIN = 8;

// Pastille libellée dans l'en-tête natif (`headerRight`), qui remplace les
// barres d'action en bas de page.
//
// Le partage vertical qu'elle installe : le "+" corail plein de la barre du
// bas porte l'action FRÉQUENTE (ajouter un objet, depuis n'importe où, donc
// au pouce), celle-ci porte les actions STRUCTURELLES et RARES (créer une
// pièce, un emplacement, un plan — une fois dans la vie d'une habitation).
// Le coin haut-droit est le point le moins accessible d'un grand téléphone :
// c'est ce qui en fait le bon endroit pour ce qu'on fait une fois, et le
// mauvais pour ce qu'on répète.
//
// Corail CLAIR bordé et non corail plein, précisément pour que les deux "+"
// de l'écran ne se confondent pas — même langage que la variante `outline`
// du Button.
export function HeaderAddButton({ onPress, label }: HeaderAddButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ marginRight: EXTRA_RIGHT_MARGIN }}
      className="flex-row items-center gap-1 rounded-full border-2 border-coral bg-coral-light px-3 py-1.5 active:opacity-70"
    >
      <Icon name="add" size={16} color="#E2543A" />
      <Text className="text-sm font-semibold text-coral-dark">{label}</Text>
    </Pressable>
  );
}
