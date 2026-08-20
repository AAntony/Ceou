import { Link, type Href } from 'expo-router';
import { Pressable, Text } from 'react-native';

// Minimum recommandé pour une cible tactile (Material / HIG). Les liens
// textuels de l'app tombaient tous bien en dessous : un `<Link>` d'expo-router
// rend un `<Text>`, dont la zone sensible est EXACTEMENT la hauteur de la
// ligne de texte — une bande d'une vingtaine de pixels.
const MIN_TOUCH_HEIGHT = 44;

type TextLinkProps = {
  label: string;
  /** Navigation déclarative. Exclusif avec `onPress`. */
  href?: Href;
  /** Action locale (déconnexion, fermeture d'une modale). Exclusif avec `href`. */
  onPress?: () => void;
  /** Classes du CONTENEUR cliquable : marges, alignement, apparence de carte. */
  className?: string;
  /** Classes du TEXTE : taille, graisse, couleur, soulignement. */
  textClassName?: string;
};

// Règle que ce composant matérialise : LE PRESSABLE EST L'ÉLÉMENT VISIBLE
// EXTÉRIEUR, JAMAIS UN NŒUD DE TEXTE À L'INTÉRIEUR.
//
// Le défaut corrigé (remonté par les testeurs sur "Politique de
// confidentialité") était une inversion de cette règle : une carte blanche
// avec bordure dessinée par un `View` INERTE, dont seul le texte intérieur
// réagissait. L'app dessinait un bouton et n'en rendait cliquable que le
// contenu — appuyer sur la carte, geste évident, ne faisait rien.
//
// La hauteur minimale garantit la cible même quand l'appelant ne met aucun
// rembourrage ; `hitSlop` l'élargit encore sans rien changer à la mise en
// page. L'apparence reste entièrement à la charge de l'appelant, ce
// composant ne décide que du comportement tactile.
export function TextLink({ label, href, onPress, className, textClassName }: TextLinkProps) {
  const content = (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="link"
      className={`justify-center active:opacity-60 ${className ?? ''}`}
      style={{ minHeight: MIN_TOUCH_HEIGHT }}
    >
      <Text className={textClassName}>{label}</Text>
    </Pressable>
  );

  // `asChild` fait porter la navigation par le Pressable lui-même plutôt que
  // par un Text interposé — c'est ce qui rend toute la surface cliquable.
  return href ? (
    <Link href={href} asChild>
      {content}
    </Link>
  ) : (
    content
  );
}
