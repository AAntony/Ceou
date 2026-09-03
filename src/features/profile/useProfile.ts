import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '../../features/auth/SessionProvider';
import { supabase } from '../../lib/supabase/client';
import type { Profile } from '../../types/database';

export function useProfile() {
  const { session } = useSession();
  const userId = session?.user.id;

  return useQuery({
    queryKey: ['profile', userId],
    enabled: !!userId,
    queryFn: async (): Promise<Profile> => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId!).single();
      if (error) throw error;
      return data;
    },
  });
}

// LES DEUX ENVOIS VERS GOOGLE GEMINI, ET LEURS DEUX CONSENTEMENTS.
//
// `ai_photo_consent_at` : les photos du scan multi-objets.
// `ai_assistant_consent_at` : ce qu'on dit à l'assistant vocal, dont le
// transcript part chez le même tiers (voir supabase/functions/
// interpret-command).
//
// DEUX HORODATAGES ET NON UN SEUL : un consentement RGPD vaut pour un
// traitement précis. Accepter d'envoyer une photo de son garage n'est pas
// accepter d'envoyer ce qu'on dit à voix haute chez soi, et on peut vouloir
// de l'une sans l'autre. Tous deux distincts, en outre, de l'acceptation
// générale de la politique de confidentialité (app/privacy-policy.tsx).
//
// Demandés une seule fois — le gating vit là où l'envoi commence
// (AiPhotoScanFlow, HomeDashboard) — et conservés côté PROFIL plutôt que
// sur l'appareil, pour survivre à une réinstallation ou à un changement de
// téléphone, et pour valoir preuve.
export type AiConsentKind = 'ai_photo_consent_at' | 'ai_assistant_consent_at';

export function useSetAiConsent(kind: AiConsentKind) {
  const { session } = useSession();
  const userId = session?.user.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const at = new Date().toISOString();
      // Les deux colonnes écrites en toutes lettres plutôt qu'une clé
      // calculée : `{ [kind]: at }` s'élargit en index de chaînes, que le
      // type généré de la table refuse — et à juste titre, il n'y a que ces
      // deux colonnes-là qu'on ait le droit d'horodater ici.
      const patch = kind === 'ai_photo_consent_at' ? { ai_photo_consent_at: at } : { ai_assistant_consent_at: at };
      const { error } = await supabase.from('profiles').update(patch).eq('id', userId!);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile', userId] }),
  });
}

export function useUpdateProfile() {
  const { session } = useSession();
  const userId = session?.user.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (patch: Partial<Pick<Profile, 'display_name' | 'locale' | 'avatar_url'>>) => {
      const { error } = await supabase.from('profiles').update(patch).eq('id', userId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
    },
  });
}
