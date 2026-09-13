import { useQuery } from '@tanstack/react-query';
import { useSession } from '../../features/auth/SessionProvider';
import { supabase } from '../../lib/supabase/client';

export type SearchKind = 'objet' | 'conteneur' | 'emplacement' | 'piece';

export type SearchIndexEntry = {
  kind: SearchKind;
  id: string;
  name: string;
  photo_url: string | null;
  preset_key: string | null;
  piece_id: string;
  piece_name: string;
  habitation_id: string;
  habitation_name: string;
  parent_label: string | null;
};

// Un seul fetch mis en cache par React Query : la recherche texte et les
// chips de filtre sont ensuite du filtrage 100% client, pas un aller-retour
// réseau par frappe (voir Phase 6 du plan).
export function useSearchIndex() {
  const { session } = useSession();
  return useQuery({
    queryKey: ['searchIndex', session?.user.id],
    enabled: !!session,
    queryFn: async (): Promise<SearchIndexEntry[]> => {
      const { data, error } = await supabase.rpc('search_index');
      if (error) throw error;
      const moving = await supabase.rpc('moving_search_index', {});
      // Rolling deployment: the previous backend may not have the additive RPC yet.
      if (moving.error && moving.error.code !== 'PGRST202' && moving.error.code !== '42883') throw moving.error;
      const combined = new Map<string, SearchIndexEntry>();
      for (const entry of [...data, ...(moving.data ?? [])] as unknown as SearchIndexEntry[]) {
        combined.set(`${entry.kind}-${entry.id}`, entry);
      }
      return [...combined.values()];
    },
  });
}
