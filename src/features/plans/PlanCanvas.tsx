import { Canvas, matchFont, Rect, Text as SkiaText, type SkFont } from '@shopify/react-native-skia';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Icon, type IconName } from '../../components/Icon';
import type { PlanDoor, PlanForme, PlanPin } from '../../types/database';
import { CANVAS_HEIGHT, CANVAS_WIDTH, MAX_SHAPE_SIZE, MIN_SHAPE_SIZE, roomColorForForme, shade } from './constants';
import { DoorLayer } from './DoorLayer';
import { PlanPinLayer } from './PlanPinLayer';
import { snapPosition, snapResize } from './snap';
import type { HandleId, ShapeGeometry } from './types';

const HANDLES: HandleId[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

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
// opposé(s) restent ancrés sur la géométrie au début du geste.
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

type PlanCanvasProps = {
  formes: PlanForme[];
  pieceInfo: Record<string, { name: string }>;
  pins: PlanPin[];
  pinDisplay: Record<string, { name: string; icon: IconName }>;
  doors: PlanDoor[];
  highlightFormeId?: string | null;
  selectedFormeId: string | null;
  onDragEnd: (id: string, x: number, y: number) => void;
  onResizeEnd: (id: string, x: number, y: number, width: number, height: number) => void;
  onSelect: (forme: PlanForme) => void;
  onOpenSheet: (forme: PlanForme) => void;
  onDeselect: () => void;
  onPinDragEnd: (pinId: string, relX: number, relY: number) => void;
  onPinTap: (pin: PlanPin) => void;
  onDoorDragEnd: (doorId: string, edge: 'n' | 'e' | 's' | 'w', position: number) => void;
  onDoorTap: (door: PlanDoor) => void;
};

export function PlanCanvas({
  formes,
  pieceInfo,
  pins,
  pinDisplay,
  doors,
  highlightFormeId,
  selectedFormeId,
  onDragEnd,
  onResizeEnd,
  onSelect,
  onOpenSheet,
  onDeselect,
  onPinDragEnd,
  onPinTap,
  onDoorDragEnd,
  onDoorTap,
}: PlanCanvasProps) {
  const { t } = useTranslation();
  // Position ET taille vivent dans le même state, mises à jour en direct par
  // le déplacement (x/y) et les poignées de redimensionnement (x/y/width/
  // height) — un seul aller-retour réseau à la fin du geste, pas à chaque
  // frame. Plan 2D top-down pur : les coordonnées x/y SONT les coordonnées
  // écran, aucune projection.
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

  const geoById = useMemo(() => {
    const map: Record<string, ShapeGeometry> = {};
    for (const forme of formes) map[forme.id] = shapes[forme.id] ?? forme;
    return map;
  }, [formes, shapes]);

  const selectedForme = formes.find((f) => f.id === selectedFormeId) ?? null;

  return (
    <View style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }} className="self-center rounded-2xl bg-sand-dark">
      <Canvas style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}>
        {formes.map((forme) => {
          const geo = geoById[forme.id];
          const label = forme.piece_id ? (pieceInfo[forme.piece_id]?.name ?? '') : '';
          return (
            <RoomVisual
              key={forme.id}
              geo={geo}
              color={roomColorForForme(forme.id)}
              label={label}
              font={font}
              active={forme.id === highlightFormeId || forme.id === selectedFormeId}
            />
          );
        })}
      </Canvas>

      {formes.map((forme) => {
        const geo = geoById[forme.id];
        const isSelected = forme.id === selectedFormeId;
        // Une seule forme à la fois peut être déplacée/redimensionnée — les
        // autres restent verrouillées (même le tap) tant que "Valider" n'a
        // pas relâché la sélection en cours.
        const locked = selectedFormeId !== null && !isSelected;
        const others = formes.filter((f) => f.id !== forme.id).map((f) => geoById[f.id]);
        return (
          <ShapeBody
            key={forme.id}
            geo={geo}
            others={others}
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
        ? HANDLES.map((handle) => (
            <HandleDot
              key={handle}
              geo={geoById[selectedForme.id]}
              handle={handle}
              others={formes.filter((f) => f.id !== selectedForme.id).map((f) => geoById[f.id])}
              onResize={(geometry) => setShapes((current) => ({ ...current, [selectedForme.id]: geometry }))}
              onResizeEnd={(geometry) => onResizeEnd(selectedForme.id, geometry.x, geometry.y, geometry.width, geometry.height)}
            />
          ))
        : null}

      <PlanPinLayer
        pins={pins}
        formeGeo={geoById}
        pinDisplay={pinDisplay}
        selectedFormeId={selectedFormeId}
        onDragEnd={onPinDragEnd}
        onTap={onPinTap}
      />

      <DoorLayer doors={doors} formeGeo={geoById} selectedFormeId={selectedFormeId} onDragEnd={onDoorDragEnd} onTap={onDoorTap} />

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

// Rectangle plein (couleur par pièce individuelle) + contour + nom centré —
// plan 2D top-down pur, aucune projection.
function RoomVisual({
  geo,
  color,
  label,
  font,
  active,
}: {
  geo: ShapeGeometry;
  color: string;
  label: string;
  font: SkFont | null;
  active: boolean;
}) {
  const borderColor = shade(color, 0.25);
  const centerX = geo.x + geo.width / 2;
  const centerY = geo.y + geo.height / 2;

  return (
    <>
      <Rect x={geo.x} y={geo.y} width={geo.width} height={geo.height} color={color} style="fill" />
      <Rect x={geo.x} y={geo.y} width={geo.width} height={geo.height} color={borderColor} style="stroke" strokeWidth={2} />
      {active ? (
        <Rect x={geo.x} y={geo.y} width={geo.width} height={geo.height} color="#FF6B4A" style="stroke" strokeWidth={3} />
      ) : null}
      {label && font ? (
        <SkiaText x={centerX - label.length * 3} y={centerY} text={label} font={font} color="#2D2A26" />
      ) : null}
    </>
  );
}

// Déplacement (tout le corps de la forme, uniquement quand sélectionnée) +
// sélection au tap simple / ouverture de la fiche au double-tap. Le
// déplacement passe par snapPosition() pour s'accoler magnétiquement aux
// pièces voisines.
function ShapeBody({
  geo,
  others,
  isSelected,
  locked,
  onMove,
  onDragEnd,
  onSelect,
  onOpenSheet,
}: {
  geo: ShapeGeometry;
  others: ShapeGeometry[];
  isSelected: boolean;
  locked: boolean;
  onMove: (x: number, y: number) => void;
  onDragEnd: (x: number, y: number) => void;
  onSelect: () => void;
  onOpenSheet: () => void;
}) {
  const dragOrigin = useRef(geo);
  const HIT_SLOP = 12;

  const resolve = (translationX: number, translationY: number) => {
    const rawX = dragOrigin.current.x + translationX;
    const rawY = dragOrigin.current.y + translationY;
    return snapPosition(rawX, rawY, geo.width, geo.height, others);
  };

  const pan = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .enabled(isSelected)
    .runOnJS(true)
    .onStart(() => {
      dragOrigin.current = geo;
    })
    .onUpdate((event) => {
      const snapped = resolve(event.translationX, event.translationY);
      onMove(snapped.x, snapped.y);
    })
    .onEnd((event) => {
      const snapped = resolve(event.translationX, event.translationY);
      onDragEnd(snapped.x, snapped.y);
    });

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
// à cet endroit précis plutôt que d'aller au déplacement. Le redimensionnement
// passe par snapResize() pour aligner le bord actif sur une pièce voisine.
function HandleDot({
  geo,
  handle,
  others,
  onResize,
  onResizeEnd,
}: {
  geo: ShapeGeometry;
  handle: HandleId;
  others: ShapeGeometry[];
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
      const raw = applyHandle(origin.current, handle, event.translationX, event.translationY);
      last.current = snapResize(raw, handle, others);
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
