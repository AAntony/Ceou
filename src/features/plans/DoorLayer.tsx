import { useMemo } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { DOOR_TARGET } from './constants';
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
  readOnly?: boolean;
  onCreate: (formeId: string, edge: DoorEdge, position: number) => void;
  /** Où tomberait l'ouverture si le doigt se levait maintenant — `null` dès
   *  qu'il quitte le mur. Le dessin, lui, est dans le canevas Skia. */
  onPreview: (preview: { formeId: string; edge: DoorEdge; position: number } | null) => void;
  onSelect: (door: PlanDoor) => void;
  /** La porte en cours de glissé, donnée en direct par le conteneur. */
  live: { id: string; edge: DoorEdge; position: number } | null;
};

export function DoorLayer({
  doors,
  formeGeo,
  placing,
  readOnly,
  onCreate,
  onPreview,
  onSelect,
  live,
}: DoorLayerProps) {
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
            // La valeur du serveur, sauf pour la porte qu on glisse.
            const shown = live?.id === door.id ? live : { edge: door.edge as DoorEdge, position: door.position };
            return (
              <DoorTarget
                key={door.id}
                geo={geo}
                live={shown}
                interactive={!readOnly}
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
  onCreate,
  onPreview,
}: {
  edge: DoorEdge;
  geo: ShapeGeometry;
  thickness: number;
  /** La place libre la plus proche, ou `null` si ce mur est complet. */
  place: (raw: number) => number | null;
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
// LA CIBLE D UNE PORTE N EST PLUS QU UN TAP. Son glissé est parti dans le
// geste unique du conteneur, qui reconnaît la porte visée par sa position et
// la fait contourner la pièce (voir hitTest et applyDrag dans PlanCanvas).
function DoorTarget({
  geo,
  live,
  interactive,
  onSelect,
}: {
  geo: ShapeGeometry;
  live: EdgePosition;
  interactive: boolean;
  onSelect: () => void;
}) {
  const center = doorCenter(geo, live.edge, live.position);

  const tap = Gesture.Tap().enabled(interactive).runOnJS(true).onEnd(() => onSelect());

  return (
    <GestureDetector gesture={tap}>
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
