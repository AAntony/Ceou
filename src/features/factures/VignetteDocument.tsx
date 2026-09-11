import { Image } from 'expo-image';
import { View } from 'react-native';
import { Icon } from '../../components/Icon';
import { useMediaSource } from '../../lib/images/media';
import { useScaled } from '../../lib/textScale';
import { useThemeColors } from '../../lib/theme';

// LA VIGNETTE D'UNE FACTURE, PARTOUT PAREILLE.
//
// Les mêmes dix lignes vivaient en trois exemplaires — la carte de la fiche
// d'un objet, celle du dossier d'un logement, la rangée de l'écran de
// rattachement — et l'arrivée des PDF demandait de corriger les trois. Une de
// plus demain n'aurait rien su de ces trois-là.
//
// PROPORTION D'UN TICKET, plus haute que large : c'est ce qui la fait
// reconnaître comme un document et non comme la photo d'un objet. Dessinée en
// pixels, donc mise à l'échelle avec le texte posé à côté — sinon elle
// devient un timbre quand le texte double.
//
// UN PDF N'A PAS DE VIGNETTE. En fabriquer une demanderait d'embarquer un
// lecteur de PDF, c'est-à-dire un module natif et un nouveau build pour tout
// le monde. On montre son icône, dans la couleur d'accent plutôt qu'en gris :
// ce n'est pas une absence de document, c'en est un d'une autre nature.

type VignetteDocumentProps = {
  documentUrl: string | null;
  /** `image` ou `pdf` — l'un se montre, l'autre se nomme. */
  documentKind: string;
  /** Mesures NON mises à l'échelle : le composant s'en charge. */
  width: number;
  height: number;
  /** Taille de l'icône de repli. Non mise à l'échelle non plus (voir Icon). */
  iconSize: number;
};

export function VignetteDocument({ documentUrl, documentKind, width, height, iconSize }: VignetteDocumentProps) {
  const colors = useThemeColors();
  const estPdf = documentKind === 'pdf';
  // Rien à signer pour un PDF : on ne l'affichera pas, et une signature est un
  // aller-retour réseau par rangée de liste.
  const vignette = useMediaSource(estPdf ? null : documentUrl);

  const largeur = useScaled(width);
  const hauteur = useScaled(height);

  return (
    <View
      style={{ width: largeur, height: hauteur }}
      className="overflow-hidden rounded-lg border border-ink/10 bg-sand-dark"
    >
      {vignette ? (
        <Image source={vignette} style={{ width: '100%', height: '100%' }} contentFit="cover" />
      ) : (
        <View className="flex-1 items-center justify-center">
          <Icon
            name={estPdf ? 'pdf' : 'facture'}
            size={iconSize}
            color={estPdf ? colors.accentDark : colors.inkFaint}
          />
        </View>
      )}
    </View>
  );
}
