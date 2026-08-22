import { useRef, useState } from 'react';
import { Text, View, type GestureResponderEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_TAB_BAR_HEIGHT } from '../../components/AppTabBar';

// Barre alphabétique verticale, pour sauter d'un coup dans une longue liste.
//
// GLISSER, PAS SEULEMENT TAPER : c'est ce qui fait tout l'intérêt du procédé.
// On pose le pouce et on descend, la liste suit en continu — viser une lettre
// de 15 px de haut à chaque saut serait plus lent que de faire défiler.
//
// Elle n'affiche QUE les lettres réellement présentes. Un alphabet complet
// avec vingt lettres inertes obligerait à viser encore plus petit pour
// atteindre les six qui servent, et laisserait croire que l'inventaire
// contient quelque chose sous chacune.
//
// La bulle est nécessaire, pas décorative : sous le pouce, la lettre visée
// est précisément celle qu'on ne voit plus.

const LETTER_HEIGHT = 15;
const BAR_WIDTH = 18;
const BUBBLE_SIZE = 44;
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
  // Dernière lettre notifiée : sans ce garde, un glissement lent relancerait
  // le défilement à chaque pixel parcouru à l'intérieur d'une même lettre.
  const lastNotified = useRef<string | null>(null);

  const barHeight = letters.length * LETTER_HEIGHT;

  const pick = (event: GestureResponderEvent) => {
    const y = event.nativeEvent.locationY;
    const index = Math.min(letters.length - 1, Math.max(0, Math.floor(y / LETTER_HEIGHT)));
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
        right: 0,
        top: insets.top + 8,
        // S'arrête au-dessus du bouton de l'assistant et de la barre
        // d'onglets, sinon les dernières lettres passeraient dessous.
        bottom: insets.bottom + APP_TAB_BAR_HEIGHT + 88,
        justifyContent: 'center',
        alignItems: 'flex-end',
      }}
    >
      {/* Enveloppe collée à la barre : c'est ce qui rend `activeY`
          directement utilisable pour placer la bulle, sans avoir à mesurer
          où la barre est retombée dans le conteneur centré. */}
      <View style={{ marginRight: 3 }}>
        {active ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              right: BAR_WIDTH + 12,
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
            <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '700' }}>{active}</Text>
          </View>
        ) : null}

        <View
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={pick}
          onResponderMove={pick}
          onResponderRelease={release}
          onResponderTerminate={release}
          // La zone tactile fait toute la hauteur des lettres ; le fond
          // n'apparaît que pendant le glissement, pour ne pas poser un
          // bandeau permanent sur le bord de l'écran.
          style={{
            width: BAR_WIDTH,
            height: barHeight,
            borderRadius: BAR_WIDTH / 2,
            backgroundColor: active ? 'rgba(255,255,255,0.92)' : 'transparent',
            alignItems: 'center',
          }}
        >
          {letters.map((letter) => (
            <View key={letter} style={{ height: LETTER_HEIGHT, justifyContent: 'center' }}>
              <Text
                style={{
                  fontSize: 10,
                  lineHeight: LETTER_HEIGHT,
                  fontWeight: '700',
                  color: letter === active ? ACCENT : '#A39C8F',
                }}
              >
                {letter}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
