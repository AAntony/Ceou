import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { queryClient } from '../../lib/queryClient';
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

  // CHANGEMENT DE COMPTE = CACHE VIDÉ.
  //
  // Les clés de requête ne portent pas l'identité de la personne connectée
  // ('habitations', 'searchIndex'...). Sans ce ménage, le compte suivant
  // affiche l'inventaire du précédent le temps que chaque requête revienne —
  // affichage faux, et données montrées à quelqu'un qui n'y a pas droit.
  //
  // Comparaison sur l'ID et non sur la session : un simple renouvellement de
  // jeton en produit une nouvelle sans que la personne ait changé. Un
  // visiteur qui se crée un compte garde d'ailleurs le même ID (c'est ce qui
  // lui conserve ses accès) — son cache reste donc valide, à raison.
  const previousUserId = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const userId = session?.user.id ?? null;
    if (previousUserId.current !== undefined && previousUserId.current !== userId) queryClient.clear();
    previousUserId.current = userId;
  }, [session]);

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
