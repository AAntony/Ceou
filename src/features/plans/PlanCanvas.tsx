import { Canvas, Circle, matchFont, Path, Rect, Text as SkiaText, type SkFont } from '@shopify/react-native-skia';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { PlanForme } from '../../types/database';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from './constants';

type ShapePosition = { x: number; y: number };

type PlanCanvasProps = {
  formes: PlanForme[];
  pieceNames: Record<string, string>;
  onDragEnd: (id: string, x: number, y: number) => void;
  onTap: (forme: PlanForme) => void;
};

function trianglePath(x: number, y: number, width: number, height: number): string {
  return `M ${x + width / 2},${y} L ${x + width},${y + height} L ${x},${y + height} Z`;
}

export function PlanCanvas({ formes, pieceNames, onDragEnd, onTap }: PlanCanvasProps) {
  const [positions, setPositions] = useState<Record<string, ShapePosition>>({});
  // matchFont() can throw if Skia's CanvasKit/WASM backend (web only —
  // native Skia has no such async init delay) isn't ready yet, which would
  // otherwise crash this whole screen. Labels are a nice-to-have on top of
  // the shapes themselves, so degrade to no labels rather than a blank
  // screen if font matching isn't available yet.
  const font = useMemo(() => {
    try {
      return matchFont({
        fontFamily: Platform.select({ android: 'sans-serif', ios: 'Helvetica', default: 'sans-serif' }),
        fontSize: 12,
      });
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    setPositions((current) => {
      const next = { ...current };
      const ids = new Set(formes.map((f) => f.id));
      for (const forme of formes) {
        if (!(forme.id in next)) next[forme.id] = { x: forme.x, y: forme.y };
      }
      for (const id of Object.keys(next)) {
        if (!ids.has(id)) delete next[id];
      }
      return next;
    });
  }, [formes]);

  return (
    <View style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }} className="self-center rounded-2xl bg-neutral-100">
      <Canvas style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}>
        {formes.map((forme) => {
          const pos = positions[forme.id] ?? { x: forme.x, y: forme.y };
          const label = forme.piece_id ? (pieceNames[forme.piece_id] ?? '') : '';
          return (
            <ShapeVisual key={forme.id} forme={forme} pos={pos} label={label} font={font} />
          );
        })}
      </Canvas>

      {formes.map((forme) => {
        const pos = positions[forme.id] ?? { x: forme.x, y: forme.y };
        return (
          <ShapeHandle
            key={forme.id}
            x={pos.x}
            y={pos.y}
            width={forme.width}
            height={forme.height}
            onMove={(x, y) => setPositions((current) => ({ ...current, [forme.id]: { x, y } }))}
            onEnd={(x, y) => onDragEnd(forme.id, x, y)}
            onTap={() => onTap(forme)}
          />
        );
      })}
    </View>
  );
}

function ShapeVisual({
  forme,
  pos,
  label,
  font,
}: {
  forme: PlanForme;
  pos: ShapePosition;
  label: string;
  font: SkFont | null;
}) {
  const color = forme.piece_id ? '#171717' : '#a3a3a3';
  return (
    <>
      {forme.shape_type === 'rectangle' && (
        <Rect x={pos.x} y={pos.y} width={forme.width} height={forme.height} color={color} style="stroke" strokeWidth={2} />
      )}
      {forme.shape_type === 'circle' && (
        <Circle
          cx={pos.x + forme.width / 2}
          cy={pos.y + forme.height / 2}
          r={Math.min(forme.width, forme.height) / 2}
          color={color}
          style="stroke"
          strokeWidth={2}
        />
      )}
      {forme.shape_type === 'triangle' && (
        <Path path={trianglePath(pos.x, pos.y, forme.width, forme.height)} color={color} style="stroke" strokeWidth={2} />
      )}
      {label && font ? <SkiaText x={pos.x + 6} y={pos.y + forme.height / 2} text={label} font={font} color="#171717" /> : null}
    </>
  );
}

function ShapeHandle({
  x,
  y,
  width,
  height,
  onMove,
  onEnd,
  onTap,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  onMove: (x: number, y: number) => void;
  onEnd: (x: number, y: number) => void;
  onTap: () => void;
}) {
  // The gesture's translationX/Y is always relative to where the touch
  // started, so the origin must be captured once at onStart — recomputing
  // from the (constantly-changing, as onMove re-renders the parent) x/y
  // props on every onUpdate would double-count the movement already applied.
  const origin = useRef({ x, y });

  const pan = Gesture.Pan()
    .runOnJS(true)
    .onStart(() => {
      origin.current = { x, y };
    })
    .onUpdate((event) => onMove(origin.current.x + event.translationX, origin.current.y + event.translationY))
    .onEnd((event) => onEnd(origin.current.x + event.translationX, origin.current.y + event.translationY));

  const tap = Gesture.Tap().runOnJS(true).onEnd(() => onTap());
  const gesture = Gesture.Exclusive(pan, tap);

  return (
    <GestureDetector gesture={gesture}>
      <View style={{ position: 'absolute', left: x, top: y, width, height }} />
    </GestureDetector>
  );
}
