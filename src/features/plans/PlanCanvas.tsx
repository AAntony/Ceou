import { Canvas, matchFont, Oval, Rect, Text as SkiaText, type SkFont } from '@shopify/react-native-skia';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Icon } from '../../components/Icon';
import type { PlanForme } from '../../types/database';
import { CANVAS_HEIGHT, CANVAS_WIDTH, MAX_SHAPE_SIZE, MIN_SHAPE_SIZE } from './constants';

type ShapeGeometry = { x: number; y: number; width: number; height: number };

// nw/n/ne/e/se/s/sw/w — les 4 coins ajustent largeur ET hauteur (bord opposé
// fixe), les 4 milieux de segment n'ajustent qu'une seule dimension. Un
// cercle n'a que les 4 points cardinaux (pas de "coin" pertinent sur son
// pourtour) mais la même logique de bords opposés fixes s'applique
// telle quelle pour en faire un ovale.
type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

const RECT_HANDLES: HandleId[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const OVAL_HANDLES: HandleId[] = ['n', 'e', 's', 'w'];

type PlanCanvasProps = {
  formes: PlanForme[];
  pieceNames: Record<string, string>;
  highlightFormeId?: string | null;
  selectedFormeId: string | null;
  onDragEnd: (id: string, x: number, y: number) => void;
  onResizeEnd: (id: string, x: number, y: number, width: number, height: number) => void;
  onSelect: (forme: PlanForme) => void;
  onOpenSheet: (forme: PlanForme) => void;
  onDeselect: () => void;
};

function clampSize(value: number): number {
  return Math.min(MAX_SHAPE_SIZE, Math.max(MIN_SHAPE_SIZE, value));
}

function handleAnchor(geo: ShapeGeometry, handle: HandleId): { x: number; y: number } {
  const cx = geo.x + geo.width / 2;
  const cy = geo.y + geo.height / 2;
  const right = geo.x + geo.width;
  const bottom = geo.y + geo.height;
  const positions: Record<HandleId, { x: number; y: number }> = {
    nw: { x: geo.x, y: geo.y },
    n: { x: cx, y: geo.y },
    ne: { x: right, y: geo.y },
    e: { x: right, y: cy },
    se: { x: right, y: bottom },
    s: { x: cx, y: bottom },
    sw: { x: geo.x, y: bottom },
    w: { x: geo.x, y: cy },
  };
  return positions[handle];
}

// Chaque poignée ne déplace que les bords qu'elle touche ; le(s) bord(s)
// opposé(s) restent ancrés sur la géométrie au début du geste — largeur et
// hauteur s'ajustent donc indépendamment (un rectangle peut redevenir un
// rectangle, pas juste un carré comme avec l'ancien pincement uniforme).
function applyHandle(origin: ShapeGeometry, handle: HandleId, dx: number, dy: number): ShapeGeometry {
  let { x, y, width, height } = origin;
  const right = origin.x + origin.width;
  const bottom = origin.y + origin.height;

  if (handle.includes('w')) {
    width = clampSize(origin.width - dx);
    x = right - width;
  }
  if (handle.includes('e')) {
    width = clampSize(origin.width + dx);
  }
  if (handle.includes('n')) {
    height = clampSize(origin.height - dy);
    y = bottom - height;
  }
  if (handle.includes('s')) {
    height = clampSize(origin.height + dy);
  }
  return { x, y, width, height };
}

export function PlanCanvas({
  formes,
  pieceNames,
  highlightFormeId,
  selectedFormeId,
  onDragEnd,
  onResizeEnd,
  onSelect,
  onOpenSheet,
  onDeselect,
}: PlanCanvasProps) {
  const { t } = useTranslation();
  // Position ET taille vivent dans le même state, mises à jour en direct par
  // le déplacement (x/y) et les poignées de redimensionnement (x/y/width/
  // height) — un seul aller-retour réseau à la fin du geste, pas à chaque
  // frame.
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

  const selectedForme = formes.find((f) => f.id === selectedFormeId) ?? null;

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
              active={forme.id === highlightFormeId || forme.id === selectedFormeId}
            />
          );
        })}
      </Canvas>

      {formes.map((forme) => {
        const geo = shapes[forme.id] ?? forme;
        const isSelected = forme.id === selectedFormeId;
        // Une seule forme à la fois peut être déplacée/redimensionnée — les
        // autres restent verrouillées (même le tap) tant que "Valider" n'a
        // pas relâché la sélection en cours.
        const locked = selectedFormeId !== null && !isSelected;
        return (
          <ShapeBody
            key={forme.id}
            geo={geo}
            isSelected={isSelected}
            locked={locked}
            onMove={(x, y) => setShapes((current) => ({ ...current, [forme.id]: { ...current[forme.id], x, y } }))}
            onDragEnd={(x, y) => onDragEnd(forme.id, x, y)}
            onSelect={() => onSelect(forme)}
            onOpenSheet={() => onOpenSheet(forme)}
          />
        );
      })}

      {selectedForme
        ? (selectedForme.shape_type === 'rectangle' ? RECT_HANDLES : OVAL_HANDLES).map((handle) => (
            <HandleDot
              key={handle}
              geo={shapes[selectedForme.id] ?? selectedForme}
              handle={handle}
              onResize={(geometry) => setShapes((current) => ({ ...current, [selectedForme.id]: geometry }))}
              onResizeEnd={(geometry) => onResizeEnd(selectedForme.id, geometry.x, geometry.y, geometry.width, geometry.height)}
            />
          ))
        : null}

      {selectedFormeId ? (
        <Pressable
          onPress={onDeselect}
          accessibilityLabel={t('plans.validate_selection')}
          className="absolute right-2 top-2 h-10 w-10 items-center justify-center rounded-full bg-coral shadow-md active:opacity-80"
        >
          <Icon name="validate" size={20} color="#fff" />
        </Pressable>
      ) : null}
    </View>
  );
}

