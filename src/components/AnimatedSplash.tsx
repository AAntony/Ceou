import { useEffect, useState } from 'react';
import { Image, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

// Écran de démarrage animé : la loupe balaie le mot « Céoù » et le révèle sur
// son passage, puis remonte à sa place au-dessus.
//
// POURQUOI CODÉ ET PAS UNE VIDÉO : une vidéo doit initialiser un lecteur puis
// décoder sa première image, soit 150 à 400 ms sur Android — précisément au
// moment où rien n'est encore initialisé. Elle a aussi un format et une durée
// FIXES, alors qu'un écran de démarrage doit remplir n'importe quel écran et
// s'effacer pile quand l'application est prête. Ici tout est du transform,
// donc la première image s'affiche immédiatement.
//
// Le mot n'est pas composé lettre par lettre : c'est l'image réelle du logo,
// découverte par un masque de la couleur du fond qui glisse avec la loupe.
// Rien à recaler à la main, aucune police à faire correspondre.

export const SPLASH_BACKGROUND = '#1591EA';

// Dimensions natives des deux découpes (voir assets/splash-*.png), gardées
// ici pour que les proportions ne dépendent pas du chargement de l'image.
const WORD_RATIO = 579 / 240;
const LENS_RATIO = 489 / 490;

const WORD_WIDTH = 208;
const WORD_HEIGHT = WORD_WIDTH / WORD_RATIO;
const LENS_SWEEP_SIZE = 56;
const LENS_FINAL_SIZE = 112;
const LENS_SCALE = LENS_FINAL_SIZE / LENS_SWEEP_SIZE;
const LENS_GAP = 24;

const BOX_WIDTH = WORD_WIDTH;
const BOX_HEIGHT = LENS_FINAL_SIZE + LENS_GAP + WORD_HEIGHT;

// La loupe part et arrive légèrement HORS du mot : sinon la première et la
// dernière lettre semblent apparaître d'elles-mêmes, sans avoir été balayées.
const SWEEP_FROM = -14;
const SWEEP_TO = WORD_WIDTH + 14;
const SWEEP_CENTER_Y = BOX_HEIGHT - WORD_HEIGHT / 2;
const FINAL_CENTER_X = WORD_WIDTH / 2;
const FINAL_CENTER_Y = LENS_FINAL_SIZE / 2;

const START_DELAY_MS = 80;
const SWEEP_MS = 820;
const RISE_MS = 400;
const HOLD_MS = 420;
const EXIT_MS = 320;

/** Durée minimale avant de pouvoir s'effacer — la séquence plus sa pause. */
const MIN_VISIBLE_MS = START_DELAY_MS + SWEEP_MS + RISE_MS + HOLD_MS;

type AnimatedSplashProps = {
  /** L'application est prête à être montrée (session résolue). */
  ready: boolean;
  /** Appelé une fois le fondu terminé — le parent peut alors nous démonter. */
  onFinish: () => void;
  /** Appelé dès que notre fond bleu est peint, pour retirer le splash natif. */
  onPainted?: () => void;
};

export function AnimatedSplash({ ready, onFinish, onPainted }: AnimatedSplashProps) {
  const sweep = useSharedValue(0);
  const rise = useSharedValue(0);
  const exit = useSharedValue(0);
  const [sequenceDone, setSequenceDone] = useState(false);

  useEffect(() => {
    sweep.value = withDelay(START_DELAY_MS, withTiming(1, { duration: SWEEP_MS, easing: Easing.inOut(Easing.ease) }));
    // La loupe remonte avec un léger dépassement : c'est ce qui la fait
    // ressembler à un objet posé plutôt qu'à une image qui glisse.
    rise.value = withDelay(
      START_DELAY_MS + SWEEP_MS,
      withTiming(1, { duration: RISE_MS, easing: Easing.out(Easing.back(1.4)) }),
    );

    const timer = setTimeout(() => setSequenceDone(true), MIN_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [sweep, rise]);

  useEffect(() => {
    // Deux conditions, et les deux comptent : partir avant la fin de la
    // séquence la tronquerait, partir avant que la session soit résolue
    // ferait apparaître un écran vide le temps qu'elle arrive.
    if (!ready || !sequenceDone) return;
    exit.value = withTiming(1, { duration: EXIT_MS, easing: Easing.in(Easing.ease) }, (finished) => {
      if (finished) runOnJS(onFinish)();
    });
  }, [ready, sequenceDone, exit, onFinish]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: 1 - exit.value,
  }));

  const boxStyle = useAnimatedStyle(() => ({
    // Léger agrandissement en partant : donne l'impression d'entrer DANS
    // l'application plutôt que de voir une image disparaître.
    transform: [{ scale: interpolate(exit.value, [0, 1], [1, 1.08]) }],
  }));

  const lensStyle = useAnimatedStyle(() => {
    const sweptX = interpolate(sweep.value, [0, 1], [SWEEP_FROM, SWEEP_TO]);
    const centerX = interpolate(rise.value, [0, 1], [sweptX, FINAL_CENTER_X]);
    const centerY = interpolate(rise.value, [0, 1], [SWEEP_CENTER_Y, FINAL_CENTER_Y]);
    return {
      opacity: sweep.value > 0 || rise.value > 0 ? 1 : 0,
      transform: [
        // La vue fait LENS_SWEEP_SIZE et son coin est en (0,0) : on déplace
        // son CENTRE, puis on l'agrandit — une mise à l'échelle se fait
        // autour du centre, elle ne déplace donc rien.
        { translateX: centerX - LENS_SWEEP_SIZE / 2 },
        { translateY: centerY - LENS_SWEEP_SIZE / 2 },
        { scale: interpolate(rise.value, [0, 1], [1, LENS_SCALE]) },
      ],
    };
  });

  const maskStyle = useAnimatedStyle(() => ({
    // Le masque suit EXACTEMENT le centre de la loupe pendant le balayage :
    // les deux lisent la même valeur, ils ne peuvent pas se désynchroniser.
    transform: [{ translateX: interpolate(sweep.value, [0, 1], [SWEEP_FROM, SWEEP_TO]) }],
  }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.overlay, overlayStyle]}
      onLayout={onPainted}
      pointerEvents="none"
    >
      <Animated.View style={[styles.box, boxStyle]}>
        <Image source={require('../../assets/splash-wordmark.png')} style={styles.word} resizeMode="contain" />

        {/* Rectangle de la couleur du fond, invisible en tant que tel : il
            cache le mot puis le libère en glissant vers la droite. */}
        <Animated.View style={[styles.mask, maskStyle]} />

        <Animated.View style={[styles.lens, lensStyle]}>
          <Image source={require('../../assets/splash-lens.png')} style={styles.lensImage} resizeMode="contain" />
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: SPLASH_BACKGROUND,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  box: {
    width: BOX_WIDTH,
    height: BOX_HEIGHT,
  },
  word: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    width: WORD_WIDTH,
    height: WORD_HEIGHT,
  },
  mask: {
    position: 'absolute',
    left: 0,
    // Déborde le mot de tous les côtés : un masque au pixel près laisserait
    // affleurer un liseré d'anticrénelage sur les bords hauts et bas.
    bottom: -8,
    width: WORD_WIDTH + 48,
    height: WORD_HEIGHT + 16,
    backgroundColor: SPLASH_BACKGROUND,
  },
  lens: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: LENS_SWEEP_SIZE,
    height: LENS_SWEEP_SIZE,
  },
  lensImage: {
    width: LENS_SWEEP_SIZE,
    height: LENS_SWEEP_SIZE / LENS_RATIO,
  },
});
