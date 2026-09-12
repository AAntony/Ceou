import { ActivityIndicator, Pressable } from 'react-native';
import { useChromeScale } from '../lib/textScale';
import { useThemeColors } from '../lib/theme';
import { Icon } from './Icon';

type HeaderSaveButtonProps = {
  onPress: () => void;
  /**
   * Vrai des qu'un champ de l'ecran differe de ce qui est enregistre.
   * C'est LUI qui decide si la disquette est active ou grisee.
   */
  dirty: boolean;
  loading?: boolean;
  /** Libelle d'accessibilite : la disquette n'a pas de texte a cote d'elle. */
  label: string;
};

// L'en-tete natif applique deja son propre retrait a droite (~16 dp). On
// ajoute le complement pour retomber sur les 24 px de marge du contenu de
// l'app (px-6), au lieu de coller le bouton au bord — meme calcul que
// HeaderAddButton, avec lequel elle ne coexiste jamais sur un meme ecran.
const EXTRA_RIGHT_MARGIN = 8;

// La disquette est posee dans l'en-tete NATIF, dont la hauteur est fixee par
// le systeme et ne se regle pas : sa taille suit donc le mobilier (plafonne),
// pas le facteur entier du reglage de texte. Meme raisonnement que
// HeaderAddButton.
const ICON_SIZE = 24;
const PADDING = 6;

// ENREGISTRER EST DEVENU UN ETAT, PAS UN BOUTON TOUJOURS OFFERT.
//
// « Enregistrer » etait un bloc corail pleine largeur, en permanence
// cliquable au milieu de la fiche d'un objet et du Profil — y compris quand
// il n'y avait rien a enregistrer. Il promettait donc une action qui, la
// plupart du temps, ne faisait qu'une ecriture inutile en base ; et il
// occupait la place d'une vraie action au beau milieu du formulaire.
//
// Ici, la disquette REPOND A LA SAISIE : grisee tant que rien n'a change,
// elle prend la couleur d'accent des qu'un caractere differe de ce qui est
// enregistre. L'ecran dit ainsi en permanence s'il reste quelque chose a
// faire, ce qu'aucun bouton toujours identique ne pouvait dire.
//
// LE GRIS N'EST PAS UN DEFAUT DE CONTRASTE : `inkFaint` sur le sable ne tient
// pas les 4,5:1 exiges d'un texte, et n'a pas a les tenir — le critere 1.4.3
// exempte explicitement les composants INACTIFS. L'etat est par ailleurs
// annonce (`accessibilityState.disabled`), il ne repose donc pas sur la seule
// couleur.
export function HeaderSaveButton({ onPress, dirty, loading, label }: HeaderSaveButtonProps) {
  const colors = useThemeColors();
  const chrome = useChromeScale();
  const size = Math.round(ICON_SIZE * chrome);
  const inactive = !dirty || !!loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={{ marginRight: EXTRA_RIGHT_MARGIN, padding: PADDING }}
      className="active:opacity-60"
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.accentDark} style={{ width: size, height: size }} />
      ) : (
        // `fixedSize` : la taille porte deja le plafond du mobilier, Icon ne
        // doit pas la remultiplier par le facteur entier.
        <Icon name="save" size={size} color={dirty ? colors.accentDark : colors.inkFaint} fixedSize />
      )}
    </Pressable>
  );
}
