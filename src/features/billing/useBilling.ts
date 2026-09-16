import { useQuery } from '@tanstack/react-query';
import { useSession } from '../auth/SessionProvider';
import { snapshot } from './api';
export function useBilling() {
  const {session} = useSession();
  return useQuery({queryKey:['billing',session?.user.id],queryFn:snapshot,
    enabled:!!session && !session.user.is_anonymous,staleTime:30000});
}
