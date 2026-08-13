import { Canvas, Circle, matchFont, Path, Rect, Text as SkiaText, type SkFont } from '@shopify/react-native-skia';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { PlanForme } from '../../types/database';
import { CANVAS_HEIGHT, CANVAS_WIDTH, MAX_SHAPE_SIZE, MIN_SHAPE_SIZE } from './constants';

type ShapeGeometry = { x: number; y: number; width: number; height: number };

type PlanCanvasProps = {
  formes: PlanForme[];
  pieceNames: Record<string, string>;
  highlightFormeId?: string | null;
  onDragEnd: (id: string, x: number, y: number) => void;
  onResizeEnd: (id: string, x: number, y: number, width: number, height: number) => void;
  onTap: (forme: PlanForme) => void;
};

function trianglePath(x: number, y: number, width: number, height: number): string {
  return `M ${x + width / 2},${y} L ${x + width},${y + height} L ${x},${y + height} Z`;
}

function clampSize(value: number): number {
  return Math.min(MAX_SHAPE_SIZE, Math.max(MIN_SHAPE_SIZE, value));
}

export function PlanCanvas({ formes, pieceNames, highlightFormeId, onDragEnd, onResizeEnd, onTap }: PlanCanvasProps) {
  // Position ET taille vivent dans le même state, mises à jour en direct par
  // le pan (x/y) et le pincement (x/y/width/height, le centre restant fixe)
  // — un seul aller-retour réseau à la fin du geste, pas à chaque frame.
  const [shapes, setShapes] = useState<Record<string, ShapeGeometry>>({});
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
    setShapes((current) => {
      const next = { ...current };
      const ids = new Set(formes.map((f) => f.id));
      for (const forme of formes) {
        if (!(forme.id in next)) next[forme.id] = { x: forme.x, y: forme.y, width: forme.width, height: forme.height };
      }
      for (const id of Object.keys(next)) {
        if (!ids.has(id)) delete next[id];
      }
      return next;
    });
  }, [formes]);

  return (
    <View style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }} className="self-center rounded-2xl bg-sand-dark">
      <Canvas style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}>
        {formes.map((forme) => {
          const geo = shapes[forme.id] ?? forme;
          const label = forme.piece_id ? (pieceNames[forme.piece_id] ?? '') : '';
          return (
            <ShapeVisual
              key={forme.id}
              forme={forme}
              geo={geo}
              label={label}
              font={font}
              highlighted={forme.id === highlightFormeId}
            />
          );
        })}
      </Canvas>

      {formes.map((forme) => {
        const geo = shapes[forme.id] ?? forme;
        return (
          <ShapeHandle
            key={forme.id}
            geo={geo}
            onMove={(x, y) => setShapes((current) => ({ ...current, [forme.id]: { ...current[forme.id], x, y } }))}
            onDragEnd={(x, y) => onDragEnd(forme.id, x, y)}
            onResize={(geometry) => setShapes((current) => ({ ...current, [forme.id]: geometry }))}
            onResizeEnd={(geometry) => onResizeEnd(forme.id, geometry.x, geometry.y, geometry.width, geometry.height)}
            onTap={() => onTap(forme)}
          />
        );
      })}
    </View>
  );
}

function ShapeVisual({
  forme,
  geo,
  label,
  font,
  highlighted,
}: {
  forme: PlanForme;
  geo: ShapeGeometry;
  label: string;
  font: SkFont | null;
  highlighted: boolean;
}) {
  const color = highlighted ? '#FF6B4A' : forme.piece_id ? '#171717' : '#a3a3a3';
  const strokeWidth = highlighted ? 4 : 2;
  return (
    <>
      {forme.shape_type === 'rectangle' && (
        <Rect x={geo.x} y={geo.y} width={geo.width} height={geo.height} color={color} style="stroke" strokeWidth={strokeWidth} />
      )}
      {forme.shape_type === 'circle' && (
        <Circle
          cx={geo.x + geo.width / 2}
          cy={geo.y + geo.height / 2}
          r={Math.min(geo.width, geo.height) / 2}
          color={color}
          style="stroke"
          strokeWidth={strokeWidth}
        />
      )}
      {forme.shape_type === 'triangle' && (
        <Path path={trianglePath(geo.x, geo.y, geo.width, geo.height)} color={color} style="stroke" strokeWidth={strokeWidth} />
      )}
      {label && font ? <SkiaText x={geo.x + 6} y={geo.y + geo.height / 2} text={label} font={font} color="#171717" /> : null}
    </>
  );
}

function ShapeHandle({
  geo,
  onMove,
  onDragEnd,
  onResize,
  onResizeEnd,
  onTap,
}: {
  geo: ShapeGeometry;
  onMove: (x: number, y: number) => void;
  onDragEnd: (x: number, y: number) => void;
  onResize: (geometry: ShapeGeometry) => void;
  onResizeEnd: (geometry: ShapeGeometry) => void;
  onTap: () => void;
}) {
  // Gesture callbacks close over stale props, so both origins are captured
  // once at the start of their gesture (in a ref) rather than recomputed
  // from geo on every update — geo itself changes every frame as onMove/
  // onResize re-render the parent, which would double-count movement.
  const dragOrigin = useRef(geo);
  const resizeOrigin = useRef(geo);
  // RNGH's Pinch onEnd payload can report a stale/reset `scale`, so the
  // last value actually applied during onUpdate is what onEnd persists —
  // it doesn't re-derive from the end event.
  const lastResize = useRef(geo);

  const computeResize = (scale: number): ShapeGeometry => {
    const origin = resizeOrigin.current;
    const width = clampSize(origin.width * scale);
    const height = clampSize(origin.height * scale);
    const centerX = origin.x + origin.width / 2;
    const centerY = origin.y + origin.height / 2;
    return { x: centerX - width / 2, y: centerY - height / 2, width, height };
  };

  // Zone de détection élargie au-delà du contour visible : une forme par
  // défaut (80x80) est plus petite que l'écartement naturel de deux doigts
  // qui pincent, donc sans marge le second doigt atterrit hors de la vue et
  // le geste n'est jamais détecté du tout.
  const HIT_SLOP = 40;

  const pan = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .hitSlop(HIT_SLOP)
    .runOnJS(true)
    .onStart(() => {
      dragOrigin.current = geo;
    })
    .onUpdate((event) => onMove(dragOrigin.current.x + event.translationX, dragOrigin.current.y + event.translationY))
    .onEnd((event) => onDragEnd(dragOrigin.current.x + event.translationX, dragOrigin.current.y + event.translationY));

  // "Comme redimensionner une photo" -> mise à l'échelle uniforme (largeur
  // et hauteur ensemble) autour du centre de la forme, pas des poignées de
  // coin séparées — plus simple à utiliser au doigt et cohérent avec le
  // rendu (un cercle doit rester un cercle).
  const pinch = Gesture.Pinch()
    .hitSlop(HIT_SLOP)
    .runOnJS(true)
    .onStart(() => {
      resizeOrigin.current = geo;
      lastResize.current = geo;
    })
    .onUpdate((event) => {
      lastResize.current = computeResize(event.scale);
      onResize(lastResize.current);
    })
    .onEnd(() => onResizeEnd(lastResize.current));

  const tap = Gesture.Tap().hitSlop(HIT_SLOP).runOnJS(true).onEnd(() => onTap());
  const gesture = Gesture.Exclusive(Gesture.Simultaneous(pan, pinch), tap);

  return (
    <GestureDetector gesture={gesture}>
      <View style={{ position: 'absolute', left: geo.x, top: geo.y, width: geo.width, height: geo.height }} />
    </GestureDetector>
  );
}
