import { onlineManager, useMutation, useQuery } from '@tanstack/react-query';
import { useRef } from 'react';
import { createCommandGuard } from './commandGuard';
import { supabase } from '../../lib/supabase/client';
import { useSession } from '../auth/SessionProvider';
import type { Json } from '../../types/supabase';
import type { MovingProject, MovingSnapshot } from './model';

export function useMovingProjects() {
  const { session } = useSession();
  return useQuery({ queryKey: ['movingProjects',session?.user.id], enabled: !!session,
    queryFn: async () => { const {data,error}=await supabase.rpc('moving_read',{}); if(error) throw error; return data as unknown as MovingProject[]; } });
}
export function useMovingSnapshot(id: string) {
  const { session } = useSession();
  return useQuery({ queryKey: ['movingSnapshot',session?.user.id,id], enabled: !!session && !!id,
    queryFn: async () => { const {data,error}=await supabase.rpc('moving_read',{p_project_id:id}); if(error) throw error; return data as unknown as MovingSnapshot; } });
}
export function useMovingCommand() {
  const guard = useRef(createCommandGuard()).current;
  const mutation = useMutation({
    // Online transactional operations: no optimistic claim that a partial lot succeeded.
    networkMode: 'always', retry: false,
    mutationFn: async ({action,payload}:{action:string;payload:Record<string,Json|undefined>}) => {
      const {data,error}=await supabase.rpc('moving_command',{p_action:action,p_payload:payload});
      if(error) throw error; return data as {id:string};
    },
    // The shared MutationCache invalidates inventory/search/moving queries on success.
  });
  return {
    ...mutation,
    mutateAsync: (...args: Parameters<typeof mutation.mutateAsync>) =>
      guard(() => onlineManager.isOnline(), () => mutation.mutateAsync(...args)),
  };
}
