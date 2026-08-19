import { useTranslation } from 'react-i18next';
import { Pressable, Text } from 'react-native';
import { Icon } from './Icon';

type HeaderAddButtonProps = {
  onPress: () => void;
  // Libellé d'ACCESSIBILITÉ uniquement ("Ajouter une pièce", "Ajouter un
  // plan"...). Le texte visible, lui, reste toujours "Ajouter" : dans un
  // en-tête natif, un libellé long rogne le titre de l'écran (voire le
  // tronque en "Appartement d…"), alors que l'écran affiché dit déjà de
  // quoi on parle. Le lecteur d'écran, qui n'a pas ce contexte visuel,
  // garde la phrase complète.
  label: string;
};

// L'en-tête natif applique déjà son propre retrait à droite (~16 dp). On
// ajoute le complément pour retomber sur les 24 px de marge du contenu de
// l'app (px-6), au lieu de coller le bouton au bord.
const EXTRA_RIGHT_MARGIN = 8;

// Pastille corail PLEINE dans l'en-tête natif (`headerRight`), qui remplace
// les barres d'action en bas de page.
//
// Le partage vertical qu'elle installe : le "+" rond de la barre du bas
// porte l'action FRÉQUENTE (ajouter un objet, depuis n'importe où, donc au
// pouce), celle-ci porte les actions STRUCTURELLES et RARES (créer une
// pièce, un emplacement, un plan — une fois dans la vie d'une habitation).
// Le coin haut-droit est le point le moins accessible d'un grand téléphone :
// c'est ce qui en fait le bon endroit pour ce qu'on fait une fois, et le
// mauvais pour ce qu'on répète.
//
// Une première version utilisait le corail CLAIR bordé pour éviter que les
// deux "+" de l'écran ne se confondent — jugée trop peu visible à l'usage.
// Fond plein désormais : les deux restent distinguables par la forme et la
// position (pastille libellée en haut / gros rond flottant en bas), pas par
// l'intensité de la couleur.
export function HeaderAddButton({ onPress, label }: HeaderAddButtonProps) {
  const { t } = useTranslation();

  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ marginRight: EXTRA_RIGHT_MARGIN }}
      className="flex-row items-center gap-1 rounded-full bg-coral px-3 py-1.5 active:opacity-80"
    >
      <Icon name="add" size={16} color="#FFFFFF" />
      <Text className="text-sm font-semibold text-white">{t('common.add')}</Text>
    </Pressable>
  );
}
