import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { PlanDoor } from '../../types/database';
import { clamp } from './snap';
import type { DoorEdge, ShapeGeometry } from './types';
import { clampDoorPosition, doorCenter } from './walls';

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
  onSelect: (door: PlanDoor) => void;
  onDragEnd: (doorId: string, edge: DoorEdge, position: number) => void;
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
  onSelect,
  onDragEnd,
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
                onCreate={(position) => onCreate(formeId, edge, position)}
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
                interactive={!readOnly}
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

/** Bande posée sur un mur pendant la pose : y appuyer perce une ouverture. */
function WallStrip({
  edge,
  geo,
  thickness,
  onCreate,
}: {
  edge: DoorEdge;
  geo: ShapeGeometry;
  thickness: number;
  onCreate: (position: number) => void;
}) {
  const horizontal = edge === 'n' || edge === 's';
  const length = horizontal ? geo.width : geo.height;

  // `event.x/y` est relatif à CETTE vue, donc directement la distance
  // parcourue le long du mur — pas besoin de repasser par le repère de la
  // feuille.
  const tap = Gesture.Tap()
    .runOnJS(true)
    .onEnd((event) => {
      const along = horizontal ? event.x : event.y;
      onCreate(clampDoorPosition(clamp(along / length, 0, 1), length));
    });

  return (
    <GestureDetector gesture={tap}>
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
  onMove,
  onRelease,
  onSelect,
}: {
  geo: ShapeGeometry;
  live: EdgePosition;
  scale: number;
  interactive: boolean;
  selected: boolean;
  onMove: (next: EdgePosition) => void;
  onRelease: (next: EdgePosition) => void;
  onSelect: () => void;
}) {
  const dragOrigin = useRef(live);
  const center = doorCenter(geo, live.edge, live.position);

  // translationX/Y est un delta ÉCRAN, avant zoom : le diviser par `scale`
  // pour retrouver un déplacement dans le repère de la feuille (même
  // raisonnement que ShapeBody et PlanPinLayer).
  const resolve = (translationX: number, translationY: number): EdgePosition => {
    const origin = doorCenter(geo, dragOrigin.current.edge, dragOrigin.current.position);
    return nearestEdge(origin.x + translationX / scale, origin.y + translationY / scale, geo);
  };

  // Le glissé n'est ouvert qu'une fois la porte SÉLECTIONNÉE — un pouce qui
  // ripe en voulant simplement la désigner ne doit pas la déplacer. Même
  // règle que pour les pièces.
  const pan = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .enabled(interactive && selected)
    .runOnJS(true)
    .onStart(() => {
      dragOrigin.current = live;
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
