import { Canvas, matchFont, Rect, Text as SkiaText, type SkFont } from '@shopify/react-native-skia';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { IconName } from '../../components/Icon';
import type { PlanForme, PlanPin } from '../../types/database';
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  HIGHLIGHT_GREEN_BORDER,
  MAX_SHAPE_SIZE,
  MAX_ZOOM,
  MIN_SHAPE_SIZE,
  MIN_ZOOM,
  roomColorForForme,
  shade,
} from './constants';
import { PlanPinLayer } from './PlanPinLayer';
import { snapPosition, snapResize } from './snap';
import type { HandleId, ShapeGeometry } from './types';
import { UnplacedEmplacementsBar } from './UnplacedEmplacementsBar';

const HANDLES: HandleId[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampSize(value: number): number {
  return clamp(value, MIN_SHAPE_SIZE, MAX_SHAPE_SIZE);
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

type ZoomState = { scale: number; translateX: number; translateY: number };
const IDLE_ZOOM: ZoomState = { scale: 1, translateX: 0, translateY: 0 };

type PlanCanvasProps = {
  formes: PlanForme[];
  pieceInfo: Record<string, { name: string; color: string | null }>;
  pins: PlanPin[];
  pinDisplay: Record<string, { name: string; icon: IconName }>;
  highlightFormeId?: string | null;
  highlightEmplacementId?: string | null;
  selectedFormeId: string | null;
  onDragEnd: (id: string, x: number, y: number) => void;
  onResizeEnd: (id: string, x: number, y: number, width: number, height: number) => void;
  onSelect: (forme: PlanForme) => void;
  onOpenSheet: (forme: PlanForme) => void;
  onDeselect: () => void;
  onPinDragEnd: (pinId: string, relX: number, relY: number) => void;
  onPinTap: (pin: PlanPin) => void;
  onPlaceEmplacement: (emplacementId: string) => void;
};

export function PlanCanvas({
  formes,
  pieceInfo,
  pins,
  pinDisplay,
  highlightFormeId,
  highlightEmplacementId,
  selectedFormeId,
  onDragEnd,
  onResizeEnd,
  onSelect,
  onOpenSheet,
  onDeselect,
  onPinDragEnd,
  onPinTap,
  onPlaceEmplacement,
}: PlanCanvasProps) {
  // Position ET taille vivent dans le même state, mises à jour en direct par
  // le déplacement (x/y) et les poignées de redimensionnement (x/y/width/
  // height) — un seul aller-retour réseau à la fin du geste, pas à chaque
  // frame. Plan 2D top-down pur : les coordonnées x/y SONT les coordonnées
  // écran (dans le repère du contenu zoomable), aucune projection.
  const [shapes, setShapes] = useState<Record<string, ShapeGeometry>>({});
  const [zoom, setZoom] = useState<ZoomState>(IDLE_ZOOM);
  const zoomOrigin = useRef(IDLE_ZOOM);
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

  // Pincement = zoomer, glisser à deux doigts = déplacer la vue — le geste à
  // UN doigt reste entièrement réservé au déplacement d'une pièce/pastille
  // (minPointers(1).maxPointers(1) plus bas), donc aucun conflit entre les
  // deux : ils se distinguent par le nombre de doigts, pas par une logique
  // d'exclusivité à négocier.
  const pinch = Gesture.Pinch()
    .runOnJS(true)
    .onStart(() => {
      zoomOrigin.current = zoom;
    })
    .onUpdate((event) => {
      setZoom((z) => ({ ...z, scale: clamp(zoomOrigin.current.scale * event.scale, MIN_ZOOM, MAX_ZOOM) }));
    });

  const twoFingerPan = Gesture.Pan()
    .minPointers(2)
    .maxPointers(2)
    .runOnJS(true)
    .onStart(() => {
      zoomOrigin.current = zoom;
    })
    .onUpdate((event) => {
      setZoom((z) => ({
        ...z,
        translateX: zoomOrigin.current.translateX + event.translationX,
        translateY: zoomOrigin.current.translateY + event.translationY,
      }));
    });

  // Un point en coordonnées VIEWPORT (écran, avant zoom/pan) devient un point
  // dans le repère du contenu en inversant la transformation appliquée à la
  // vue interne — nécessaire pour savoir si un tap "dans le vide" tombe
  // réellement en dehors de toute pièce.
  const viewportToContent = (vx: number, vy: number) => ({
    x: (vx - zoom.translateX) / zoom.scale,
    y: (vy - zoom.translateY) / zoom.scale,
  });
  const isInsideAnyRoom = (x: number, y: number) =>
    formes.some((f) => {
      const g = geoById[f.id];
      return x >= g.x && x <= g.x + g.width && y >= g.y && y <= g.y + g.height;
    });

  // Déplacer la vue à un seul doigt n'est possible que lorsqu'aucune pièce
  // n'est sélectionnée (sinon le doigt sert à la déplacer elle-même —
  // exclusion mutuelle garantie par cette même condition côté ShapeBody, donc
  // jamais les deux actifs en même temps). Avec quelque chose de sélectionné,
  // le pan à deux doigts (ci-dessus) reste disponible pour naviguer sans
  // désélectionner.
  const backgroundPan = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .enabled(selectedFormeId === null)
    .runOnJS(true)
    .onStart(() => {
      zoomOrigin.current = zoom;
    })
    .onUpdate((event) => {
      setZoom((z) => ({
        ...z,
        translateX: zoomOrigin.current.translateX + event.translationX,
        translateY: zoomOrigin.current.translateY + event.translationY,
      }));
    });

  // Remplace le bouton "Valider" : un tap qui ne touche aucune pièce
  // désélectionne. Le calcul en JS (plutôt que de compter sur une priorité
  // de geste implicite) garantit qu'un tap sur une pièce ne désélectionne
  // jamais par erreur, même si ce geste et celui de la pièce touchée
  // observent tous les deux le même toucher.
  const backgroundTap = Gesture.Tap()
    .maxDistance(8)
    .runOnJS(true)
    .onEnd((event) => {
      if (!selectedFormeId) return;
      const point = viewportToContent(event.x, event.y);
      if (!isInsideAnyRoom(point.x, point.y)) onDeselect();
    });

  return (
    <View
      style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, overflow: 'hidden' }}
      className="self-center rounded-2xl bg-sand-dark"
    >
      {/* Le geste de fond (pan/tap/pinch) ne doit couvrir QUE le contenu du
          plan — s'il englobait aussi le menu HUD ci-dessous, un tap sur une
          icône du menu serait aussi vu comme un tap "dans le vide" et
          intercepté par ce GestureDetector avant d'atteindre le Pressable de
          l'icône (le bug exact qui empêchait d'ajouter un Emplacement). Le
          menu est donc rendu en dehors de ce sous-arbre, pas seulement
          visuellement par-dessus. */}
      <GestureDetector gesture={Gesture.Simultaneous(pinch, twoFingerPan, Gesture.Exclusive(backgroundPan, backgroundTap))}>
        <View style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}>
          <View
            style={{
              width: CANVAS_WIDTH,
              height: CANVAS_HEIGHT,
              transform: [{ translateX: zoom.translateX }, { translateY: zoom.translateY }, { scale: zoom.scale }],
            }}
          >
            <Canvas style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}>
              {formes.map((forme) => {
                const geo = geoById[forme.id];
                const info = forme.piece_id ? pieceInfo[forme.piece_id] : undefined;
                return (
                  <RoomVisual
                    key={forme.id}
                    geo={geo}
                    color={info?.color ?? roomColorForForme(forme.id)}
                    label={info?.name ?? ''}
                    font={font}
                    highlighted={forme.id === highlightFormeId}
                    selected={forme.id === selectedFormeId}
                  />
                );
              })}
            </Canvas>

            {formes.map((forme) => {
              const geo = geoById[forme.id];
              const isSelected = forme.id === selectedFormeId;
              const others = formes.filter((f) => f.id !== forme.id).map((f) => geoById[f.id]);
              return (
                <ShapeBody
                  key={forme.id}
                  geo={geo}
                  others={others}
                  isSelected={isSelected}
                  scale={zoom.scale}
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
                    scale={zoom.scale}
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
              highlightedEmplacementId={highlightEmplacementId}
              scale={zoom.scale}
              onDragEnd={onPinDragEnd}
              onTap={onPinTap}
            />
          </View>
        </View>
      </GestureDetector>

      {/* HUD fixe — hors du sous-arbre du GestureDetector ci-dessus, pas
          seulement visuellement par-dessus (voir commentaire plus haut) */}
      {selectedForme?.piece_id ? (
        <UnplacedEmplacementsBar pieceId={selectedForme.piece_id} pins={pins} onPlace={onPlaceEmplacement} />
      ) : null}
    </View>
  );
}

// Rectangle plein (couleur par pièce individuelle) + contour + nom centré —
// plan 2D top-down pur, aucune projection. `highlighted` (vient de "Voir sur
// le plan") NE change PAS le remplissage (la pièce garde sa couleur normale,
// lisibilité du plan dans son ensemble préservée) — seul le contour devient
// vert et plus épais. `selected` (édition en cours) prend le pas en corail
// si les deux sont vrais en même temps (cas rare : la pièce surlignée est
// aussi celle qu'on édite).
function RoomVisual({
  geo,
  color,
  label,
  font,
  highlighted,
  selected,
}: {
  geo: ShapeGeometry;
  color: string;
  label: string;
  font: SkFont | null;
  highlighted: boolean;
  selected: boolean;
}) {
  const borderColor = shade(color, 0.25);
  const centerX = geo.x + geo.width / 2;
  const centerY = geo.y + geo.height / 2;

  return (
    <>
      <Rect x={geo.x} y={geo.y} width={geo.width} height={geo.height} color={color} style="fill" />
      <Rect x={geo.x} y={geo.y} width={geo.width} height={geo.height} color={borderColor} style="stroke" strokeWidth={2} />
      {selected ? (
        <Rect x={geo.x} y={geo.y} width={geo.width} height={geo.height} color="#FF6B4A" style="stroke" strokeWidth={3} />
      ) : highlighted ? (
        <Rect x={geo.x} y={geo.y} width={geo.width} height={geo.height} color={HIGHLIGHT_GREEN_BORDER} style="stroke" strokeWidth={4} />
      ) : null}
      {label && font ? (
        <SkiaText x={centerX - label.length * 3} y={centerY} text={label} font={font} color="#2D2A26" />
      ) : null}
    </>
  );
}

// Déplacement (tout le corps de la forme, uniquement quand sélectionnée) +
// sélection au tap simple / ouverture de la fiche au double-tap. Tap simple
// est toujours actif, y compris sur une pièce non sélectionnée pendant
// qu'une autre l'est — passer directement d'une pièce à l'autre sans devoir
// d'abord "Valider" la précédente. Le déplacement passe par snapPosition()
// pour s'accoler magnétiquement aux pièces voisines.
function ShapeBody({
  geo,
  others,
  isSelected,
  scale,
  onMove,
  onDragEnd,
  onSelect,
  onOpenSheet,
}: {
  geo: ShapeGeometry;
  others: ShapeGeometry[];
  isSelected: boolean;
  scale: number;
  onMove: (x: number, y: number) => void;
  onDragEnd: (x: number, y: number) => void;
  onSelect: () => void;
  onOpenSheet: () => void;
}) {
  const dragOrigin = useRef(geo);
  const HIT_SLOP = 12;

  // event.translation(X|Y) est un delta ÉCRAN, avant mise à l'échelle du
  // zoom — diviser par `scale` pour obtenir le déplacement réel dans le
  // repère (non zoomé) où vivent x/y.
  const resolve = (translationX: number, translationY: number) => {
    const rawX = dragOrigin.current.x + translationX / scale;
    const rawY = dragOrigin.current.y + translationY / scale;
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

  // Un tap simple sélectionne (déplacer/redimensionner) — toujours actif,
  // même sur une pièce non sélectionnée pendant qu'une autre l'est, pour
  // pouvoir enchaîner les pièces sans étape de validation intermédiaire. Il
  // faut un double-tap pour ouvrir la fiche (choix de pièce/suppression) ;
  // doubleTap doit être listé en premier dans Exclusive pour faire attendre
  // singleTap le temps de voir si un second tap suit.
  const singleTap = Gesture.Tap().numberOfTaps(1).hitSlop(HIT_SLOP).runOnJS(true).onEnd(() => onSelect());
  const doubleTap = Gesture.Tap().numberOfTaps(2).hitSlop(HIT_SLOP).runOnJS(true).onEnd(() => onOpenSheet());
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
  scale,
  onResize,
  onResizeEnd,
}: {
  geo: ShapeGeometry;
  handle: HandleId;
  others: ShapeGeometry[];
  scale: number;
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
      const raw = applyHandle(origin.current, handle, event.translationX / scale, event.translationY / scale);
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
