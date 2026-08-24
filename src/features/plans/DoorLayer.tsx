import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector, type GestureType } from 'react-native-gesture-handler';
import type { PlanDoor } from '../../types/database';
import { clamp } from './snap';
import type { DoorEdge, ShapeGeometry } from './types';
import { clampDoorPosition, doorCenter, freeDoorPosition, type DoorSpan, type NeighbourRoom } from './walls';

// La couche TACTILE des portes. Le dessin, lui, est dans le canevas : une
// porte EST l'interruption du mur (voir walls.ts).
//
// DEUXIÈME VERSION, après un test qui a conclu « pas du tout pratique ni
// intuitif ». La première posait des bandes invisibles en permanence sur les
// murs de la pièce sélectionnée : rien n'annonçait qu'on pouvait appuyer là,
// et ces bandes volaient les gestes de déplacement et de redimensionnement.
//
// Ce que font les éditeurs de plan qui marchent (magicplan, Planner 5D,
// Floorplanner) : la pose est un MODE qu'on arme explicitement, avec des
// cibles visibles, et l'objet posé se SÉLECTIONNE avant toute action —
// jamais une suppression sur le geste principal.
//
// D'où deux régimes ici, jamais actifs en même temps :
//
// - pose armée : une bande par mur de CHAQUE pièce, et rien d'autre ne
//   répond (le canevas retire le corps des pièces et les poignées). Aucun
//   conflit possible, c'est la leçon de la première version.
// - mode normal : plus aucune bande. Seules les portes déjà posées ont une
//   cible, pour être sélectionnées puis glissées le long des murs.

// En unités de la feuille : la bande grandit avec le zoom, ce qui est le
// comportement attendu — on zoome justement pour viser plus facilement.
const STRIP_THICKNESS = 22;
const DOOR_TARGET = 30;

function stripThickness(geo: ShapeGeometry): number {
  // Plafonnée au quart du plus petit côté : sur une petite pièce, deux
  // bandes en vis-à-vis couvriraient toute la surface.
  return Math.min(STRIP_THICKNESS, Math.min(geo.width, geo.height) / 4);
}

type EdgePosition = { edge: DoorEdge; position: number };

type DoorLayerProps = {
  doors: PlanDoor[];
  formeGeo: Record<string, ShapeGeometry>;
  /** Pose armée : les murs deviennent des cibles, le reste se tait. */
  placing: boolean;
  selectedDoorId: string | null;
  scale: number;
  readOnly?: boolean;
  onCreate: (formeId: string, edge: DoorEdge, position: number) => void;
  /** Où tomberait l'ouverture si le doigt se levait maintenant — `null` dès
   *  qu'il quitte le mur. Le dessin, lui, est dans le canevas Skia. */
  onPreview: (preview: { formeId: string; edge: DoorEdge; position: number } | null) => void;
  onSelect: (door: PlanDoor) => void;
  onDragEnd: (doorId: string, edge: DoorEdge, position: number) => void;
  /** Le pincement à deux doigts passe avant le glissé d une porte. */
  pinchRef: React.RefObject<GestureType | undefined>;
};

/**
 * Projette un point sur le bord le plus proche du rectangle. Une porte ne
 * peut pas quitter les murs : en glissant, elle contourne la pièce et change
 * de mur en passant un coin, plutôt que de se détacher.
 */
function nearestEdge(px: number, py: number, geo: ShapeGeometry): EdgePosition {
  const distances: { edge: DoorEdge; distance: number; position: number }[] = [
    { edge: 'n', distance: Math.abs(py - geo.y), position: (px - geo.x) / geo.width },
    { edge: 's', distance: Math.abs(py - (geo.y + geo.height)), position: (px - geo.x) / geo.width },
    { edge: 'w', distance: Math.abs(px - geo.x), position: (py - geo.y) / geo.height },
    { edge: 'e', distance: Math.abs(px - (geo.x + geo.width)), position: (py - geo.y) / geo.height },
  ];
  const nearest = distances.reduce((best, candidate) => (candidate.distance < best.distance ? candidate : best));
  const length = nearest.edge === 'n' || nearest.edge === 's' ? geo.width : geo.height;
  return { edge: nearest.edge, position: clampDoorPosition(clamp(nearest.position, 0, 1), length) };
}

