import { useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AccessibilityInfo, Animated, Easing, View } from 'react-native';
import { useThemeColors } from '../../lib/theme';

// « C'EST CE BOUTON-LÀ. »
//
// Un tutoriel qui écrit « appuie sur Ajouter une facture » suppose qu'on
// reconnaisse le bouton avant de l'avoir jamais vu. L'anneau qui bat autour
// de la tuile, dans l'écran simulé, dit la même chose sans une phrase de
// plus — et le dit à l'endroit exact.
//
// ⚠️ IL S'ARRÊTE QUAND LE SYSTÈME DEMANDE MOINS D'ANIMATIONS. Une boucle
// perpétuelle est précisément ce que ce réglage existe pour éteindre : chez
// qui y est sensible, un mouvement qui ne s'arrête jamais au milieu d'un
// texte à lire rend la page inutilisable. L'anneau reste alors affiché, FIXE
// — l'information (« c'est ici ») ne se perd pas, seul le battement
// disparaît. C'est le premier endroit de l'app qui consulte ce réglage ; s'il
// en vient d'autres, ce serait le moment d'en faire un hook partagé.
//
// ⚠️ L'ANNEAU SE DESSINE PAR-DESSUS, ET DÉBORDE. Les deux vont ensemble, et
// la première version se trompait sur les deux : peint DERRIÈRE un bouton
// opaque et exactement à sa taille, il était intégralement masqué par lui —
// invisible à l'écran alors qu'il existait bien dans l'arbre. Il est donc posé
// après les enfants, avec un écart négatif qui le fait sortir de leurs bords.
// Comme il n'a qu'une bordure et aucun fond, passer devant ne cache rien.

const ECART = 4;

type PulseProps = PropsWithChildren<{
  /** Le rayon du contenu entouré : l'anneau doit épouser sa forme, pas la deviner. */
  radius?: number;
}>;

export function Pulse({ radius = 16, children }: PulseProps) {
  const colors = useThemeColors();
  const [anime, setAnime] = useState(false);
  const battement = useRef(new Animated.Value(0)).current;

  // FAUX PAR DÉFAUT, puis vrai une fois le réglage connu : on préfère
  // commencer immobile et se mettre à battre, plutôt que l'inverse.
  useEffect(() => {
    let monte = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduit) => {
        if (monte) setAnime(!reduit);
      })
      .catch(() => {
        // Réglage illisible : on anime, comme partout ailleurs dans l'app.
        if (monte) setAnime(true);
      });

    const abonnement = AccessibilityInfo.addEventListener('reduceMotionChanged', (reduit) => setAnime(!reduit));
    return () => {
      monte = false;
      abonnement.remove();
    };
  }, []);

  useEffect(() => {
    if (!anime) return;
    // `Animated.loop` remet la valeur à zéro entre deux tours : une seule
    // animation suffit, pas de séquence aller-retour.
    const boucle = Animated.loop(
      Animated.timing(battement, {
        toValue: 1,
        duration: 1800,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    );
    boucle.start();
    return () => {
      boucle.stop();
      battement.setValue(0);
    };
  }, [anime, battement]);

  // L'écart qui fait sortir l'anneau des bords du contenu. Le rayon le suit,
  // sinon l'arrondi de l'anneau ne colle plus à celui du bouton.
  const anneau = {
    position: 'absolute' as const,
    top: -ECART,
    left: -ECART,
    right: -ECART,
    bottom: -ECART,
    borderRadius: radius + ECART,
    borderWidth: 2,
    borderColor: colors.accentDark,
  };

  return (
    <View>
      {children}
      {anime ? (
        <Animated.View
          pointerEvents="none"
          style={[
            anneau,
            {
              opacity: battement.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.9, 0] }),
              transform: [{ scale: battement.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }) }],
            },
          ]}
        />
      ) : (
        <View pointerEvents="none" style={anneau} />
      )}
    </View>
  );
}
