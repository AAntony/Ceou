import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { supabase } from '../../lib/supabase/client';

/**
 * Traite les liens profonds d'authentification :
 *
 * - `ceou://reset-password?code=...` — envoyé par l'e-mail « mot de passe
 *   oublié », via le bouton de la page web. Échange le code PKCE contre une
 *   session, puis mène à l'écran de choix du nouveau mot de passe.
 * - `ceou://invite?code=...` — bouton « Ouvrir dans Ceou » de la page
 *   d'invitation, quand l'app est déjà installée. Ne consomme RIEN ici : on
 *   se contente de router vers l'écran visiteur, qui ouvre la session
 *   anonyme et gère les erreurs (code périmé, épuisé...) avec un vrai
 *   message. Consommer le code dans ce hook n'aurait aucun endroit où
 *   afficher un échec.
 */
export function useAuthDeepLinks() {
  useEffect(() => {
    const handleUrl = async (url: string | null) => {
      if (!url) return;

      const { queryParams } = Linking.parse(url);

      if (url.includes('invite')) {
        const inviteCode = queryParams?.code ?? queryParams?.invite;
        if (typeof inviteCode === 'string' && inviteCode) {
          router.push({ pathname: '/guest-invite', params: { code: inviteCode } });
        }
        return;
      }

      if (!url.includes('reset-password')) return;
      const code = queryParams?.code;
      if (typeof code !== 'string') return;

      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) router.replace('/reset-password');
    };

    Linking.getInitialURL().then(handleUrl);
    const subscription = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => subscription.remove();
  }, []);
}
