import type { DoorEdge, ShapeGeometry } from './types';
import { edgeLength, sharedInterval, TOUCH_EPSILON, type Interval } from './walls';

// LE PLAN, MAIS EN PHRASES.
//
// Le plan est dessiné sur un canevas Skia : un lecteur d'écran n'y trouve
// rien, et il n'y a pas une seule cible tactile là-dedans — tout se joue au
// pincement et au glissé. Pour qui ne voit pas l'écran, ou ne peut pas faire
// ces gestes-là, la fonctionnalité n'existait tout simplement pas.
//
// Ce module ne dessine rien : il extrait du dessin ce qu'on y LIT d'un coup
// d'œil, et qui n'est écrit nulle part ailleurs dans l'app.
//
// CE QUI EST PROPRE AU PLAN, ET DONC CE QU'IL FAUT DIRE :
//
//  1. QUELLES PIÈCES SONT SUR CE NIVEAU. La liste des Pièces d'une habitation
//     ne le sait pas : elle les donne toutes, tous étages confondus, et
//     ignore celles qui n'ont jamais été dessinées.
//  2. OÙ ELLES SONT sur la feuille — « en haut à gauche ».
//  3. COMMENT ON CIRCULE : quelles pièces se touchent, et lesquelles une
//     porte relie vraiment. C'est la seule information que le plan apporte et
//     qu'aucun autre écran ne porte.
//
// Le reste (ce que contient une pièce) est déjà rendu par PlanRoomSheet, que
// la liste ouvre au même endroit que le canevas.

/** Les neuf cases de la feuille, dans le repère de l'écran — « n » est en haut. */
export type OutlineZone = 'nw' | 'n' | 'ne' | 'w' | 'c' | 'e' | 'sw' | 's' | 'se';

export type OutlineForme = ShapeGeometry & { id: string; pieceId: string | null };
export type OutlineDoor = { formeId: string; edge: DoorEdge; position: number };

export type OutlineRoom = {
  id: string;
  pieceId: string | null;
  /** `null` quand le plan n'a qu'une pièce : « au centre » ne situe rien. */
  zone: OutlineZone | null;
  /** Les pièces qu'une porte relie à celle-ci, en ordre de lecture. */
  connected: string[];
  /** Les pièces mitoyennes qu'aucune porte ne relie, en ordre de lecture. */
  adjacent: string[];
  /** Ses portes qui ne donnent sur aucune voisine — donc sur l'extérieur. */
  outside: number;
};

const EDGES: DoorEdge[] = ['n', 'e', 's', 'w'];

/**
 * L'ORDRE DE LECTURE : de haut en bas, et de gauche à droite à l'intérieur
 * d'une même rangée. C'est l'ordre dans lequel on parcourt un plan des yeux,
 * et donc celui dans lequel la liste doit se lire.
 *
 * Les rangées se DÉDUISENT plutôt que de se calculer sur une grille : deux
 * pièces appartiennent à la même rangée dès qu'elles se recouvrent
 * verticalement, ne serait-ce qu'un peu. Découper la feuille en bandes de
 * hauteur fixe aurait séparé deux pièces voisines pour quelques unités
 * d'écart, ce qu'aucun œil ne fait.
 */
function readingOrder(formes: OutlineForme[]): OutlineForme[] {
  const byTop = [...formes].sort((a, b) => a.y - b.y || a.x - b.x);
  const ordered: OutlineForme[] = [];
  let row: OutlineForme[] = [];
  let rowBottom = -Infinity;

  const flush = () => {
    ordered.push(...row.sort((a, b) => a.x - b.x || a.y - b.y));
    row = [];
    rowBottom = -Infinity;
  };

  for (const forme of byTop) {
    // La pièce commence sous TOUT ce qui précède : plus aucun recouvrement,
    // donc une nouvelle rangée. La tolérance est celle des murs mitoyens —
    // deux pièces empilées se touchent à l'unité près.
    if (row.length > 0 && forme.y >= rowBottom - TOUCH_EPSILON) flush();
    row.push(forme);
    rowBottom = Math.max(rowBottom, forme.y + forme.height);
  }
  if (row.length > 0) flush();

  return ordered;
}

