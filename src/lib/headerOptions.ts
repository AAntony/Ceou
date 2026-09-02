import { Platform } from 'react-native';
import { useChromeScale } from './textScale';
import { useThemeColors } from './theme';

// Taille par défaut du titre dans l'en-tête natif, par plateforme. Elle n'est
// REDÉCLARÉE que si la personne a demandé plus grand : à taille normale on
// laisse le système décider, plutôt que de figer aujourd'hui une valeur qui
// pourrait changer avec la prochaine version de React Navigation.
const HEADER_TITLE_SIZE = Platform.OS === 'ios' ? 17 : 20;

// L'APPARENCE DE L'EN-TÊTE, ÉCRITE UNE SEULE FOIS.
//
// Sans ces trois valeurs, React Navigation applique son thème par défaut :
// fond BLANC, quel que soit le nôtre. C'est ce qui se voyait sur « Prêts »,
// en thème clair comme en thème sombre — l'écran était le seul blanc de
// l'app, et en sombre il éblouissait.
//
// La cause n'était pas dans l'écran mais dans le navigateur qui le porte :
// app/_layout.tsx ne posait que `headerShown: false`, si bien que tout écran
// racine rallumant son en-tête (Prêts, Compte, Invitations, Confidentialité,
// Passer en compte complet) héritait du blanc. Les groupes (entities) et
// (tabs), eux, déclaraient chacun leur copie de ces valeurs.
//
// D'où ce fichier : les trois navigateurs le lisent, et la question ne peut
// plus se poser une quatrième fois. Recopiées, ces valeurs finiraient par
// diverger — c'est exactement le genre d'écart qu'on a déjà passé du temps à
// traquer ici.
//
// Ce que ce hook ne contient PAS : ce qui dépend du navigateur. L'en-tête du
// Stack est natif, celui des onglets est rendu en JavaScript — leurs options
// de hauteur et de bouton retour ne sont pas les mêmes, et restent chez eux.
export function useHeaderOptions() {
  const colors = useThemeColors();
  // La HAUTEUR de l'en-tête natif n'est pas réglable (c'est une barre
  // système) : seul le titre grandit, et jusqu'au plafond du mobilier — au-delà
  // il serait rogné par le haut et par le bas.
  const chrome = useChromeScale();

  return {
    headerStyle: { backgroundColor: colors.sand },
    headerTintColor: colors.accent,
    headerTitleStyle: {
      color: colors.ink,
      ...(chrome > 1 ? { fontSize: Math.round(HEADER_TITLE_SIZE * chrome) } : {}),
    },
  };
}
