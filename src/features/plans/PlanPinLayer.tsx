import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Icon } from '../../components/Icon';
import { IconBadge } from '../../components/IconBadge';
import type { IconName } from '../../components/Icon';
import type { PlanPin } from '../../types/database';
import type { ShapeGeometry } from './types';

const HIGHLIGHT_RED = '#E53935';

// 30% plus petit que l'ancienne taille (30) pour une meilleure lisibilité du
// plan une fois plusieurs pastilles posées.
const PIN_SIZE = 21;

type RelPosition = { relX: number; relY: number };

type PlanPinLayerProps = {
  pins: PlanPin[];
  formeGeo: Record<string, ShapeGeometry>;
  pinDisplay: Record<string, { name: string; icon: IconName }>;
  selectedFormeId: string | null;
  highlightedEmplacementId?: string | null;
  scale: number;
  onDragEnd: (pinId: string, relX: number, relY: number) => void;
  onTap: (pin: PlanPin) => void;
};

// Les pastilles sont toujours affichées (lecture) sur toutes les pièces —
// c'est tout l'intérêt : voir d'un coup d'œil où sont les Emplacements.
// Elles ne deviennent glissables/tapables que sur la pièce actuellement
// sélectionnée, même règle de verrouillage que les formes elles-mêmes.
//
// Même pattern que `shapes` dans PlanCanvas : la position vécue pendant un
// glisser vit dans un state ici (mise à jour à chaque frame par le geste),
// synchronisée depuis les props à l'arrivée/au changement d'un pin — un
// seul aller-retour réseau à la fin du geste, pas à chaque frame.
export function PlanPinLayer({
  pins,
  formeGeo,
  pinDisplay,
  selectedFormeId,
  highlightedEmplacementId,
  scale,
  onDragEnd,
  onTap,
}: PlanPinLayerProps) {
  const [positions, setPositions] = useState<Record<string, RelPosition>>({});

  useEffect(() => {
    setPositions((current) => {
      const next = { ...current };
      const ids = new Set(pins.map((p) => p.id));
      for (const pin of pins) {
        if (!(pin.id in next)) next[pin.id] = { relX: pin.rel_x, relY: pin.rel_y };
      }
      for (const id of Object.keys(next)) {
        if (!ids.has(id)) delete next[id];
      }
      return next;
    });
  }, [pins]);

  return (
    <>
      {pins.map((pin) => {
        const geo = formeGeo[pin.forme_id];
        const display = pinDisplay[pin.emplacement_id];
        const pos = positions[pin.id] ?? { relX: pin.rel_x, relY: pin.rel_y };
        if (!geo || !display) return null;
        return (
          <PinBadge
            key={pin.id}
            geo={geo}
            pos={pos}
            display={display}
            interactive={pin.forme_id === selectedFormeId}
            highlighted={pin.emplacement_id === highlightedEmplacementId}
            scale={scale}
            onMove={(next) => setPositions((current) => ({ ...current, [pin.id]: next }))}
            onDragEnd={(next) => onDragEnd(pin.id, next.relX, next.relY)}
            onTap={() => onTap(pin)}
          />
        );
      })}
    </>
  );
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function PinBadge({
  geo,
  pos,
  display,
  interactive,
  highlighted,
  scale,
  onMove,
  onDragEnd,
  onTap,
}: {
  geo: ShapeGeometry;
  pos: RelPosition;
  display: { name: string; icon: IconName };
  interactive: boolean;
  highlighted: boolean;
  scale: number;
  onMove: (pos: RelPosition) => void;
  onDragEnd: (pos: RelPosition) => void;
  onTap: () => void;
}) {
  const dragOrigin = useRef(pos);

  // Plan 2D top-down pur : x/y sont directement des coordonnées écran (dans
  // le repère du contenu zoomable), pas besoin de projeter quoi que ce soit.
  const screen = { x: geo.x + pos.relX * geo.width, y: geo.y + pos.relY * geo.height };

  // Le geste rapporte un delta en pixels ÉCRAN (avant mise à l'échelle du
  // zoom) — diviser par `scale` pour obtenir le déplacement réel dans le
  // repère (non zoomé) où vivent x/y.
  const pan = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .enabled(interactive)
    .runOnJS(true)
    .onStart(() => {
      dragOrigin.current = pos;
    })
    .onUpdate((event) => {
      onMove({
        relX: clamp01(dragOrigin.current.relX + event.translationX / scale / geo.width),
        relY: clamp01(dragOrigin.current.relY + event.translationY / scale / geo.height),
      });
    })
    .onEnd((event) => {
      onDragEnd({
        relX: clamp01(dragOrigin.current.relX + event.translationX / scale / geo.width),
        relY: clamp01(dragOrigin.current.relY + event.translationY / scale / geo.height),
      });
    });

  const tap = Gesture.Tap().enabled(interactive).hitSlop(6).runOnJS(true).onEnd(() => onTap());
  const gesture = Gesture.Exclusive(pan, tap);

  return (
    <GestureDetector gesture={gesture}>
      <View style={{ position: 'absolute', left: screen.x - PIN_SIZE / 2, top: screen.y - PIN_SIZE / 2 }}>
        {highlighted ? (
          <View style={{ position: 'absolute', top: -14, left: 0, right: 0, alignItems: 'center' }}>
            <Icon name="arrowDown" size={16} color={HIGHLIGHT_RED} />
          </View>
        ) : null}
        <IconBadge
          icon={display.icon}
          fill="#FFFBF8"
          size={PIN_SIZE}
          borderColor={highlighted ? HIGHLIGHT_RED : undefined}
          borderWidth={2.5}
        />
      </View>
    </GestureDetector>
  );
}
