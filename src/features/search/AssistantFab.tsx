import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Easing, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTabBarHeight } from '../../components/AppTabBar';
import { Icon } from '../../components/Icon';
import { useTextScale } from '../../lib/textScale';

// Bouton d'appel à l'assistant vocal.
//
// Remplace la petite pastille micro qui vivait à droite du champ de
// recherche (retour utilisateur du 2026-08-21 : « trop discrète »). Trois
// raisons de le déplacer ici plutôt que de simplement grossir l'ancienne :
//
// - PORTÉE DU POUCE. Le champ de recherche est en haut de l'écran, la zone
//   la plus difficile à atteindre d'une seule main sur un téléphone récent.
//   Le bas de l'écran est la seule région confortable pour un pouce, quelle
//   que soit la taille de la main.
// - LISIBILITÉ. Une icône seule laisse deviner ; un libellé écrit à côté
//   dit ce qui va se passer. C'est ce qui fait la différence pour quelqu'un
//   qui n'a pas grandi avec les conventions d'interface — précisément le
//   public qu'on veut servir avec la voix.
// - UNE SEULE PORTE. Deux micros (un dans la barre, un flottant) auraient
//   partagé l'attention sans jamais paraître importants. Il n'en reste
//   qu'un, et il est impossible à manquer.
//
// Le libellé dit le nom de l'app parce que « Céoù » EST la question que
// le bouton pose — « c'est où ? ». Le clin d'œil ne coûte rien à la
// clarté : « Demande à Céoù » se comprend sans connaître la marque.
//
// Volontairement au-dessus de la barre d'onglets et non dedans : le "+"
// central de la barre avait déjà été retiré pour cause d'ambiguïté (voir
// AppTabBar), et un cinquième onglet aurait rétréci les quatre autres.

const ACCENT = '#1591EA';
const BUTTON_HEIGHT = 56;
const ICON_SIZE = 22;

// Le libellé (« Demande à Céoù ») est long pour un bouton flottant : ces
// trois valeurs sont resserrées d'un cran par rapport à un libellé d'un
// seul mot, pour que la pastille garde l'air de flotter au-dessus de la
// grille au lieu de barrer l'écran. La cible reste bien au-dessus des
// 44 px recommandés, portée par la hauteur.
const PADDING_HORIZONTAL = 18;
const LABEL_SIZE = 15;
const GAP = 8;
const GAP_ABOVE_TAB_BAR = 16;
const FAB_MARGIN = 20;

// Le bouton est dessiné en pixels bruts (ombre, anneau animé, rayon), donc
// hors de portée de `rem` : ses cinq mesures sont mises à l'échelle à la
// main. Il le mérite plus que tout autre contrôle de l'app — c'est la porte
// d'entrée de la commande vocale, celle qui sert d'abord à qui lit mal
// l'écran.
function useFabMetrics() {
  const { factor } = useTextScale();
  return {
    height: Math.round(BUTTON_HEIGHT * factor),
    paddingHorizontal: Math.round(PADDING_HORIZONTAL * factor),
    labelSize: Math.round(LABEL_SIZE * factor),
    gap: Math.round(GAP * factor),
  };
}

/** Anneau qui s'écarte en boucle pendant l'écoute. */
function ListeningRing({ active, height }: { active: boolean; height: number }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      progress.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 1400,
        easing: Easing.out(Easing.ease),
        // Échelle et opacité passent toutes deux par le pilote natif : cette
        // boucle tourne pendant que la reconnaissance vocale travaille, ce
        // n'est pas le moment de charger le fil JS.
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [active, progress]);

  if (!active) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: height / 2,
        backgroundColor: ACCENT,
        opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
        transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] }) }],
      }}
    />
  );
}

export function AssistantFab({ active, onPress }: { active: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useAppTabBarHeight();
  const { height, paddingHorizontal, labelSize, gap } = useFabMetrics();
  const { width: screenWidth } = useWindowDimensions();

  return (
    <View
      // `box-none` : seul le bouton reçoit les touches, le reste de la zone
      // laisse passer les gestes vers la liste qui défile en dessous.
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        right: FAB_MARGIN,
        bottom: insets.bottom + tabBarHeight + GAP_ABOVE_TAB_BAR,
      }}
    >
      <ListeningRing active={active} height={height} />
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        accessibilityLabel={t(active ? 'assistant.session.title' : 'home.assistant_a11y')}
        style={{
          height,
          // Le conteneur n'est ancre qu'a DROITE : sans plafond, un bouton
          // devenu plus large que l'ecran depasserait par la gauche au lieu
          // de se replier. Le libelle en `shrink` cede a la place.
          maxWidth: screenWidth - 2 * FAB_MARGIN,
          flexDirection: 'row',
          alignItems: 'center',
          gap,
          paddingHorizontal,
          borderRadius: height / 2,
          backgroundColor: ACCENT,
          // Ombre portée : c'est ce qui décolle le bouton de la grille de
          // cartes et le fait lire comme flottant. `elevation` pour Android,
          // les `shadow*` pour iOS — les deux sont nécessaires.
          elevation: 6,
          shadowColor: '#000',
          shadowOpacity: 0.22,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
        }}
      >
        {/* Icon met deja `size` a l'echelle : la taille de base lui suffit. */}
        <Icon name="microphone" size={ICON_SIZE} color="#FFFFFF" />
        {/* `shrink` : le libelle cede avant que le bouton ne sorte de
            l'ecran — a x1,6 « Demande a Ceou » approche de la largeur utile
            d'un telephone etroit. */}
        <Text numberOfLines={1} className="shrink" style={{ color: '#FFFFFF', fontSize: labelSize, fontWeight: '600' }}>
          {active ? t('assistant.session.title') : t('home.assistant_cta')}
        </Text>
      </Pressable>
    </View>
  );
}
