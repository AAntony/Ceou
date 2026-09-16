import { useEffect, useRef } from 'react';
import { useSession } from '../auth/SessionProvider';
import { disconnectStore } from './store';
export function BillingAccountObserver() {
  const {session,isLoading} = useSession();
  const previous = useRef<string | null>(null);
  useEffect(()=>{
    if(isLoading) return;
    const user=session?.user.id ?? null;
    if(previous.current && previous.current!==user) void disconnectStore().catch(()=>{});
    previous.current=user;
  },[session?.user.id,isLoading]);
  return null;
}
