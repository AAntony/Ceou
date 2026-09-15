import type { PretEntry } from '../../loans/queries';
import type { SearchIndexEntry } from '../../search/queries';
import { isAlreadyThere, resolveMove, type MoveDestination } from '../move';
import { MIN_SCORE, locationSentence, scoreMatch } from '../resolve';

// CE QUE L'ASSISTANT TEMPS RÉEL A LE DROIT DE FAIRE, ET COMMENT.
//
// Le modèle déclare vouloir un outil (voir supabase/functions/voice-session) ;
// c'est ICI que l'outil s'exécute, sur l'index déjà filtré par la RLS. Les
// règles de l'assistant précédent tiennent toujours, et c'est voulu :
//
//   - LE MODÈLE NE VOIT AUCUN IDENTIFIANT DE BASE. Il reçoit des références de
//     session (« o3 », « d1 ») qui ne valent que dans cette conversation. Il
//     ne peut ni en inventer une qui pointerait ailleurs, ni emporter un
//     identifiant chez Google.
//   - IL NE REÇOIT QUE CE QUE LA RÉPONSE DEMANDE : les objets qui
//     correspondent, pas l'inventaire.
//   - RANGER NE DEVINE JAMAIS. La résolution est celle de move.ts : plusieurs
//     candidats, ou un seul mal reconnu, et l'outil répond « ambiguous » —
//     c'est l'utilisateur qui tranche, à voix haute, et le modèle rappelle
//     l'outil avec les références choisies.
//
// Les écritures (ranger, annuler, vérifier les droits) sont passées en
// paramètre : ce fichier ne dépend ainsi d'aucun module natif, et se teste
// sans téléphone.

const MAX_MATCHES = 8;
const MAX_CONTENTS = 25;
const MAX_LOANS = 15;
// Écart sous lequel deux lieux sont aussi plausibles l'un que l'autre — le même
// que pour ranger (move.ts), pour qu'un lieu ne soit pas « évident » dans un
// outil et « ambigu » dans l'autre.
const TOLERANCE = 15;

export type ToolEffects = {
  canModify: (habitationId: string) => Promise<boolean>;
  move: (objetId: string, destination: { type: MoveDestination['type']; id: string }) => Promise<void>;
  undo: (objetId: string) => Promise<void>;
  isPermissionError: (error: unknown) => boolean;
};

/** Ce que l'écran affiche d'un appel d'outil, à côté de ce que dit la voix. */
export type ToolEvent =
  | { type: 'found'; entries: SearchIndexEntry[] }
  | { type: 'place'; name: string; path: string; count: number }
  | { type: 'moved'; objetName: string; destination: string }
  | { type: 'undone'; objetName: string; location: string }
  | { type: 'loans'; count: number }
  | { type: 'end' };

export type ToolOutcome = { response: Record<string, unknown>; event?: ToolEvent };

type MoveRecord = { objetId: string; objetName: string; from: string };

/**
 * L'état d'une conversation : les références données au modèle, et de quoi
 * annuler. Créé à l'ouverture, jeté à la fermeture — rien n'y survit.
 */
export class ToolSession {
  private readonly byRef = new Map<string, { entry?: SearchIndexEntry; destination?: MoveDestination }>();
  private readonly refById = new Map<string, string>();
  private counter = 0;
  readonly moves: MoveRecord[] = [];

  /** La même chose reçoit toujours la même référence, dans toute la conversation. */
  refForEntry(entry: SearchIndexEntry): string {
    return this.remember(`${entry.kind}:${entry.id}`, { entry });
  }

  refForDestination(destination: MoveDestination): string {
    return this.remember(`${destination.type}:${destination.id}`, { destination });
  }

  entry(ref: string | undefined): SearchIndexEntry | undefined {
    return ref ? this.byRef.get(ref.trim())?.entry : undefined;
  }

  destination(ref: string | undefined): MoveDestination | undefined {
    return ref ? this.byRef.get(ref.trim())?.destination : undefined;
  }

  private remember(key: string, value: { entry?: SearchIndexEntry; destination?: MoveDestination }): string {
    const known = this.refById.get(key);
    if (known) {
      this.byRef.set(known, { ...this.byRef.get(known), ...value });
      return known;
    }
    this.counter += 1;
    const ref = `r${this.counter}`;
    this.refById.set(key, ref);
    this.byRef.set(ref, value);
    return ref;
  }
}