function ShapeVisual({
  forme,
  geo,
  label,
  font,
  active,
}: {
  forme: PlanForme;
  geo: ShapeGeometry;
  label: string;
  font: SkFont | null;
  active: boolean;
}) {
  const color = active ? '#FF6B4A' : forme.piece_id ? '#171717' : '#a3a3a3';
  const strokeWidth = active ? 4 : 2;
  return (
    <>
      {forme.shape_type === 'rectangle' ? (
        <Rect x={geo.x} y={geo.y} width={geo.width} height={geo.height} color={color} style="stroke" strokeWidth={strokeWidth} />
      ) : (
        <Oval x={geo.x} y={geo.y} width={geo.width} height={geo.height} color={color} style="stroke" strokeWidth={strokeWidth} />
      )}
      {label && font ? <SkiaText x={geo.x + 6} y={geo.y + geo.height / 2} text={label} font={font} color="#171717" /> : null}
    </>
  );
}

// Déplacement (tout le corps de la forme, uniquement quand sélectionnée) +
// sélection au tap simple / ouverture de la fiche au double-tap.
function ShapeBody({
  geo,
  isSelected,
  locked,
  onMove,
  onDragEnd,
  onSelect,
  onOpenSheet,
}: {
  geo: ShapeGeometry;
  isSelected: boolean;
  locked: boolean;
  onMove: (x: number, y: number) => void;
  onDragEnd: (x: number, y: number) => void;
  onSelect: () => void;
  onOpenSheet: () => void;
}) {
  const dragOrigin = useRef(geo);
  const HIT_SLOP = 12;

  const pan = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .enabled(isSelected)
    .runOnJS(true)
    .onStart(() => {
      dragOrigin.current = geo;
    })
    .onUpdate((event) => onMove(dragOrigin.current.x + event.translationX, dragOrigin.current.y + event.translationY))
    .onEnd((event) => onDragEnd(dragOrigin.current.x + event.translationX, dragOrigin.current.y + event.translationY));

  // Un tap simple sélectionne (déplacer/redimensionner) ; il faut un
  // double-tap pour ouvrir la fiche (choix de pièce/suppression) — sinon
  // la fiche s'ouvrait à chaque tap, gênant pour qui veut juste ajuster la
  // position. doubleTap doit être listé en premier dans Exclusive : c'est
  // ce qui fait attendre singleTap le temps de voir si un second tap suit.
  const singleTap = Gesture.Tap().numberOfTaps(1).hitSlop(HIT_SLOP).enabled(!locked).runOnJS(true).onEnd(() => onSelect());
  const doubleTap = Gesture.Tap().numberOfTaps(2).hitSlop(HIT_SLOP).enabled(!locked).runOnJS(true).onEnd(() => onOpenSheet());
  const taps = Gesture.Exclusive(doubleTap, singleTap);
  const gesture = Gesture.Exclusive(pan, taps);

  return (
    <GestureDetector gesture={gesture}>
      <View style={{ position: 'absolute', left: geo.x, top: geo.y, width: geo.width, height: geo.height }} />
    </GestureDetector>
  );
}

const HANDLE_TOUCH_SIZE = 32;
const HANDLE_DOT_SIZE = 12;

// Petit point d'ancrage — sa propre zone de geste (32x32, centrée sur le
// point), rendu par-dessus ShapeBody pour que le toucher y soit prioritaire
// à cet endroit précis plutôt que d'aller au déplacement.
function HandleDot({
  geo,
  handle,
  onResize,
  onResizeEnd,
}: {
  geo: ShapeGeometry;
  handle: HandleId;
  onResize: (geometry: ShapeGeometry) => void;
  onResizeEnd: (geometry: ShapeGeometry) => void;
}) {
  const origin = useRef(geo);
  const last = useRef(geo);
  const anchor = handleAnchor(geo, handle);

  const pan = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .runOnJS(true)
    .onStart(() => {
      origin.current = geo;
      last.current = geo;
    })
    .onUpdate((event) => {
      last.current = applyHandle(origin.current, handle, event.translationX, event.translationY);
      onResize(last.current);
    })
    .onEnd(() => onResizeEnd(last.current));

  return (
    <GestureDetector gesture={pan}>
      <View
        style={{
          position: 'absolute',
          left: anchor.x - HANDLE_TOUCH_SIZE / 2,
          top: anchor.y - HANDLE_TOUCH_SIZE / 2,
          width: HANDLE_TOUCH_SIZE,
          height: HANDLE_TOUCH_SIZE,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: HANDLE_DOT_SIZE,
            height: HANDLE_DOT_SIZE,
            borderRadius: HANDLE_DOT_SIZE / 2,
            backgroundColor: '#FF6B4A',
            borderWidth: 2,
            borderColor: '#fff',
          }}
        />
      </View>
    </GestureDetector>
  );
}
