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
// Pastille et non icône nue : un "+" seul sur le fond de l'en-tête se lisait
// comme un ornement plutôt que comme un bouton (retour utilisateur du
// 2026-08-19). Le cerne et le fond lui donnent une surface cliquable visible.
//
// Volontairement en corail CLAIR bordé, et pas en corail plein comme le "+"
// de la barre du bas : les deux boutons portent des actions différentes
// (objet ici, structure là), ils ne doivent donc pas se ressembler au point
// d'être confondus. Même langage que la variante `outline` du Button.
export function HeaderAddButton({ onPress, accessibilityLabel }: HeaderAddButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className="h-9 w-9 items-center justify-center rounded-full border-2 border-coral bg-coral-light active:opacity-70"
    >
      <Icon name="add" size={20} color="#E2543A" />
    </Pressable>
  );
}