export function DoorLayer({
  doors,
  formeGeo,
  placing,
  selectedDoorId,
  scale,
  readOnly,
  onCreate,
  onPreview,
  onSelect,
  onDragEnd,
  pinchRef,
}: DoorLayerProps) {
  // Position en cours de glissé, locale : la base ne connaît la nouvelle
  // place de la porte qu'au relâché, comme pour les pièces et les pastilles.
  const [positions, setPositions] = useState<Record<string, EdgePosition>>({});

  useEffect(() => {
    setPositions((current) => {
      const next: Record<string, EdgePosition> = {};
      for (const door of doors) {
        next[door.id] = current[door.id] ?? { edge: door.edge as DoorEdge, position: door.position };
      }
      return next;
    });
  }, [doors]);

  // Les portes de chaque pièce, dans la forme qu'attend le calcul des murs.
  // Servent ici à empêcher deux ouvertures de se poser l'une sur l'autre :
  // rien ne l'interdisait, et les deux fusionnaient alors en un seul trou dont
  // la seconde porte devenait impossible à désigner.
  const spansByForme = useMemo(() => {
    const map: Record<string, DoorSpan[]> = {};
    for (const door of doors) {
      (map[door.forme_id] ??= []).push({ edge: door.edge as DoorEdge, position: door.position });
    }
    return map;
  }, [doors]);

  // Les voisines comptent : sur un mur mitoyen, les deux pièces tracent le
  // même trait, et deux portes posées face à face n'en feraient qu'une.
  const neighboursOf = (formeId: string): NeighbourRoom[] =>
    Object.entries(formeGeo)
      .filter(([id]) => id !== formeId)
      .map(([id, geo]) => ({ geo, doors: spansByForme[id] ?? [] }));

  return (
    <>
      {placing && !readOnly
        ? Object.entries(formeGeo).flatMap(([formeId, geo]) =>
            (['n', 's', 'w', 'e'] as DoorEdge[]).map((edge) => (
              <WallStrip
                key={`strip-${formeId}-${edge}`}
                edge={edge}
                geo={geo}
                thickness={stripThickness(geo)}
                place={(raw) => freeDoorPosition(geo, edge, raw, spansByForme[formeId] ?? [], neighboursOf(formeId))}
                pinchRef={pinchRef}
                onCreate={(position) => onCreate(formeId, edge, position)}
                onPreview={(position) => onPreview(position === null ? null : { formeId, edge, position })}
              />
            )),
          )
        : null}

      {/* Pendant la pose, les portes déjà là ne répondent plus : on est en
          train d'en ajouter, pas d'en déplacer. */}
      {placing
        ? null
        : doors.map((door) => {
            const geo = formeGeo[door.forme_id];
            if (!geo) return null;
            const live = positions[door.id] ?? { edge: door.edge as DoorEdge, position: door.position };
            return (
              <DoorTarget
                key={door.id}
                geo={geo}
                live={live}
                scale={scale}
                place={(edge, raw) =>
                  freeDoorPosition(
                    geo,
                    edge,
                    raw,
                    // Sans s'exclure elle-même, une porte se bloquerait sur
                    // sa propre place dès le premier millimètre de glissé.
                    (spansByForme[door.forme_id] ?? []).filter(
                      (span) => !(span.edge === (door.edge as DoorEdge) && span.position === door.position),
                    ),
                    neighboursOf(door.forme_id),
                  )
                }
                interactive={!readOnly}
                pinchRef={pinchRef}
                selected={door.id === selectedDoorId}
                onMove={(next) => setPositions((current) => ({ ...current, [door.id]: next }))}
                onRelease={(next) => onDragEnd(door.id, next.edge, next.position)}
                onSelect={() => onSelect(door)}
              />
            );
          })}
    </>
  );
}

/**
 * Bande posée sur un mur pendant la pose : y appuyer perce une ouverture.
 *
 * Le doigt est suivi tant qu'il reste posé (Pan à distance nulle) et
 * l'ouverture est annoncée en pointillé sous lui avant d'être créée au
 * relâché — on ne pose plus à l'aveugle. Le tap reste en second recours
 * (Exclusive) pour l'appui parfaitement immobile, qui n'active pas toujours
 * un Pan ; l'un OU l'autre aboutit, jamais les deux.
 */
