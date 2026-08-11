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
