import type { HandleId, ShapeGeometry } from './types';

// === Qui prend le doigt ? =================================================
//
// UN SEUL glissé existe sur le plan, posé sur le conteneur, dans la même
// composition que le pincement. Ce fichier répond à la seule question qui
// reste : au moment où le doigt se pose, qu'est-ce qu'il va manipuler ?
//
// C'est un choix d'architecture, et il vient de trois échecs successifs. Tant
// que chaque pièce, chaque poignée, chaque puce et chaque porte portait son
// propre geste, il fallait sans cesse arbitrer : un geste d'enfant coupe
// celui de l'ancêtre en s'activant, ce qui tuait le pincement ; le remettre
// en piste demandait des relations croisées entre composants, invérifiables
// et fragiles. Ici il n'y a plus rien à arbitrer — juste de l'arithmétique,
// et de l'arithmétique, ça se vérifie.
//
// Les cibles sont ordonnées de la plus PETITE et la plus précise à la plus
// grande : une poignée passe avant la puce qui la recouvre, qui passe avant
// le corps de la pièce, qui passe avant le plan lui-même.

export type PlanTarget =
  | { kind: 'view' }
  | { kind: 'room'; formeId: string }
  | { kind: 'handle'; handle: HandleId }
  | { kind: 'pin'; pinId: string }
  | { kind: 'door'; doorId: string };

export type PlanTargets = {
  /** Poignées de redimensionnement de la pièce sélectionnée. */
  handles: { handle: HandleId; x: number; y: number; radius: number }[];
  /** Puces glissables, centre et demi-dimensions de leur carte. */
  pins: { id: string; x: number; y: number; halfWidth: number; halfHeight: number }[];
  /** Portes glissables, centre et rayon de leur cible. */
  doors: { id: string; x: number; y: number; radius: number }[];
  /** La pièce sélectionnée, seule à pouvoir être déplacée. */
  room: { formeId: string; geo: ShapeGeometry } | null;
};

const EMPTY: PlanTargets = { handles: [], pins: [], doors: [], room: null };

function withinSquare(px: number, py: number, cx: number, cy: number, radius: number): boolean {
  return Math.abs(px - cx) <= radius && Math.abs(py - cy) <= radius;
}

export function hitTestPlan(point: { x: number; y: number }, targets: PlanTargets = EMPTY): PlanTarget {
  for (const handle of targets.handles) {
    if (withinSquare(point.x, point.y, handle.x, handle.y, handle.radius)) {
      return { kind: 'handle', handle: handle.handle };
    }
  }

  for (const pin of targets.pins) {
    if (Math.abs(point.x - pin.x) <= pin.halfWidth && Math.abs(point.y - pin.y) <= pin.halfHeight) {
      return { kind: 'pin', pinId: pin.id };
    }
  }

  for (const door of targets.doors) {
    if (withinSquare(point.x, point.y, door.x, door.y, door.radius)) {
      return { kind: 'door', doorId: door.id };
    }
  }

  const room = targets.room;
  if (
    room &&
    point.x >= room.geo.x &&
    point.x <= room.geo.x + room.geo.width &&
    point.y >= room.geo.y &&
    point.y <= room.geo.y + room.geo.height
  ) {
    return { kind: 'room', formeId: room.formeId };
  }

  return { kind: 'view' };
}
