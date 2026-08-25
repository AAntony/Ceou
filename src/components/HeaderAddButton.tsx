import { useTranslation } from 'react-i18next';
import { Pressable, Text } from 'react-native';
import { MAX_CHROME_SCALE, useChromeScale } from '../lib/textScale';
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
// LA PASTILLE GRANDIT, MAIS PAS AUTANT QUE LE CONTENU.
//
// Elle est posee dans l'en-tete NATIF, dont la hauteur est fixee par le
// systeme (~56 dp sur Android) et ne se regle pas : a x1,6 elle depasserait
// et serait rognee en haut et en bas. Ses mesures sont donc ecrites en
// pixels, plafonnees comme le reste du mobilier, au lieu de passer par des
// classes Tailwind qui suivraient le facteur entier.
//
// A x1,3 elle passe quand meme de ~30 a ~42 points de haut et son libelle de
// 14 a 18 : la cible devient franchement plus facile a viser, ce qui etait
// le reproche.
const ICON_SIZE = 16;
const LABEL_SIZE = 14;
const PADDING_H = 12;
const PADDING_V = 6;

export function HeaderAddButton({ onPress, label }: HeaderAddButtonProps) {
  const { t } = useTranslation();
  const chrome = useChromeScale();

  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        marginRight: EXTRA_RIGHT_MARGIN,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Math.round(4 * chrome),
        borderRadius: 999,
        paddingHorizontal: Math.round(PADDING_H * chrome),
        paddingVertical: Math.round(PADDING_V * chrome),
      }}
      className="bg-coral active:opacity-80"
    >
      {/* `fixedSize` : la taille porte deja le plafond, Icon ne doit pas la
          remultiplier par le facteur entier. */}
      <Icon name="add" size={Math.round(ICON_SIZE * chrome)} color="#FFFFFF" fixedSize />
      {/* Une seule ligne, et le reglage du telephone plafonne lui aussi : la
          barre native ne peut pas s'agrandir pour accueillir un repli. */}
      <Text
        numberOfLines={1}
        maxFontSizeMultiplier={MAX_CHROME_SCALE}
        style={{ fontSize: Math.round(LABEL_SIZE * chrome), fontWeight: '600', color: '#FFFFFF' }}
      >
        {t('common.add')}
      </Text>
    </Pressable>
  );
}