/**
 * En tiers, et RELATIVEMENT AUX PIÈCES DESSINÉES, jamais à la feuille.
 *
 * La feuille fait 1200 × 1200 et un logement en occupe rarement le quart :
 * situé dans son repère, tout serait « au centre ». C'est l'emprise du
 * logement qui sert de cadre — la même que celle du bouton « Tout revoir ».
 */
function bandOf(center: number, min: number, span: number): -1 | 0 | 1 {
  if (span <= 0) return 0;
  const ratio = (center - min) / span;
  if (ratio < 1 / 3) return -1;
  if (ratio > 2 / 3) return 1;
  return 0;
}

const ZONES: Record<string, OutlineZone> = {
  '-1,-1': 'nw',
  '-1,0': 'n',
  '-1,1': 'ne',
  '0,-1': 'w',
  '0,0': 'c',
  '0,1': 'e',
  '1,-1': 'sw',
  '1,0': 's',
  '1,1': 'se',
};

export function planOutline(formes: OutlineForme[], doors: OutlineDoor[]): OutlineRoom[] {
  const ordered = readingOrder(formes);
  if (ordered.length === 0) return [];

  const minX = Math.min(...ordered.map((f) => f.x));
  const minY = Math.min(...ordered.map((f) => f.y));
  const spanX = Math.max(...ordered.map((f) => f.x + f.width)) - minX;
  const spanY = Math.max(...ordered.map((f) => f.y + f.height)) - minY;

  // Les mitoyennetés, mur par mur et voisine par voisine : c'est cette
  // dernière précision qui permettra de rattacher chaque porte à la pièce
  // qu'elle dessert.
  const touching = new Map<string, { other: string; edge: DoorEdge; span: Interval }[]>();
  for (const forme of ordered) {
    const walls: { other: string; edge: DoorEdge; span: Interval }[] = [];
    for (const other of ordered) {
      if (other.id === forme.id) continue;
      for (const edge of EDGES) {
        const span = sharedInterval(forme, edge, other);
        if (span) walls.push({ other: other.id, edge, span });
      }
    }
    touching.set(forme.id, walls);
  }

  // UNE PORTE N'APPARTIENT QU'À UNE PIÈCE, MAIS ELLE EN RELIE DEUX. Elle est
  // enregistrée sur une forme et un mur ; si son milieu tombe sur le pan
  // partagé avec une voisine, le passage vaut dans les deux sens et les deux
  // pièces doivent l'annoncer. Sinon, ce mur ne sépare de rien de dessiné :
  // la porte donne dehors.
  const connected = new Map<string, Set<string>>(ordered.map((f) => [f.id, new Set<string>()]));
  const outside = new Map<string, number>(ordered.map((f) => [f.id, 0]));

  for (const door of doors) {
    const owner = ordered.find((f) => f.id === door.formeId);
    if (!owner) continue;
    const distance = door.position * edgeLength(owner, door.edge);
    const through = (touching.get(owner.id) ?? []).find(
      (wall) => wall.edge === door.edge && distance >= wall.span.start && distance <= wall.span.end,
    );
    if (!through) {
      outside.set(owner.id, (outside.get(owner.id) ?? 0) + 1);
      continue;
    }
    connected.get(owner.id)?.add(through.other);
    connected.get(through.other)?.add(owner.id);
  }

  const rank = new Map(ordered.map((forme, index) => [forme.id, index]));
  const inOrder = (ids: Iterable<string>) => [...new Set(ids)].sort((a, b) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0));

  return ordered.map((forme) => {
    const doorways = connected.get(forme.id) ?? new Set<string>();
    return {
      id: forme.id,
      pieceId: forme.pieceId,
      zone:
        ordered.length < 2
          ? null
          : ZONES[
              `${bandOf(forme.y + forme.height / 2, minY, spanY)},${bandOf(forme.x + forme.width / 2, minX, spanX)}`
            ],
      connected: inOrder(doorways),
      // Mitoyenne SANS porte : dire les deux serait redondant, et c'est
      // justement la distinction qui compte — d'un côté on passe, de l'autre
      // il n'y a qu'un mur commun.
      adjacent: inOrder((touching.get(forme.id) ?? []).map((wall) => wall.other).filter((id) => !doorways.has(id))),
      outside: outside.get(forme.id) ?? 0,
    };
  });
}
