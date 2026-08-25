import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';

// Une apparition, et rien d'autre : le contenu grossit de 0,85 à 1 en même
// temps qu'il se révèle.
//
// C'est le seul effet « ludique » du guide, et il est volontairement pauvre :
// il ne se déclenche qu'au MONTAGE, ne mesure rien, ne dépend d'aucune
// disposition. Une pastille qui arrive dans le fil du parcours doit se voir
// arriver — c'est ce qui fait sentir qu'on avance — sans que ça coûte une
// animation de mise en page, dont on sait dans ce projet qu'elles se
// comportent mal dès qu'un Modal s'en mêle.
//
// `Animated` du cœur de React Native plutôt que Reanimated : même raison, le
// montage est le seul instant qui compte, et cette voie-là est éprouvée dans
// l'app (voir HomeDashboard).

type PopProps = {
  children: ReactNode;
  /** Décale le départ, pour faire arriver plusieurs blocs l'un après l'autre. */
  delay?: number;
  style?: StyleProp<ViewStyle>;
};

export function Pop({ children, delay = 0, style }: PopProps) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(progress, {
      toValue: 1,
      delay,
      friction: 7,
      tension: 90,
      useNativeDriver: true,
    }).start();
  }, [progress, delay]);

  return (
    <Animated.View
      style={[
        style,
        {
          // Borné : un ressort dépasse sa cible, et une opacité au-dessus de 1
          // n'a pas de sens. Le dépassement, lui, reste sur l'échelle — c'est
          // exactement ce qui donne le petit rebond.
          opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' }),
          transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
