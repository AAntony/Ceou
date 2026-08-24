import { DOOR_JAMB_LENGTH, DOOR_MIN_GAP, DOOR_WIDTH, WALL_WIDTH, WALL_WIDTH_INNER } from './constants';
import type { DoorEdge, ShapeGeometry } from './types';

// Le trait de mur d'une pièce, PERCÉ de ses portes et HIÉRARCHISÉ.
//
// Une porte n'est pas un objet posé sur le mur : c'est le mur qui s'arrête et
// reprend plus loin. C'est la convention des plans d'architecte, et c'est ce
// qui la rend discrète — elle retire de l'encre au lieu d'en ajouter (la
// version précédente, une pastille à icône, avait été retirée pour ça).
//
// Deuxième convention reprise ici : un mur porteur se trace épais, une
// cloison fine. Le classement ne se saisit pas, il se déduit — un pan de mur
// qui longe le mur d'une voisine sépare deux pièces, donc c'est une cloison ;
// tout le reste ferme le logement.
//
// D'où ce calcul : au lieu d'un rectangle tracé d'un trait, chaque mur est
// découpé en segments — autour des ouvertures qu'il porte, ET à chaque
// changement d'épaisseur.

export type DoorSpan = { edge: DoorEdge; position: number };
export type Segment = { x1: number; y1: number; x2: number; y2: number };
/** `interior` : cloison entre deux pièces (fine) plutôt que mur de façade. */
export type WallSegment = Segment & { interior: boolean };
/**
 * Une pièce voisine, telle que le calcul des murs a besoin de la connaître :
 * sa géométrie dit quels pans sont mitoyens, et ses portes disent où le mur
 * commun est percé — une porte entre deux pièces n'appartient qu'à l'une des
 * deux, mais elle traverse le mur des DEUX.
 */
export type NeighbourRoom = { geo: ShapeGeometry; doors: DoorSpan[] };

/** Les quatre murs, du coin haut-gauche et dans le sens des aiguilles. */
const EDGES: DoorEdge[] = ['n', 'e', 's', 'w'];

// Deux pièces accolées le sont EXACTEMENT (snapPosition les aligne au pixel),
// mais un redimensionnement peut laisser une fraction d'unité : sans cette
// tolérance, un mur mitoyen se retrouverait tracé épais des deux côtés pour un
// écart invisible à l'écran.
const TOUCH_EPSILON = 1;

type Interval = { start: number; end: number };
type EdgeIntervals = Record<DoorEdge, Interval[]>;

export function wallWidth(interior: boolean): number {
  return interior ? WALL_WIDTH_INNER : WALL_WIDTH;
}

function edgeLength(geo: ShapeGeometry, edge: DoorEdge): number {
  return edge === 'n' || edge === 's' ? geo.width : geo.height;
}

/** Point situé à `distance` du départ du mur, dans le repère de la feuille. */
function pointAlong(geo: ShapeGeometry, edge: DoorEdge, distance: number): { x: number; y: number } {
  if (edge === 'n') return { x: geo.x + distance, y: geo.y };
  if (edge === 's') return { x: geo.x + distance, y: geo.y + geo.height };
  if (edge === 'w') return { x: geo.x, y: geo.y + distance };
  return { x: geo.x + geo.width, y: geo.y + distance };
}

/**
 * Ramene une position pour que l'ouverture tienne ENTIEREMENT dans le mur.
 *
 * Sans ca, une porte posee tout au bord mange le coin de la piece : la
 * moitie de son ouverture depasse sur le mur perpendiculaire, et l'angle
 * disparait. Un mur plus court qu'une porte n'a d'autre choix que le centre.
 */
export function clampDoorPosition(position: number, wallLength: number): number {
  const half = DOOR_WIDTH / 2 / wallLength;
  if (half >= 0.5) return 0.5;
  return Math.min(1 - half, Math.max(half, position));
}

export function doorCenter(geo: ShapeGeometry, edge: DoorEdge, position: number): { x: number; y: number } {
  return pointAlong(geo, edge, position * edgeLength(geo, edge));
}

/**
 * La position libre la plus proche de celle visée, ou `null` si ce mur ne
 * peut plus accueillir d'ouverture.
 *
 * Rien n'empêchait jusqu'ici de poser une porte SUR une autre : les deux
 * ouvertures fusionnaient en un seul trou, et la seconde porte devenait
 * impossible à désigner puisqu'elle occupait le même point que la première.
 * Une porte cherche donc désormais la place libre la plus proche de l'endroit
 * visé, au lieu d'accepter n'importe quel point.
 *
 * Les portes de la pièce VOISINE comptent aussi : sur un mur mitoyen, les
 * deux pièces tracent le même trait, et deux ouvertures posées face à face
 * n'en feraient qu'une, deux fois plus large.
 */
