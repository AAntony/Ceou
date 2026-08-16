import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { ClientErrorInsert } from '../types/database';
import { supabase } from './supabase/client';

// Alternative maison à un service tiers type Sentry — pas de nouveau compte
// à créer, pas de module natif (donc aucun rebuild nécessaire pour les
// utilisateurs déjà installés, contrairement au SDK Sentry qui embarque du
// code natif). Écrit dans la table `client_errors` (insert-only côté
// client, lecture réservée au propriétaire du projet via Supabase Studio).
export async function logClientError(error: unknown, context?: Record<string, unknown>): Promise<void> {
  try {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? (error.stack ?? null) : null;
    const { data: userData } = await supabase.auth.getUser();

    const row: ClientErrorInsert = {
      user_id: userData.user?.id ?? null,
      message,
      stack,
      context: context ? (context as ClientErrorInsert['context']) : null,
      app_version: Constants.expoConfig?.version ?? null,
      git_commit: (Constants.expoConfig?.extra?.gitCommit as string | undefined) ?? null,
      platform: Platform.OS,
    };

    await supabase.from('client_errors').insert(row);
  } catch {
    // Le logging d'erreur ne doit jamais lui-même faire planter l'app.
  }
}
