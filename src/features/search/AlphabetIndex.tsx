import { useMemo, useRef, useState } from 'react';
import { Text, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_TAB_BAR_HEIGHT } from '../../components/AppTabBar';

// Index alphabétique, façon répertoire de contacts.
//
// DEUX LISTES DISTINCTES, ET C'EST TOUTE L'ASTUCE DU PROCÉDÉ :
//   - `letters` sert à VISER. Le toucher est converti en position dans cette
//     liste complète, donc chaque lettre reste atteignable.
//   - `rows` sert à AFFICHER. Au-delà d'une quinzaine d'entrées, une lettre
//     sur deux laisse place à un point.
// Les deux se recoupent aux points d'échantillonnage, ce qui suffit à guider
// l'oeil — c'est exactement ce que font les répertoires du téléphone, et la
// raison pour laquelle ils restent lisibles avec vingt-six lettres.
//
// COMPACT ET SANS FOND. Un index qui court sur toute la hauteur de l'écran se
// lit comme un élément d'interface à part entière ; ici ce n'est qu'un
// raccourci, posé par-dessus la grille, qui doit se faire oublier tant qu'on
// ne s'en sert pas.
//
// La bulle, elle, reste indispensable : sous le pouce, la lettre visée est
// précisément celle qu'on ne voit plus.

// La hauteur de ligne est ce qui décide de la PRÉCISION du geste : la zone
// tactile d'une lettre vaut la hauteur totale divisée par le nombre
// d'initiales, pas par le nombre de lignes affichées. L'allonger est donc le
// seul vrai levier de confort, bien avant la taille du texte.
const ROW_HEIGHT = 22;
// Au-delà, l'index se met à courir sur tout l'écran et redevient un élément
// d'interface à part entière au lieu d'un raccourci discret.
const MAX_ROWS = 17;
const BAR_WIDTH = 22;
// Élargit la prise SANS élargir le dessin : le pouce attrape 36 px, l'oeil
// n'en voit que 22, et les cartes gardent leur gouttière intacte.
const GRAB_SLOP = { top: 8, bottom: 8, left: 14, right: 4 };
const BUBBLE_SIZE = 40;
const DOT = '·';
const ACCENT = '#1591EA';
const IDLE_COLOR = '#B5AEA3';

/** Réduit la liste affichée en intercalant des points entre les lettres retenues. */
function condense(letters: string[]): string[] {
  if (letters.length <= MAX_ROWS) return letters;

  const kept = Math.ceil(MAX_ROWS / 2);
  const rows: string[] = [];
  for (let i = 0; i < kept; i++) {
    rows.push(letters[Math.round((i * (letters.length - 1)) / (kept - 1))]);
    if (i < kept - 1) rows.push(DOT);
  }
  return rows;
}

type AlphabetIndexProps = {
  /** Lettres présentes dans la liste, déjà triées et dédoublonnées. */
  letters: string[];
  onSelect: (letter: string) => void;
};

export function AlphabetIndex({ letters, onSelect }: AlphabetIndexProps) {
  const insets = useSafeAreaInsets();
  const [active, setActive] = useState<string | null>(null);
  const [activeY, setActiveY] = useState(0);
  const [barHeight, setBarHeight] = useState(0);
  // Dernière lettre notifiée : sans ce garde, un glissement lent relancerait
  // le défilement à chaque pixel parcouru à l'intérieur d'une même lettre.
  const lastNotified = useRef<string | null>(null);

  const rows = useMemo(() => condense(letters), [letters]);

  const measure = (event: LayoutChangeEvent) => setBarHeight(event.nativeEvent.layout.height);

  const pick = (event: GestureResponderEvent) => {
    if (barHeight <= 0 || letters.length === 0) return;
    const y = event.nativeEvent.locationY;
    // La visée porte sur `letters`, jamais sur `rows` : une lettre masquée
    // derrière un point doit rester atteignable.
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
        right: 2,
        top: insets.top,
        // S'arrête au-dessus du bouton de l'assistant et de la barre
        // d'onglets ; l'index se centre dans ce qui reste.
        bottom: insets.bottom + APP_TAB_BAR_HEIGHT + 88,
        width: BAR_WIDTH,
        justifyContent: 'center',
      }}
    >
      {active ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            right: BAR_WIDTH + 8,
            // Suit le pouce : une bulle fixe au centre obligerait à faire
            // l'aller-retour des yeux entre le doigt et elle.
            top: (barHeight > 0 ? activeY : 0) - BUBBLE_SIZE / 2,
            width: BUBBLE_SIZE,
            height: BUBBLE_SIZE,
            borderRadius: BUBBLE_SIZE / 2,
            backgroundColor: ACCENT,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700' }}>{active}</Text>
        </View>
      ) : null}

      <View
        onLayout={measure}
        hitSlop={GRAB_SLOP}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={pick}
        onResponderMove={pick}
        onResponderRelease={release}
        onResponderTerminate={release}
        style={{ alignItems: 'center' }}
      >
        {rows.map((row, index) => (
          <View
            // Un point peut apparaître plusieurs fois : la position fait
            // partie de la clé, sinon React voit des doublons.
            key={`${row}-${index}`}
            style={{ height: ROW_HEIGHT, justifyContent: 'center' }}
          >
            <Text
              style={{
                fontSize: row === DOT ? 10 : 11,
                lineHeight: ROW_HEIGHT,
                fontWeight: '600',
                color: row !== DOT && row === active ? ACCENT : IDLE_COLOR,
              }}
            >
              {row}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