export function freeDoorPosition(
  geo: ShapeGeometry,
  edge: DoorEdge,
  desired: number,
  ownDoors: DoorSpan[],
  neighbours: NeighbourRoom[] = [],
): number | null {
  const length = edgeLength(geo, edge);
  const half = DOOR_WIDTH / 2;
  if (length < DOOR_WIDTH) return null;

  // Deux centres doivent rester séparés d'au moins une ouverture entière plus
  // un morceau de mur : sans cette marge, deux portes accolées se lisent
  // comme une seule baie.
  const keepOut = DOOR_WIDTH + DOOR_MIN_GAP;
  const occupiedCenters = [
    // `.filter` SUR LE MUR, et c'est tout le correctif du 2026-08-24 : sans
    // lui, chaque porte de la pièce bloquait sa position RELATIVE sur les
    // quatre murs à la fois. Une porte au milieu du mur sud interdisait donc
    // le milieu des trois autres — et comme la zone interdite fait 54 unités
    // de part et d'autre, un mur de moins de 160 se retrouvait entièrement
    // condamné. D'où des murs sur lesquels il devenait impossible de poser
    // quoi que ce soit.
    ...ownDoors.filter((door) => door.edge === edge).map((door) => door.position * length),
    ...facingDoorGaps(geo, edge, neighbours).map((gap) => (gap.start + gap.end) / 2),
  ];
  const blocked = mergeIntervals(occupiedCenters.map((center) => ({ start: center - keepOut, end: center + keepOut })));

  // Ce qui reste ouvert entre [half, length - half] une fois les zones
  // interdites retirées.
  const allowed: Interval[] = [];
  let cursor = half;
  for (const zone of blocked) {
    if (zone.start > cursor) allowed.push({ start: cursor, end: Math.min(zone.start, length - half) });
    cursor = Math.max(cursor, zone.end);
  }
  if (cursor < length - half) allowed.push({ start: cursor, end: length - half });

  const target = desired * length;
  let best: number | null = null;
  for (const span of allowed) {
    if (span.end < span.start) continue;
    const candidate = Math.min(Math.max(target, span.start), span.end);
    if (best === null || Math.abs(candidate - target) < Math.abs(best - target)) best = candidate;
  }

  return best === null ? null : best / length;
}

/**
 * Les deux extrémités de l'ouverture d'une porte, dans le repère de la
 * feuille — de quoi la surligner quand elle est sélectionnée, ou en dessiner
 * l'aperçu pendant la pose, sans recalculer la découpe des murs.
 */
export function doorSpan(geo: ShapeGeometry, edge: DoorEdge, position: number): Segment {
  const length = edgeLength(geo, edge);
  const center = position * length;
  const start = pointAlong(geo, edge, Math.max(0, center - DOOR_WIDTH / 2));
  const end = pointAlong(geo, edge, Math.min(length, center + DOOR_WIDTH / 2));
  return { x1: start.x, y1: start.y, x2: end.x, y2: end.y };
}

/**
 * Les tableaux des portes : deux traits perpendiculaires au mur, aux
 * extrémités de chaque ouverture. C'est ce qui distingue une porte d'un mur
 * simplement interrompu, et c'est devenu indispensable dès lors qu'une
 * cloison ne fait plus que 2 unités d'épaisseur.
 */
export function doorJambs(geo: ShapeGeometry, doors: DoorSpan[], neighbours: NeighbourRoom[] = []): Segment[] {
  const jambs: Segment[] = [];
  const partitionsByEdge: Partial<EdgeIntervals> = {};

  for (const door of doors) {
    const length = edgeLength(geo, door.edge);
    const center = door.position * length;
    const horizontal = door.edge === 'n' || door.edge === 's';
    const partitions = (partitionsByEdge[door.edge] ??= partitionIntervals(geo, door.edge, neighbours));
    // Le trait traverse le mur et déborde d'autant de chaque côté : sur une
    // cloison il reste discret, sur une façade il tient la comparaison.
    const reach = wallWidth(containsPoint(partitions, center)) / 2 + DOOR_JAMB_LENGTH;

    for (const distance of [Math.max(0, center - DOOR_WIDTH / 2), Math.min(length, center + DOOR_WIDTH / 2)]) {
      const point = pointAlong(geo, door.edge, distance);
      jambs.push(
        horizontal
          ? { x1: point.x, y1: point.y - reach, x2: point.x, y2: point.y + reach }
          : { x1: point.x - reach, y1: point.y, x2: point.x + reach, y2: point.y },
      );
    }
  }

  return jambs;
}

