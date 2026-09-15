import { supabase } from '../../lib/supabase/client';
import type { EffectiveHabitationPermission } from '../../types/database';
import { canModify } from '../sharing/queries';

// LES DROITS AVANT UNE ÉCRITURE VOCALE, partagés par les deux assistants.
//
// `move_objet` s'exécute avec les droits de l'appelant : sur un logement
// partagé en consultation, la RLS refuserait de toute façon — mais après coup,
// et avec un message que personne ne comprend. Les deux assistants vérifient
// donc avant, et reconnaissent le refus quand il arrive quand même.

/**
 * Le refus vient-il des droits plutôt que d'une panne ?
 *
 * Ça mérite une phrase compréhensible, pas le message d'erreur générique.
 */
export function isPermissionError(error: unknown): boolean {
  const failure = error as { code?: string; message?: string } | null;
  if (failure?.code === '42501') return true;
  return typeof failure?.message === 'string' && failure.message.toLowerCase().includes('row-level security');
}

export async function canModifyHabitation(habitationId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('get_effective_habitation_permission', {
    p_habitation_id: habitationId,
  });
  if (error) throw error;
  return canModify(data as EffectiveHabitationPermission | null);
}
