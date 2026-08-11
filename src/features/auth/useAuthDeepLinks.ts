import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { supabase } from '../../lib/supabase/client';

/**
 * Handles the `ceou://reset-password?code=...` link sent in the
 * "forgot password" email: exchanges the PKCE code for a session,
 * then routes to the screen where the user picks a new password.
 */
export function useAuthDeepLinks() {
  useEffect(() => {
    const handleUrl = async (url: string | null) => {
      if (!url || !url.includes('reset-password')) return;
      const { queryParams } = Linking.parse(url);
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