function mergeIntervals(intervals: Interval[]): Interval[] {
  return intervals
    .slice()
    .sort((a, b) => a.start - b.start)
    .reduce<Interval[]>((merged, interval) => {
      const last = merged[merged.length - 1];
      if (last && interval.start <= last.end) last.end = Math.max(last.end, interval.end);
      else merged.push({ ...interval });
      return merged;
    }, []);
}

/**
 * Les portions d'un mur qui touchent le mur opposé d'une pièce voisine —
 * autrement dit ce qui, sur ce mur, est une CLOISON et non une façade.
 *
 * Un mur peut n'être mitoyen que sur une partie de sa longueur (une petite
 * pièce collée au milieu d'un grand séjour) : le résultat est une liste
 * d'intervalles, pas un booléen.
 */
function partitionIntervals(geo: ShapeGeometry, edge: DoorEdge, neighbours: NeighbourRoom[]): Interval[] {
  const shared: Interval[] = [];

  for (const { geo: other } of neighbours) {
    if (edge === 'n' || edge === 's') {
      const line = edge === 'n' ? geo.y : geo.y + geo.height;
      const facing = edge === 'n' ? other.y + other.height : other.y;
      if (Math.abs(facing - line) > TOUCH_EPSILON) continue;
      const start = Math.max(geo.x, other.x) - geo.x;
      const end = Math.min(geo.x + geo.width, other.x + other.width) - geo.x;
      if (end - start > TOUCH_EPSILON) shared.push({ start, end });
    } else {
      const line = edge === 'w' ? geo.x : geo.x + geo.width;
      const facing = edge === 'w' ? other.x + other.width : other.x;
      if (Math.abs(facing - line) > TOUCH_EPSILON) continue;
      const start = Math.max(geo.y, other.y) - geo.y;
      const end = Math.min(geo.y + geo.height, other.y + other.height) - geo.y;
      if (end - start > TOUCH_EPSILON) shared.push({ start, end });
    }
  }

  return mergeIntervals(shared);
}

function containsPoint(intervals: Interval[], distance: number): boolean {
  return intervals.some((interval) => distance >= interval.start && distance <= interval.end);
}

/** Le mur opposé, chez la voisine, de celui-ci. */
const FACING: Record<DoorEdge, DoorEdge> = { n: 's', s: 'n', w: 'e', e: 'w' };

/**
 * Les ouvertures percées par les VOISINES dans ce mur.
 *
 * Une porte n'appartient qu'à une pièce, mais deux pièces accolées tracent
 * chacune le mur commun : sans ce report, la voisine rebouchait l'ouverture
 * que l'autre venait de percer, et une porte sur un mur mitoyen — le cas le
 * plus courant — restait invisible.
 */
function facingDoorGaps(geo: ShapeGeometry, edge: DoorEdge, neighbours: NeighbourRoom[]): Interval[] {
  const gaps: Interval[] = [];
  const horizontal = edge === 'n' || edge === 's';
  const line = edge === 'n' ? geo.y : edge === 's' ? geo.y + geo.height : edge === 'w' ? geo.x : geo.x + geo.width;

  for (const neighbour of neighbours) {
    const other = neighbour.geo;
    const facingLine = horizontal
      ? FACING[edge] === 'n'
        ? other.y
        : other.y + other.height
      : FACING[edge] === 'w'
        ? other.x
        : other.x + other.width;
    if (Math.abs(facingLine - line) > TOUCH_EPSILON) continue;

    // Origine du mur de la voisine, ramenée dans le repère de CE mur : les
    // deux murs sont confondus dans le plan, mais leurs abscisses locales
    // partent de coins différents.
    const offset = horizontal ? other.x - geo.x : other.y - geo.y;

    for (const door of neighbour.doors) {
      if (door.edge !== FACING[edge]) continue;
      const otherLength = horizontal ? other.width : other.height;
      const center = door.position * otherLength + offset;
      gaps.push({ start: center - DOOR_WIDTH / 2, end: center + DOOR_WIDTH / 2 });
    }
  }

  return gaps;
}

/** Découpe une portion de mur à chaque passage façade → cloison. */
function splitByPartitions(run: Interval, partitions: Interval[]): (Interval & { interior: boolean })[] {
  const pieces: (Interval & { interior: boolean })[] = [];
  let cursor = run.start;

  for (const partition of partitions) {
    const start = Math.max(partition.start, cursor);
    const end = Math.min(partition.end, run.end);
    if (end - start <= TOUCH_EPSILON) continue;
    if (start > cursor) pieces.push({ start: cursor, end: start, interior: false });
    pieces.push({ start, end, interior: true });
    cursor = end;
  }

  if (run.end > cursor) pieces.push({ start: cursor, end: run.end, interior: false });
  return pieces;
}