/** Le chemin complet, du logement au contenant, tel qu'il se dit. */
export function spokenPath(entry: SearchIndexEntry): string {
  return [entry.habitation_name, locationSentence(entry)].filter(Boolean).join(', ');
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function activeLoan(loans: PretEntry[], objetId: string): PretEntry | undefined {
  return loans.find((loan) => loan.objetId === objetId && loan.returnedAt === null);
}

function describeObject(session: ToolSession, entry: SearchIndexEntry, loans: PretEntry[]) {
  const loan = activeLoan(loans, entry.id);
  return {
    ref: session.refForEntry(entry),
    name: entry.name,
    location: spokenPath(entry),
    ...(loan ? { loan: loan.direction === 'pret' ? `lent to ${loan.counterpartLabel}` : `borrowed from ${loan.counterpartLabel}` } : {}),
  };
}

function describeDestination(session: ToolSession, destination: MoveDestination) {
  return { ref: session.refForDestination(destination), name: destination.name, location: destination.sentence };
}

export function findObjects(session: ToolSession, index: SearchIndexEntry[], loans: PretEntry[], args: Record<string, unknown>): ToolOutcome {
  const query = text(args.query);
  if (!query) return { response: { status: 'invalid', reason: 'empty query' } };

  const matches = index
    .filter((entry) => entry.kind === 'objet')
    .map((entry) => ({ entry, score: scoreMatch(query, entry.name) }))
    .filter((candidate) => candidate.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .map((candidate) => candidate.entry);

  if (matches.length === 0) return { response: { status: 'not_found', query } };

  const shown = matches.slice(0, MAX_MATCHES);
  return {
    response: { status: 'found', total: matches.length, items: shown.map((entry) => describeObject(session, entry, loans)) },
    event: { type: 'found', entries: shown },
  };
}

/** Ce qu'un lieu contient directement, selon son niveau. */
function contentsOf(place: SearchIndexEntry, index: SearchIndexEntry[]): { objets: SearchIndexEntry[]; boxes: SearchIndexEntry[] } {
  if (place.kind === 'piece') {
    return {
      objets: index.filter((entry) => entry.kind === 'objet' && entry.piece_id === place.id),
      boxes: [],
    };
  }
  // L'index ne porte pas l'identifiant du parent, seulement son NOM — la même
  // limite qu'isAlreadyThere (move.ts). On compare donc le nom du parent DANS
  // la même pièce : deux boîtes homonymes d'une même pièce se confondraient,
  // ce qui ne fausse qu'un inventaire lu à voix haute, jamais une écriture.
  const inside = (entry: SearchIndexEntry) => entry.piece_id === place.piece_id && entry.parent_label === place.name;
  return {
    objets: index.filter((entry) => entry.kind === 'objet' && inside(entry)),
    boxes: place.kind === 'emplacement' ? index.filter((entry) => entry.kind === 'conteneur' && inside(entry)) : [],
  };
}

export function listPlace(session: ToolSession, index: SearchIndexEntry[], args: Record<string, unknown>): ToolOutcome {
  const chosen = session.entry(text(args.place_ref));
  let place = chosen && chosen.kind !== 'objet' ? chosen : undefined;

  if (!place) {
    const query = text(args.place);
    if (!query) return { response: { status: 'invalid', reason: 'empty place' } };

    const candidates = index
      .filter((entry) => entry.kind === 'piece' || entry.kind === 'emplacement' || entry.kind === 'conteneur')
      .map((entry) => ({ entry, score: scoreMatch(query, entry.name) }))
      .filter((candidate) => candidate.score >= MIN_SCORE)
      .sort((a, b) => b.score - a.score);

    if (candidates.length === 0) return { response: { status: 'not_found', place: query } };

    const close = candidates.filter((candidate) => candidate.score >= candidates[0].score - TOLERANCE);
    if (close.length > 1) {
      return {
        response: {
          status: 'ambiguous',
          places: close.slice(0, MAX_MATCHES).map(({ entry }) => ({
            ref: session.refForEntry(entry),
            name: entry.name,
            kind: entry.kind === 'piece' ? 'room' : entry.kind === 'emplacement' ? 'storage' : 'box',
            location: entry.kind === 'piece' ? entry.habitation_name : spokenPath(entry),
          })),
        },
      };
    }
    place = close[0].entry;
  }

  const { objets, boxes } = contentsOf(place, index);
  const path = place.kind === 'piece' ? place.habitation_name : spokenPath(place);
  return {
    response: {
      status: 'found',
      place: { name: place.name, location: path },
      total_items: objets.length,
      items: objets.slice(0, MAX_CONTENTS).map((entry) => entry.name),
      ...(boxes.length ? { boxes: boxes.map((entry) => entry.name) } : {}),
    },
    event: { type: 'place', name: place.name, path, count: objets.length },
  };
}

export async function moveObject(
  session: ToolSession,
  index: SearchIndexEntry[],
  loans: PretEntry[],
  effects: ToolEffects,
  args: Record<string, unknown>,
): Promise<ToolOutcome> {
  const pickedObject = session.entry(text(args.object_ref));
  const pickedDestination = session.destination(text(args.destination_ref));

  const resolution = resolveMove(
    { action: 'move', object_query: text(args.object), room_query: '', destination_query: text(args.destination), scope: 'one' },
    index,
  );

  const objets = pickedObject?.kind === 'objet' ? [pickedObject] : resolution.status === 'ready' ? resolution.objets : [];
  const destinations = pickedDestination ? [pickedDestination] : resolution.status === 'ready' ? resolution.destinations : [];

  if (objets.length === 0) {
    return { response: { status: 'not_found', missing: 'object', query: text(args.object) } };
  }
  if (destinations.length === 0) {
    return {
      response: {
        status: 'not_found',
        missing: 'destination',
        query: text(args.destination),
        ...(resolution.status === 'room_without_emplacement'
          ? { reason: `the room ${resolution.roomName} has no storage to put things in` }
          : {}),
      },
    };
  }

  // ON N'ÉCRIT QUE SUR UNE DÉCISION.
  //
  // Soit la reconnaissance est franche et sans alternative (`confident`, la
  // règle de move.ts). Soit le modèle renvoie une référence : il ne peut la
  // tenir que d'une réponse « ambiguous », qui montre TOUJOURS les deux côtés
  // à l'utilisateur — la référence choisie vaut alors accord, comme un appui à
  // l'écran dans l'assistant précédent.
  const single = objets.length === 1 && destinations.length === 1;
  const confident = resolution.status === 'ready' && resolution.confident;
  if (!single || !(confident || pickedObject || pickedDestination)) {
    return {
      response: {
        status: 'ambiguous',
        objects: objets.map((entry) => describeObject(session, entry, loans)),
        destinations: destinations.map((destination) => describeDestination(session, destination)),
      },
    };
  }

  const objet = objets[0];
  const destination = destinations[0];

  if (isAlreadyThere(objet, destination)) {
    return { response: { status: 'already_there', object: objet.name, location: destination.sentence } };
  }

  try {
    for (const home of new Set([objet.habitation_id, destination.habitationId])) {
      if (!(await effects.canModify(home))) {
        return { response: { status: 'forbidden', reason: 'read-only access to this home' } };
      }
    }
    await effects.move(objet.id, { type: destination.type, id: destination.id });
  } catch (error) {
    return { response: { status: effects.isPermissionError(error) ? 'forbidden' : 'failed' } };
  }

  // L'index n'est pas encore rechargé : l'entrée décrit bien l'endroit
  // d'AVANT, celui où l'annulation doit remettre l'objet.
  session.moves.push({ objetId: objet.id, objetName: objet.name, from: spokenPath(objet) });
  return {
    response: { status: 'moved', object: objet.name, from: spokenPath(objet), to: destination.sentence },
    event: { type: 'moved', objetName: objet.name, destination: destination.label },
  };
}

export async function undoLastMove(session: ToolSession, effects: ToolEffects): Promise<ToolOutcome> {
  const last = session.moves[session.moves.length - 1];
  if (!last) return { response: { status: 'nothing_to_undo' } };
  try {
    await effects.undo(last.objetId);
  } catch {
    // L'annulation reste offerte : l'objet est toujours à son nouvel endroit.
    return { response: { status: 'failed' } };
  }
  session.moves.pop();
  return {
    response: { status: 'undone', object: last.objetName, back_to: last.from },
    event: { type: 'undone', objetName: last.objetName, location: last.from },
  };
}

export function listLoans(loans: PretEntry[], now = Date.now()): ToolOutcome {
  const active = loans.filter((loan) => loan.returnedAt === null);
  const describe = (loan: PretEntry) => ({
    object: loan.objetName,
    direction: loan.direction === 'pret' ? 'lent_to' : 'borrowed_from',
    person: loan.counterpartLabel,
    ...(loan.dueAt ? { due: loan.dueAt.slice(0, 10), overdue: new Date(loan.dueAt).getTime() < now } : {}),
  });
  return {
    response: { status: 'found', total: active.length, loans: active.slice(0, MAX_LOANS).map(describe) },
    event: { type: 'loans', count: active.length },
  };
}

/** Aiguille un appel d'outil. Un nom inconnu répond une erreur plutôt que de faire tomber la session. */
export async function runTool(
  name: string,
  args: Record<string, unknown> | undefined,
  context: { session: ToolSession; index: SearchIndexEntry[]; loans: PretEntry[]; effects: ToolEffects },
): Promise<ToolOutcome> {
  const input = args ?? {};
  switch (name) {
    case 'find_objects':
      return findObjects(context.session, context.index, context.loans, input);
    case 'list_place':
      return listPlace(context.session, context.index, input);
    case 'move_object':
      return moveObject(context.session, context.index, context.loans, context.effects, input);
    case 'undo_last_move':
      return undoLastMove(context.session, context.effects);
    case 'list_loans':
      return listLoans(context.loans);
    case 'end_conversation':
      return { response: { status: 'ok' }, event: { type: 'end' } };
    default:
      return { response: { status: 'invalid', reason: `unknown tool ${name}` } };
  }
}
