import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Easing, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_TAB_BAR_HEIGHT } from '../../components/AppTabBar';
import { Icon } from '../../components/Icon';

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
// Volontairement au-dessus de la barre d'onglets et non dedans : le "+"
// central de la barre avait déjà été retiré pour cause d'ambiguïté (voir
// AppTabBar), et un cinquième onglet aurait rétréci les quatre autres.

const ACCENT = '#1591EA';
const BUTTON_HEIGHT = 56;
const ICON_SIZE = 24;
const GAP_ABOVE_TAB_BAR = 16;

/** Anneau qui s'écarte en boucle pendant l'écoute. */
function ListeningRing({ active }: { active: boolean }) {
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
        borderRadius: BUTTON_HEIGHT / 2,
        backgroundColor: ACCENT,
        opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
        transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] }) }],
      }}
    />
  );
}

export function AssistantFab({ isListening, onPress }: { isListening: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View
      // `box-none` : seul le bouton reçoit les touches, le reste de la zone
      // laisse passer les gestes vers la liste qui défile en dessous.
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        right: 20,
        bottom: insets.bottom + APP_TAB_BAR_HEIGHT + GAP_ABOVE_TAB_BAR,
      }}
    >
      <ListeningRing active={isListening} />
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected: isListening }}
        accessibilityLabel={t('home.assistant_a11y')}
        style={{
          height: BUTTON_HEIGHT,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingHorizontal: 22,
          borderRadius: BUTTON_HEIGHT / 2,
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
        <Icon name="microphone" size={ICON_SIZE} color="#FFFFFF" />
        <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>
          {isListening ? t('home.voice_search_listening') : t('home.assistant_cta')}
        </Text>
      </Pressable>
    </View>
  );
}
