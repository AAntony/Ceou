import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { IconBadge } from '../../components/IconBadge';
import type { PlanDoor } from '../../types/database';
import type { ShapeGeometry } from './types';

const DOOR_SIZE = 26;

type Edge = 'n' | 'e' | 's' | 'w';
type EdgePosition = { edge: Edge; position: number };

type DoorLayerProps = {
  doors: PlanDoor[];
  formeGeo: Record<string, ShapeGeometry>;
  selectedFormeId: string | null;
  onDragEnd: (doorId: string, edge: Edge, position: number) => void;
  onTap: (door: PlanDoor) => void;
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function pointForEdge(geo: ShapeGeometry, edge: Edge, position: number): { x: number; y: number } {
  if (edge === 'n') return { x: geo.x + position * geo.width, y: geo.y };
  if (edge === 's') return { x: geo.x + position * geo.width, y: geo.y + geo.height };
  if (edge === 'w') return { x: geo.x, y: geo.y + position * geo.height };
  return { x: geo.x + geo.width, y: geo.y + position * geo.height };
}

// Projette un point (écran, == monde en 2D top-down pur) sur le bord le
// plus proche du rectangle `geo` — une porte est par définition une
// ouverture DANS un mur, pas un point libre dans la pièce. Elle peut ainsi
// glisser tout autour du périmètre, y compris changer de mur en passant
// un coin.
function nearestEdgePoint(px: number, py: number, geo: ShapeGeometry): EdgePosition {
  const distN = Math.abs(py - geo.y);
  const distS = Math.abs(py - (geo.y + geo.height));
  const distW = Math.abs(px - geo.x);
  const distE = Math.abs(px - (geo.x + geo.width));
  const min = Math.min(distN, distS, distW, distE);
  if (min === distN) return { edge: 'n', position: clamp01((px - geo.x) / geo.width) };
  if (min === distS) return { edge: 's', position: clamp01((px - geo.x) / geo.width) };
  if (min === distW) return { edge: 'w', position: clamp01((py - geo.y) / geo.height) };
  return { edge: 'e', position: clamp01((py - geo.y) / geo.height) };
}

// Même architecture que PlanPinLayer : les portes sont toujours affichées
// (lecture) sur toutes les pièces, glissables/tapables uniquement sur la
// pièce actuellement sélectionnée.
export function DoorLayer({ doors, formeGeo, selectedFormeId, onDragEnd, onTap }: DoorLayerProps) {
  const [positions, setPositions] = useState<Record<string, EdgePosition>>({});

  useEffect(() => {
    setPositions((current) => {
      const next = { ...current };
      const ids = new Set(doors.map((d) => d.id));
      for (const door of doors) {
        if (!(door.id in next)) next[door.id] = { edge: door.edge as Edge, position: door.position };
      }
      for (const id of Object.keys(next)) {
        if (!ids.has(id)) delete next[id];
      }
      return next;
    });
  }, [doors]);

  return (
    <>
      {doors.map((door) => {
        const geo = formeGeo[door.forme_id];
        const pos = positions[door.id] ?? { edge: door.edge as Edge, position: door.position };
        if (!geo) return null;
        return (
          <DoorBadge
            key={door.id}
            geo={geo}
            pos={pos}
            interactive={door.forme_id === selectedFormeId}
            onMove={(next) => setPositions((current) => ({ ...current, [door.id]: next }))}
            onDragEnd={(next) => onDragEnd(door.id, next.edge, next.position)}
            onTap={() => onTap(door)}
          />
        );
      })}
    </>
  );
}

function DoorBadge({
  geo,
  pos,
  interactive,
  onMove,
  onDragEnd,
  onTap,
}: {
  geo: ShapeGeometry;
  pos: EdgePosition;
  interactive: boolean;
  onMove: (pos: EdgePosition) => void;
  onDragEnd: (pos: EdgePosition) => void;
  onTap: () => void;
}) {
  const dragOrigin = useRef(pointForEdge(geo, pos.edge, pos.position));
  const screen = pointForEdge(geo, pos.edge, pos.position);

  const pan = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .enabled(interactive)
    .runOnJS(true)
    .onStart(() => {
      dragOrigin.current = pointForEdge(geo, pos.edge, pos.position);
    })
    .onUpdate((event) => {
      onMove(nearestEdgePoint(dragOrigin.current.x + event.translationX, dragOrigin.current.y + event.translationY, geo));
    })
    .onEnd((event) => {
      onDragEnd(nearestEdgePoint(dragOrigin.current.x + event.translationX, dragOrigin.current.y + event.translationY, geo));
    });

  const tap = Gesture.Tap().enabled(interactive).hitSlop(6).runOnJS(true).onEnd(() => onTap());
  const gesture = Gesture.Exclusive(pan, tap);

  return (
    <GestureDetector gesture={gesture}>
      <View style={{ position: 'absolute', left: screen.x - DOOR_SIZE / 2, top: screen.y - DOOR_SIZE / 2 }}>
        <IconBadge icon="porte" fill="#FFFBF8" size={DOOR_SIZE} />
      </View>
    </GestureDetector>
  );
}
