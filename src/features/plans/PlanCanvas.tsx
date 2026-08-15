import { Canvas, matchFont, Path, Text as SkiaText, type SkFont } from '@shopify/react-native-skia';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Icon, type IconName } from '../../components/Icon';
import type { PlanForme, PlanPin } from '../../types/database';
import { CANVAS_HEIGHT, CANVAS_WIDTH, MAX_SHAPE_SIZE, MIN_SHAPE_SIZE, roomFloorColor, shade } from './constants';
import { project, screenDeltaToWorldDelta, WALL_HEIGHT, type ShapeGeometry } from './iso';
import { PlanPinLayer } from './PlanPinLayer';

// nw/n/ne/e/se/s/sw/w — les 4 coins ajustent largeur ET hauteur (bord opposé
// fixe), les 4 milieux de segment n'ajustent qu'une seule dimension.
type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
const HANDLES: HandleId[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

function polygonPath(points: { x: number; y: number }[]): string {
  const [first, ...rest] = points;
  return `M${first.x},${first.y} ${rest.map((p) => `L${p.x},${p.y}`).join(' ')} Z`;
}

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
// opposé(s) restent ancrés sur la géométrie au début du geste (espace
// MONDE, indépendant de la projection isométrique de l'affichage).
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
  pieceInfo: Record<string, { name: string; presetKey: string | null }>;
  pins: PlanPin[];
  pinDisplay: Record<string, { name: string; icon: IconName }>;
  highlightFormeId?: string | null;
  selectedFormeId: string | null;
  onDragEnd: (id: string, x: number, y: number) => void;
  onResizeEnd: (id: string, x: number, y: number, width: number, height: number) => void;
  onSelect: (forme: PlanForme) => void;
  onOpenSheet: (forme: PlanForme) => void;
  onDeselect: () => void;
  onPinDragEnd: (pinId: string, relX: number, relY: number) => void;
  onPinTap: (pin: PlanPin) => void;
};

