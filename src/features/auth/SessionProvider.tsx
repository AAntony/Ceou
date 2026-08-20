import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { supabase } from '../../lib/supabase/client';

type SessionContextValue = {
  session: Session | null;
  isLoading: boolean;
};

const SessionContext = createContext<SessionContextValue>({ session: null, isLoading: true });

export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  return <SessionContext.Provider value={{ session, isLoading }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}

/**
 * Vrai quand la session courante est une session ANONYME — un visiteur entré
 * par code d'invitation, sans compte. Supabase expose `is_anonymous` sur
 * l'utilisateur du jeton ; c'est la source de vérité, pas une supposition
 * tirée de l'absence d'e-mail.
 *
 * Sert uniquement à ADAPTER L'INTERFACE (masquer ce qui n'a pas de sens pour
 * un visiteur). La sécurité, elle, est posée côté serveur : la RLS refuse
 * déjà toute écriture à une session anonyme, indépendamment de ce que
 * l'interface affiche.
 */
export function useIsAnonymous(): boolean {
  const { session } = useSession();
  return session?.user.is_anonymous === true;
}
