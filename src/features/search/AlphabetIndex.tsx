import { useRef, useState } from 'react';
import { Text, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_TAB_BAR_HEIGHT } from '../../components/AppTabBar';

// Barre alphabétique verticale, pour sauter d'un coup dans une longue liste.
//
// GLISSER, PAS SEULEMENT TAPER : c'est ce qui fait tout l'intérêt du procédé.
// On pose le pouce et on descend, la liste suit en continu — viser une lettre
// à chaque saut serait plus lent que de faire défiler.
//
// Elle occupe TOUTE la hauteur utile et se partage entre les lettres
// présentes : la zone tactile de chaque lettre est donc d'autant plus grande
// qu'il y en a peu. Une hauteur fixe par lettre donnait l'inverse — une barre
// minuscule au milieu de l'écran quand l'inventaire tenait sur cinq
// initiales, c'est-à-dire précisément quand elle était la plus facile à
// rendre confortable.
//
// Fond transparent : la barre vit par-dessus la grille, et un bandeau opaque
// sur le bord de l'écran se lirait comme un élément d'interface permanent
// alors que ce n'est qu'un raccourci. La bulle suffit à signaler qu'on agit.
//
// La bulle est nécessaire, pas décorative : sous le pouce, la lettre visée
// est précisément celle qu'on ne voit plus.

const BAR_WIDTH = 22;
const BUBBLE_SIZE = 48;
const ACCENT = '#1591EA';

type AlphabetIndexProps = {
  /** Lettres présentes dans la liste, déjà triées et dédoublonnées. */
  letters: string[];
  onSelect: (letter: string) => void;
};

export function AlphabetIndex({ letters, onSelect }: AlphabetIndexProps) {
  const insets = useSafeAreaInsets();
  const [active, setActive] = useState<string | null>(null);
  const [activeY, setActiveY] = useState(0);
  // Hauteur réellement occupée par la barre : elle dépend de l'écran, pas
  // d'une constante. C'est elle qui découpe les zones tactiles.
  const [barHeight, setBarHeight] = useState(0);
  // Dernière lettre notifiée : sans ce garde, un glissement lent relancerait
  // le défilement à chaque pixel parcouru à l'intérieur d'une même lettre.
  const lastNotified = useRef<string | null>(null);

  const measure = (event: LayoutChangeEvent) => setBarHeight(event.nativeEvent.layout.height);

  const pick = (event: GestureResponderEvent) => {
    if (barHeight <= 0 || letters.length === 0) return;
    const y = event.nativeEvent.locationY;
    const index = Math.min(letters.length - 1, Math.max(0, Math.floor((y / barHeight) * letters.length)));
    const letter = letters[index];
    setActiveY(y);
    if (letter === lastNotified.current) return;
    lastNotified.current = letter;
    setActive(letter);
    onSelect(letter);
  };

  const release = () => {
    lastNotified.current = null;
    setActive(null);
  };

  return (
    // Le conteneur couvre la hauteur utile mais laisse passer les touchers :
    // seule la barre elle-même en capte. Sans `box-none`, il avalerait le
    // défilement de toute la moitié droite de l'écran.
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        right: 3,
        top: insets.top + 8,
        // S'arrête au-dessus du bouton de l'assistant et de la barre
        // d'onglets, sinon les dernières lettres passeraient dessous.
        bottom: insets.bottom + APP_TAB_BAR_HEIGHT + 88,
        width: BAR_WIDTH,
      }}
    >
      {active ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            right: BAR_WIDTH + 10,
            // Suit le pouce : une bulle fixe au centre obligerait à faire
            // l'aller-retour des yeux entre le doigt et elle.
            top: activeY - BUBBLE_SIZE / 2,
            width: BUBBLE_SIZE,
            height: BUBBLE_SIZE,
            borderRadius: BUBBLE_SIZE / 2,
            backgroundColor: ACCENT,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '700' }}>{active}</Text>
        </View>
      ) : null}

      <View
        onLayout={measure}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={pick}
        onResponderMove={pick}
        onResponderRelease={release}
        onResponderTerminate={release}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'space-around' }}
      >
        {letters.map((letter) => (
          <Text
            key={letter}
            style={{
              fontSize: 11,
              fontWeight: '700',
              color: letter === active ? ACCENT : '#A39C8F',
            }}
          >
            {letter}
          </Text>
        ))}
      </View>
    </View>
  );
}