export function PlanCanvas({
  formes,
  pieceInfo,
  pins,
  pinDisplay,
  highlightFormeId,
  selectedFormeId,
  onDragEnd,
  onResizeEnd,
  onSelect,
  onOpenSheet,
  onDeselect,
  onPinDragEnd,
  onPinTap,
}: PlanCanvasProps) {
  const { t } = useTranslation();
  // Position ET taille vivent dans le même state, en espace MONDE, mises à
  // jour en direct par le déplacement (x/y) et les poignées de
  // redimensionnement (x/y/width/height) — un seul aller-retour réseau à la
  // fin du geste, pas à chaque frame. La projection isométrique n'est
  // appliquée qu'au dessin, jamais stockée.
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

  // Tri en profondeur (peintre) : les pièces les plus "loin" (x+y monde
  // faible) sont dessinées en premier, pour un chevauchement visuel correct
  // si deux pièces se recouvrent à l'écran une fois projetées.
  const sortedFormes = useMemo(() => {
    return [...formes].sort((a, b) => {
      const ga = geoById[a.id];
      const gb = geoById[b.id];
      const da = ga.x + ga.width / 2 + (ga.y + ga.height / 2);
      const db = gb.x + gb.width / 2 + (gb.y + gb.height / 2);
      return da - db;
    });
  }, [formes, geoById]);

  return (
    <View style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }} className="self-center rounded-2xl bg-sand-dark">
      <Canvas style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}>
        {sortedFormes.map((forme) => {
          const info = forme.piece_id ? pieceInfo[forme.piece_id] : undefined;
          return (
            <RoomVisual
              key={forme.id}
              geo={geoById[forme.id]}
              presetKey={info?.presetKey ?? null}
              label={info?.name ?? ''}
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
        ? HANDLES.map((handle) => (
            <HandleDot
              key={handle}
              geo={geoById[selectedForme.id]}
              handle={handle}
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

// Dessine une pièce comme un volume isométrique extrudé : une face "sol"
// (parallélogramme, couleur pastel du type de pièce) + 2 faces de mur (les
// arêtes droite/avant, les plus proches du "spectateur" en isométrique,
// extrudées vers le bas d'un décalage écran fixe WALL_HEIGHT) dans des
// teintes assombries de la même couleur. Le nom de la pièce reste horizontal
// (pas skewé), comme sur la maquette de référence.
function RoomVisual({
  geo,
  presetKey,
  label,
  font,
  active,
}: {
  geo: ShapeGeometry;
  presetKey: string | null;
  label: string;
  font: SkFont | null;
  active: boolean;
}) {
  const topLeft = project(geo.x, geo.y);
  const topRight = project(geo.x + geo.width, geo.y);
  const bottomRight = project(geo.x + geo.width, geo.y + geo.height);
  const bottomLeft = project(geo.x, geo.y + geo.height);
  const down = (p: { x: number; y: number }) => ({ x: p.x, y: p.y + WALL_HEIGHT });

  const floorColor = roomFloorColor(presetKey);
  const rightWallColor = shade(floorColor, 0.15);
  const frontWallColor = shade(floorColor, 0.3);

  const centerX = (topLeft.x + topRight.x + bottomRight.x + bottomLeft.x) / 4;
  const centerY = (topLeft.y + topRight.y + bottomRight.y + bottomLeft.y) / 4;

  return (
    <>
      <Path path={polygonPath([topRight, bottomRight, down(bottomRight), down(topRight)])} color={rightWallColor} style="fill" />
      <Path path={polygonPath([bottomLeft, bottomRight, down(bottomRight), down(bottomLeft)])} color={frontWallColor} style="fill" />
      <Path path={polygonPath([topLeft, topRight, bottomRight, bottomLeft])} color={floorColor} style="fill" />
      {active ? (
        <Path path={polygonPath([topLeft, topRight, bottomRight, bottomLeft])} color="#FF6B4A" style="stroke" strokeWidth={3} />
      ) : null}
      {label && font ? (
        <SkiaText x={centerX - label.length * 3} y={centerY} text={label} font={font} color="#2D2A26" />
      ) : null}
    </>
  );
}

// Déplacement (tout le corps de la forme, uniquement quand sélectionnée) +
// sélection au tap simple / ouverture de la fiche au double-tap. La zone de
// toucher est la bounding box écran de la silhouette 3D projetée (sol +
// murs) — un peu plus généreuse que le losange exact, compromis raisonnable
// plutôt qu'un hit-test au pixel près sur un polygone.
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

  const topLeft = project(geo.x, geo.y);
  const topRight = project(geo.x + geo.width, geo.y);
  const bottomRight = project(geo.x + geo.width, geo.y + geo.height);
  const bottomLeft = project(geo.x, geo.y + geo.height);
  const minX = Math.min(topLeft.x, topRight.x, bottomRight.x, bottomLeft.x);
  const maxX = Math.max(topLeft.x, topRight.x, bottomRight.x, bottomLeft.x);
  const minY = Math.min(topLeft.y, topRight.y, bottomRight.y, bottomLeft.y);
  const maxY = Math.max(topLeft.y, topRight.y, bottomRight.y, bottomLeft.y) + WALL_HEIGHT;

  // event.translation(X|Y) est un delta ÉCRAN — sous la projection
  // isométrique il ne correspond plus 1:1 à un déplacement sur les axes
  // x/y du monde, d'où la conversion avant application à dragOrigin.
  const pan = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .enabled(isSelected)
    .runOnJS(true)
    .onStart(() => {
      dragOrigin.current = geo;
    })
    .onUpdate((event) => {
      const delta = screenDeltaToWorldDelta(event.translationX, event.translationY);
      onMove(dragOrigin.current.x + delta.x, dragOrigin.current.y + delta.y);
    })
    .onEnd((event) => {
      const delta = screenDeltaToWorldDelta(event.translationX, event.translationY);
      onDragEnd(dragOrigin.current.x + delta.x, dragOrigin.current.y + delta.y);
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
      <View style={{ position: 'absolute', left: minX, top: minY, width: maxX - minX, height: maxY - minY }} />
    </GestureDetector>
  );
}

const HANDLE_TOUCH_SIZE = 32;
const HANDLE_DOT_SIZE = 12;

// Petit point d'ancrage — sa propre zone de geste (32x32, centrée sur le
// point projeté), rendu par-dessus ShapeBody pour que le toucher y soit
// prioritaire à cet endroit précis plutôt que d'aller au déplacement.
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
  const worldAnchor = handleAnchor(geo, handle);
  const screenAnchor = project(worldAnchor.x, worldAnchor.y);

  const pan = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .runOnJS(true)
    .onStart(() => {
      origin.current = geo;
      last.current = geo;
    })
    .onUpdate((event) => {
      const delta = screenDeltaToWorldDelta(event.translationX, event.translationY);
      last.current = applyHandle(origin.current, handle, delta.x, delta.y);
      onResize(last.current);
    })
    .onEnd(() => onResizeEnd(last.current));

  return (
    <GestureDetector gesture={pan}>
      <View
        style={{
          position: 'absolute',
          left: screenAnchor.x - HANDLE_TOUCH_SIZE / 2,
          top: screenAnchor.y - HANDLE_TOUCH_SIZE / 2,
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