function WallStrip({
  edge,
  geo,
  thickness,
  place,
  pinchRef,
  onCreate,
  onPreview,
}: {
  edge: DoorEdge;
  geo: ShapeGeometry;
  thickness: number;
  /** La place libre la plus proche, ou `null` si ce mur est complet. */
  place: (raw: number) => number | null;
  pinchRef: React.RefObject<GestureType | undefined>;
  onCreate: (position: number) => void;
  onPreview: (position: number | null) => void;
}) {
  const horizontal = edge === 'n' || edge === 's';
  const length = horizontal ? geo.width : geo.height;

  // `event.x/y` est relatif à CETTE vue, donc directement la distance
  // parcourue le long du mur — pas besoin de repasser par le repère de la
  // feuille. La position visée glisse ensuite vers la place libre la plus
  // proche : l'aperçu montre donc où la porte tombera VRAIMENT, y compris
  // quand le doigt vise une ouverture déjà occupée.
  const positionAt = (x: number, y: number) =>
    place(clampDoorPosition(clamp((horizontal ? x : y) / length, 0, 1), length));

  // Un mur plein n'accepte plus rien : ni aperçu, ni pose. Rien ne se passe,
  // plutôt qu'une porte qui se poserait sur une autre.
  const preview = (x: number, y: number) => onPreview(positionAt(x, y));
  const create = (x: number, y: number) => {
    const position = positionAt(x, y);
    if (position !== null) onCreate(position);
  };

  const pan = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .minDistance(0)
    .simultaneousWithExternalGesture(pinchRef)
    .runOnJS(true)
    .onBegin((event) => preview(event.x, event.y))
    .onUpdate((event) => preview(event.x, event.y))
    .onEnd((event) => create(event.x, event.y))
    .onFinalize(() => onPreview(null));

  const tap = Gesture.Tap()
    .runOnJS(true)
    .onBegin((event) => preview(event.x, event.y))
    .onEnd((event) => create(event.x, event.y))
    .onFinalize(() => onPreview(null));

  return (
    <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
      <View
        style={{
          position: 'absolute',
          left: horizontal ? geo.x : (edge === 'w' ? geo.x : geo.x + geo.width) - thickness / 2,
          top: horizontal ? (edge === 'n' ? geo.y : geo.y + geo.height) - thickness / 2 : geo.y,
          width: horizontal ? geo.width : thickness,
          height: horizontal ? thickness : geo.height,
        }}
      />
    </GestureDetector>
  );
}

/** Cible d'une porte posée : appuyer la sélectionne, glisser la déplace. */
function DoorTarget({
  geo,
  live,
  scale,
  interactive,
  selected,
  place,
  pinchRef,
  onMove,
  onRelease,
  onSelect,
}: {
  geo: ShapeGeometry;
  live: EdgePosition;
  scale: number;
  interactive: boolean;
  selected: boolean;
  place: (edge: DoorEdge, raw: number) => number | null;
  pinchRef: React.RefObject<GestureType | undefined>;
  onMove: (next: EdgePosition) => void;
  onRelease: (next: EdgePosition) => void;
  onSelect: () => void;
}) {
  const dragOrigin = useRef(live);
  // Dernière position VALIDE : quand le doigt emmène la porte sur une place
  // déjà prise, elle s'arrête là plutôt que de sauter par-dessus sa voisine.
  const lastValid = useRef(live);
  const center = doorCenter(geo, live.edge, live.position);

  // translationX/Y est un delta ÉCRAN, avant zoom : le diviser par `scale`
  // pour retrouver un déplacement dans le repère de la feuille (même
  // raisonnement que ShapeBody et PlanPinLayer).
  const resolve = (translationX: number, translationY: number): EdgePosition => {
    const origin = doorCenter(geo, dragOrigin.current.edge, dragOrigin.current.position);
    const target = nearestEdge(origin.x + translationX / scale, origin.y + translationY / scale, geo);
    const free = place(target.edge, target.position);
    if (free === null) return lastValid.current;
    lastValid.current = { edge: target.edge, position: free };
    return lastValid.current;
  };

  // Le glissé n'est ouvert qu'une fois la porte SÉLECTIONNÉE — un pouce qui
  // ripe en voulant simplement la désigner ne doit pas la déplacer. Même
  // règle que pour les pièces.
  const pan = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .enabled(interactive && selected)
    .simultaneousWithExternalGesture(pinchRef)
    .runOnJS(true)
    .onStart(() => {
      dragOrigin.current = live;
      lastValid.current = live;
    })
    .onUpdate((event) => onMove(resolve(event.translationX, event.translationY)))
    .onEnd((event) => onRelease(resolve(event.translationX, event.translationY)));

  const tap = Gesture.Tap().enabled(interactive).runOnJS(true).onEnd(() => onSelect());

  return (
    <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
      <View
        style={{
          position: 'absolute',
          left: center.x - DOOR_TARGET / 2,
          top: center.y - DOOR_TARGET / 2,
          width: DOOR_TARGET,
          height: DOOR_TARGET,
        }}
      />
    </GestureDetector>
  );
}