// À quel mur perpendiculaire, et à quelle extrémité de celui-ci, chaque bout
// de mur arrive-t-il ? Sert uniquement à savoir de combien prolonger le trait
// pour fermer proprement le coin (voir segmentBetween).
const CORNERS: Record<DoorEdge, { start: [DoorEdge, 'begin' | 'finish']; end: [DoorEdge, 'begin' | 'finish'] }> = {
  n: { start: ['w', 'begin'], end: ['e', 'begin'] },
  s: { start: ['w', 'finish'], end: ['e', 'finish'] },
  w: { start: ['n', 'begin'], end: ['s', 'begin'] },
  e: { start: ['n', 'finish'], end: ['s', 'finish'] },
};

function cornerOverhang(geo: ShapeGeometry, corner: [DoorEdge, 'begin' | 'finish'], partitions: EdgeIntervals): number {
  const [edge, side] = corner;
  const length = edgeLength(geo, edge);
  // On sonde légèrement À L'INTÉRIEUR du mur perpendiculaire : pile sur le
  // coin, le point appartient aussi bien à ce mur-ci qu'à celui d'à côté.
  const probe = side === 'begin' ? Math.min(1, length / 2) : Math.max(length - 1, length / 2);
  return wallWidth(containsPoint(partitions[edge], probe)) / 2;
}

// Les extrémités qui tombent sur un COIN sont prolongées de la demi-épaisseur
// du mur perpendiculaire : sans ça, quatre segments qui se rejoignent bout à
// bout laissent une encoche carrée à chaque angle de la pièce, et une cloison
// fine prolongée comme une façade dépasserait du coin. Les extrémités qui
// bordent une porte, elles, s'arrêtent net — c'est le tableau de l'ouverture.
function segmentBetween(
  geo: ShapeGeometry,
  edge: DoorEdge,
  from: number,
  to: number,
  length: number,
  partitions: EdgeIntervals,
): Segment {
  const startOverhang = from === 0 ? cornerOverhang(geo, CORNERS[edge].start, partitions) : 0;
  const endOverhang = to === length ? cornerOverhang(geo, CORNERS[edge].end, partitions) : 0;
  const start = pointAlong(geo, edge, from - startOverhang);
  const end = pointAlong(geo, edge, to + endOverhang);
  return { x1: start.x, y1: start.y, x2: end.x, y2: end.y };
}

export function wallSegments(geo: ShapeGeometry, doors: DoorSpan[], neighbours: NeighbourRoom[] = []): WallSegment[] {
  const partitions = {} as EdgeIntervals;
  for (const edge of EDGES) partitions[edge] = partitionIntervals(geo, edge, neighbours);

  const segments: WallSegment[] = [];

  for (const edge of EDGES) {
    const length = edgeLength(geo, edge);

    // Les ouvertures de CE mur, ramenées à des intervalles [début, fin] le
    // long du mur, fusionnées quand elles se chevauchent — deux portes
    // voisines ne doivent pas laisser un moignon de trait entre elles.
    const gaps = mergeIntervals(
      [
        ...doors
          .filter((door) => door.edge === edge)
          .map((door) => {
            const center = door.position * length;
            return { start: center - DOOR_WIDTH / 2, end: center + DOOR_WIDTH / 2 };
          }),
        // Les portes que la voisine a percées dans ce même mur.
        ...facingDoorGaps(geo, edge, neighbours),
      ]
        .map((gap) => ({ start: Math.max(0, gap.start), end: Math.min(length, gap.end) }))
        // Une ouverture reportée par une voisine peut tomber entièrement en
        // dehors de ce mur-ci (murs confondus mais de longueurs différentes).
        .filter((gap) => gap.end > gap.start),
    );

    // Ce qui reste de mur entre les ouvertures…
    const runs: Interval[] = [];
    let cursor = 0;
    for (const gap of gaps) {
      if (gap.start > cursor) runs.push({ start: cursor, end: gap.start });
      cursor = Math.max(cursor, gap.end);
    }
    if (cursor < length) runs.push({ start: cursor, end: length });

    // … puis redécoupé là où le mur passe de façade à cloison.
    for (const run of runs) {
      for (const piece of splitByPartitions(run, partitions[edge])) {
        segments.push({
          ...segmentBetween(geo, edge, piece.start, piece.end, length, partitions),
          interior: piece.interior,
        });
      }
    }
  }

  return segments;
}
