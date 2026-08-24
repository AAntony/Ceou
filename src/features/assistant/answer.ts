import type { MoveResolution } from './move';
import { locationSentence, type AssistantResult } from './resolve';

// Composition de la réponse, À PARTIR DES DONNÉES RÉELLES.
//
// C'est délibérément l'app qui rédige, jamais le modèle. Il n'a vu que la
// phrase de l'utilisateur, pas l'inventaire : le laisser formuler la réponse
// l'exposerait à énoncer — et à faire dire à voix haute — un emplacement
// qu'il aurait imaginé. Ici, chaque mot de la réponse vient de la base.

type Translate = (key: string, options?: Record<string, unknown>) => string;

export function composeAnswer(result: AssistantResult, t: Translate): string {
  const { intent, entries, roomName } = result;

  if (intent.action === 'unknown') return t('assistant.answer.unknown');

  if (intent.action === 'list_room') {
    if (!roomName) return t('assistant.answer.room_unknown', { room: intent.room_query });
    if (entries.length === 0) return t('assistant.answer.room_empty', { room: roomName });
    return t('assistant.answer.room_list', { room: roomName, n: entries.length });
  }

  const query = intent.object_query || intent.room_query;

  if (entries.length === 0) return t('assistant.answer.not_found', { query });

  // Un seul résultat : on donne l'emplacement directement, c'est la réponse
  // complète à « où est X ».
  if (entries.length === 1) {
    return t('assistant.answer.found_one', { name: entries[0].name, location: locationSentence(entries[0]) });
  }

  // Plusieurs résultats AU MÊME ENDROIT : c'est le cas courant du pluriel
  // (« où sont tous les verres » -> six verres dans le même placard). Se
  // contenter d'annoncer « 6 résultats » forcerait l'utilisateur à ouvrir la
  // liste pour apprendre ce qu'une phrase suffit à dire.
  const locations = new Set(entries.map(locationSentence).filter(Boolean));
  if (locations.size === 1) {
    return t('assistant.answer.found_many_here', {
      n: entries.length,
      query,
      location: [...locations][0],
    });
  }

  // Éparpillés : on ne choisit pas à la place de l'utilisateur, on annonce le
  // nombre et le nombre d'endroits, la liste tranche.
  return t('assistant.answer.found_many', { n: entries.length, query, places: locations.size });
}

/**
 * Pourquoi un déplacement n'a PAS eu lieu.
 *
 * Un échec de rangement se présente comme une réponse ordinaire — même
 * feuille, même voix. Ce qui compte est que la phrase dise ce qui manque
 * (« je n'ai pas de tiroir de l'entrée ») et non un « impossible » qui
 * laisserait l'utilisateur sans rien à corriger.
 */
export function composeMoveFailure(resolution: Exclude<MoveResolution, { status: 'ready' }>, t: Translate): string {
  switch (resolution.status) {
    case 'no_object':
      return t('assistant.move.no_object', { query: resolution.query });
    case 'no_destination':
      return t('assistant.move.no_destination', { query: resolution.query });
    case 'room_without_emplacement':
      return t('assistant.move.room_without_emplacement', { room: resolution.roomName });
    case 'scope_unsupported':
      return t('assistant.move.scope_unsupported', { query: resolution.query });
  }
}
