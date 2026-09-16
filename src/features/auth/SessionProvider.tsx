import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { clearPersistedCache } from '../../lib/queryClient';
import { supabase } from '../../lib/supabase/client';
import { logClientError } from '../../lib/errorLogging';
import { observeSession } from './sessionLifecycle';

type SessionContextValue = {
  session: Session | null;
  isLoading: boolean;
};

const SessionContext = createContext<SessionContextValue>({ session: null, isLoading: true });

export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => observeSession<Session>({
    read: async () => (await supabase.auth.getSession()).data.session,
    subscribe: (receive) => {
      const { data } = supabase.auth.onAuthStateChange(receive);
      return () => data.subscription.unsubscribe();
    },
    publish: setSession,
    ready: () => setIsLoading(false),
    signedOut: () => { void clearPersistedCache().catch((error) => logClientError(error, { source: 'auth.cache_cleanup' })); },
  }), []);

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
  //
  // LE DISQUE AUSSI, DEPUIS QUE LE CACHE Y SURVIT. Vider la seule mémoire ne
  // suffisait plus : le cache persisté serait relu au prochain démarrage et
  // rendrait à la personne suivante l'inventaire de la précédente — et sans
  // réseau, sans même le rafraîchissement qui finissait par le corriger.
  const previousUserId = useRef<string | null>(null);
  useEffect(() => {
    const previous = previousUserId.current;
    const userId = session?.user.id ?? null;
    previousUserId.current = userId;
    if (shouldClearForUserChange(previous, userId)) {
      void clearPersistedCache().catch((error) => logClientError(error, { source: 'auth.cache_cleanup' }));
    }
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

/**
 * Faut-il vider le cache en passant de `previous` à `next` ?
 *
 * FONCTION PURE ET EXPORTÉE PARCE QU'ELLE A DÉJÀ EU TORT. Dans sa première
 * version elle vivait en ligne dans l'effet et se contentait de comparer les
 * deux valeurs : « différentes, donc changement de compte ». C'était faux au
 * démarrage. Une application démarre TOUJOURS avec `null` — la session est
 * relue du stockage chiffré de façon asynchrone — puis reçoit son utilisateur
 * une fraction de seconde plus tard. Cette transition-là était donc lue comme
 * un changement de compte, et le cache relu du disque était détruit à chaque
 * lancement, quelques centaines de millisecondes après avoir été restauré.
 *
 * Les trois cas qui ne doivent RIEN vider :
 *
 *   - `null -> utilisateur` : le démarrage normal. C'est le bug ci-dessus.
 *   - `utilisateur -> null` : un renouvellement de jeton qui échoue faute de
 *     réseau produit exactement ça. Effacer le cache ici reviendrait à le
 *     détruire au moment précis où il est utile. Une VRAIE déconnexion, elle,
 *     est traitée à part, sur l'événement `SIGNED_OUT`.
 *   - `utilisateur -> le même` : un simple renouvellement de jeton.
 *
 * Reste le seul cas qui compte : un compte remplacé par un AUTRE compte.
 */
export function shouldClearForUserChange(previous: string | null, next: string | null): boolean {
  return previous !== null && next !== null && previous !== next;
}
