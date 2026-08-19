import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { ClientErrorInsert } from '../types/database';
import { supabase } from './supabase/client';

// Forme minimale d'un objet d'erreur exploitable : un `.message` string.
// Volontairement pas `Error` — voir describeError ci-dessous.
type ErrorLike = {
  message: string;
  name?: unknown;
  stack?: unknown;
  code?: unknown;
  details?: unknown;
  hint?: unknown;
};

function isErrorLike(value: unknown): value is ErrorLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    typeof (value as { message: unknown }).message === 'string'
  );
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

// Dernier recours quand l'objet levé n'a même pas de `.message` : String()
// seul donnerait "[object Object]" (= une ligne de log inutilisable), donc
// on tente d'abord une sérialisation JSON.
function stringifyUnknown(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    const json = JSON.stringify(value);
    if (json && json !== '{}') return json;
  } catch {
    // Référence circulaire ou valeur non sérialisable : on retombe plus bas.
  }
  try {
    return String(value);
  } catch {
    // String() lui-même peut lever (objet sans prototype, donc sans
    // toString, ou Symbol.toPrimitive piégé). Sans ce garde-fou l'exception
    // remonterait au catch de logClientError et la ligne serait perdue —
    // exactement le contraire du but de cette fonction.
    return '[valeur non convertible en texte]';
  }
}

// Test par DUCK-TYPING (présence d'un `.message` string), pas par
// `instanceof Error` : confirmé en test réel que l'objet d'erreur renvoyé
// par supabase-js n'est PAS reconnu comme instance d'Error au runtime
// (possiblement une frontière de bundle/realm), alors que `.message` existe
// bel et bien dessus — même constat que dans AddFriendModal.friendlyErrorKey.
// Avec l'ancien `instanceof`, toute PostgrestError arrivait ici en
// "[object Object]" : une ligne dans client_errors, aucune information
// dedans. Les champs de diagnostic propres à PostgREST (code/details/hint)
// sont remontés dans le contexte jsonb plutôt que noyés dans le message,
// pour rester filtrables côté Supabase Studio.
function describeError(error: unknown): {
  message: string;
  stack: string | null;
  extra: Record<string, unknown>;
} {
  if (!isErrorLike(error)) {
    return { message: stringifyUnknown(error), stack: null, extra: {} };
  }

  const extra: Record<string, unknown> = {};
  const name = asString(error.name);
  const code = asString(error.code);
  const details = asString(error.details);
  const hint = asString(error.hint);
  if (name) extra.errorName = name;
  if (code) extra.errorCode = code;
  if (details) extra.errorDetails = details;
  if (hint) extra.errorHint = hint;

  return { message: error.message, stack: asString(error.stack), extra };
}

// Alternative maison à un service tiers type Sentry — pas de nouveau compte
// à créer, pas de module natif (donc aucun rebuild nécessaire pour les
// utilisateurs déjà installés, contrairement au SDK Sentry qui embarque du
// code natif). Écrit dans la table `client_errors` (insert-only côté
// client, lecture réservée au propriétaire du projet via Supabase Studio).
export async function logClientError(error: unknown, context?: Record<string, unknown>): Promise<void> {
  try {
    const { message, stack, extra } = describeError(error);
    const { data: userData } = await supabase.auth.getUser();

    const merged = { ...(context ?? {}), ...extra };

    const row: ClientErrorInsert = {
      user_id: userData.user?.id ?? null,
      message,
      stack,
      context: Object.keys(merged).length > 0 ? (merged as ClientErrorInsert['context']) : null,
      app_version: Constants.expoConfig?.version ?? null,
      git_commit: (Constants.expoConfig?.extra?.gitCommit as string | undefined) ?? null,
      platform: Platform.OS,
    };

    await supabase.from('client_errors').insert(row);
  } catch {
    // Le logging d'erreur ne doit jamais lui-même faire planter l'app.
  }
}
