import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase/client';
import type { EffectiveHabitationPermission } from '../../types/database';

// Résout le niveau de droit courant de l'utilisateur sur une Habitation
// ('owner' | 'proprietaire' | 'modification' | 'consultation' | null) via
// get_effective_habitation_permission() — fonction security definer côté
// serveur, seule source de vérité sur les droits (voir la migration RLS
// sharing_rls.sql). Utilisé partout où l'app doit décider d'afficher ou non
// un bouton d'ajout/édition/suppression, plutôt qu'une logique dupliquée
// par écran.
export function useHabitationPermission(habitationId: string | undefined) {
  return useQuery({
    queryKey: ['habitationPermission', habitationId],
    enabled: !!habitationId,
    queryFn: async (): Promise<EffectiveHabitationPermission | null> => {
      const { data, error } = await supabase.rpc('get_effective_habitation_permission', {
        p_habitation_id: habitationId!,
      });
      if (error) throw error;
      return data as EffectiveHabitationPermission | null;
    },
  });
}

// Petits helpers pour ne pas éparpiller la logique "ce niveau suffit-il ?"
// dans chaque écran — l'ordre owner > proprietaire > modification >
// consultation reflète exactement le modèle de droits du plan Phase 8.
const PERMISSION_RANK: Record<EffectiveHabitationPermission, number> = {
  owner: 3,
  proprietaire: 3,
  modification: 2,
  consultation: 1,
};

export function canModify(permission: EffectiveHabitationPermission | null | undefined): boolean {
  return !!permission && PERMISSION_RANK[permission] >= PERMISSION_RANK.modification;
}

export function canManageSharing(permission: EffectiveHabitationPermission | null | undefined): boolean {
  return permission === 'owner' || permission === 'proprietaire';
}
