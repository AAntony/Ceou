import { Pressable } from 'react-native';
import { Icon } from './Icon';

type HeaderAddButtonProps = {
  onPress: () => void;
  accessibilityLabel: string;
};

// Bouton "+" de l'en-tête natif (`headerRight`), qui remplace les barres
// d'action en bas de page.
//
// Le partage vertical qu'installe ce bouton : le "+" corail de la barre du
// bas porte l'action FRÉQUENTE (ajouter un objet, plusieurs fois par jour,
// donc au pouce), celui-ci porte les actions STRUCTURELLES et RARES (créer
// une pièce, un emplacement, un plan — une fois dans la vie d'une
// habitation). Le coin haut-droit est le point le moins accessible d'un
// grand téléphone : c'est précisément ce qui en fait le bon endroit pour ce
// qu'on fait rarement, et le mauvais pour ce qu'on répète.
//
// `accessibilityLabel` est obligatoire : un "+" seul ne dit pas ce qu'il
// ajoute à un lecteur d'écran, et il change de cible selon l'écran.
export function HeaderAddButton({ onPress, accessibilityLabel }: HeaderAddButtonProps) {
  return (
    <Pressable onPress={onPress} hitSlop={12} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
      <Icon name="add" size={24} color="#FF6B4A" />
    </Pressable>
  );
}
