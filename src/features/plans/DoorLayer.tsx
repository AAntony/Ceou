import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { PlanDoor } from '../../types/database';
import { clamp } from './snap';
import type { DoorEdge, ShapeGeometry } from './types';
import { clampDoorPosition, doorCenter } from './walls';

// La couche TACTILE des portes. Le dessin, lui, est dans le canevas : une
// porte EST l'interruption du mur (voir walls.ts), il n'y a donc rien à
// afficher ici. Ne restent que des zones invisibles :
//
// - une bande le long de chaque mur de la pièce sélectionnée, où appuyer
//   perce une ouverture à l'endroit touché ;
// - une cible par porte existante, pour la faire glisser ou la retirer.
//
// Cette séparation dessin/toucher est ce qui permet à la porte de rester
// discrète : la version précédente était une pastille visible parce qu'il
// fallait bien quelque chose à toucher. Ici la cible est invisible, et
// l'ouverture qu'elle commande suffit à la localiser.

// En unités de la feuille (comme tout ce qui est posé sur le plan) : la
// bande grandit donc avec le zoom, ce qui est le comportement attendu — on
// zoome justement pour viser plus facilement.
//
// ELLE PREND LE PAS SUR LE DÉPLACEMENT DE LA PIÈCE là où elle est posée :
// un glissé qui commence sur la bande ne descend pas jusqu'au corps de la
// pièce en dessous. D'où le plafond à un quart du plus petit côté — sur une
// petite pièce, deux bandes en vis-à-vis mangeraient sinon tout l'intérieur
// et il n'y aurait plus par où l'attraper.
const STRIP_THICKNESS = 22;

function stripThickness(geo: ShapeGeometry): number {
  return Math.min(STRIP_THICKNESS, Math.min(geo.width, geo.height) / 4);
}

const DOOR_TARGET = 30;

type EdgePosition = { edge: DoorEdge; position: number };

type DoorLayerProps = {
  doors: PlanDoor[];
  formeGeo: Record<string, ShapeGeometry>;
  selectedFormeId: string | null;
  scale: number;
  readOnly?: boolean;
  onCreate: (formeId: string, edge: DoorEdge, position: number) => void;
  onDragEnd: (doorId: string, edge: DoorEdge, position: number) => void;
  onTap: (door: PlanDoor) => void;
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

export function DoorLayer({ doors, formeGeo, selectedFormeId, scale, readOnly, onCreate, onDragEnd, onTap }: DoorLayerProps) {
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

  const editable = !readOnly && !!selectedFormeId;
  const selectedGeo = selectedFormeId ? formeGeo[selectedFormeId] : undefined;

  return (
    <>
      {/* Les bandes d'abord : les cibles des portes existantes sont rendues
          après, donc au-dessus — appuyer sur une porte la saisit, ça n'en
          perce pas une deuxième juste à côté. */}
      {editable && selectedGeo
        ? (['n', 's', 'w', 'e'] as DoorEdge[]).map((edge) => (
            <WallStrip
              key={`strip-${edge}`}
              edge={edge}
              geo={selectedGeo}
              thickness={stripThickness(selectedGeo)}
              onCreate={(position) => onCreate(selectedFormeId!, edge, position)}
            />
          ))
        : null}

      {doors.map((door) => {
        const geo = formeGeo[door.forme_id];
        if (!geo) return null;
        const live = positions[door.id] ?? { edge: door.edge as DoorEdge, position: door.position };
        return (
          <DoorTarget
            key={door.id}
            geo={geo}
            live={live}
            scale={scale}
            interactive={!readOnly && door.forme_id === selectedFormeId}
            onMove={(next) => setPositions((current) => ({ ...current, [door.id]: next }))}
            onRelease={(next) => onDragEnd(door.id, next.edge, next.position)}
            onTap={() => onTap(door)}
          />
        );
      })}
    </>
  );
}

/** Bande invisible posée sur un mur : y appuyer perce une ouverture. */
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

/** Cible invisible d'une porte existante : glisser pour la déplacer, appuyer pour la retirer. */
function DoorTarget({
  geo,
  live,
  scale,
  interactive,
  onMove,
  onRelease,
  onTap,
}: {
  geo: ShapeGeometry;
  live: EdgePosition;
  scale: number;
  interactive: boolean;
  onMove: (next: EdgePosition) => void;
  onRelease: (next: EdgePosition) => void;
  onTap: () => void;
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

  const pan = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .enabled(interactive)
    .runOnJS(true)
    .onStart(() => {
      dragOrigin.current = live;
    })
    .onUpdate((event) => onMove(resolve(event.translationX, event.translationY)))
    .onEnd((event) => onRelease(resolve(event.translationX, event.translationY)));

  const tap = Gesture.Tap().enabled(interactive).runOnJS(true).onEnd(() => onTap());

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
