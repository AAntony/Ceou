import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';
import i18n from '../../lib/i18n';
import { logClientError } from '../../lib/errorLogging';
import { supabase } from '../../lib/supabase/client';
import { useSearchIndex } from '../search/queries';
import { composeAnswer } from './answer';
import { resolveIntent, type AssistantIntent, type AssistantResult } from './resolve';
import { primeVoices, speak, stopSpeaking } from './speak';

const LOCALE_BY_LANGUAGE: Record<string, string> = {
  fr: 'fr-FR',
  en: 'en-US',
};

// Codes qu'un utilisateur déclenche sans que ce soit une panne (silence,
// nouvel appui sur le micro) — même liste que la recherche vocale.
const SILENT_ERROR_CODES = new Set(['no-speech', 'aborted', 'speech-timeout']);

// En dessous de ce nombre de mots, on considère que l'utilisateur DICTE un
// terme de recherche plutôt qu'il ne POSE une question, et on court-circuite
// l'IA : « tournevis » n'a rien à faire dans un appel réseau facturé, alors
// que « où sont mes clés » en a besoin. Économise le quota Gemini, qui est
// partagé entre tous les utilisateurs (voir detect-objects).
const DIRECT_SEARCH_MAX_WORDS = 2;

export type AssistantStatus = 'idle' | 'listening' | 'thinking' | 'answered' | 'error';

/** Clé i18n du message d'erreur, sous `assistant.`. */
export type AssistantErrorKey = 'error' | 'error_busy';

export type AssistantState = {
  status: AssistantStatus;
  transcript: string;
  answer: string;
  result: AssistantResult | null;
  errorKey: AssistantErrorKey;
};

const EMPTY: AssistantState = { status: 'idle', transcript: '', answer: '', result: null, errorKey: 'error' };

type InvokeErrorContext = { status?: number; json?: () => Promise<unknown> };

/**
 * Délai à respecter si l'erreur est une limitation de débit, sinon `null`.
 *
 * `functions.invoke` enveloppe la réponse HTTP dans `error.context` : le
 * corps JSON (donc `retryAfterSeconds`) n'est lisible que par là.
 */
async function rateLimitDelaySeconds(error: unknown): Promise<number | null> {
  const context = (error as { context?: InvokeErrorContext } | null)?.context;
  if (!context || context.status !== 429) return null;
  try {
    const body = (await context.json?.()) as { retryAfterSeconds?: number } | undefined;
    const seconds = Number(body?.retryAfterSeconds);
    return Number.isFinite(seconds) && seconds > 0 ? seconds : 3;
  } catch {
    return 3;
  }
}

class RateLimitedError extends Error {}

/**
 * Interroge l'IA, avec UNE seule reprise en cas de limitation de débit.
 *
 * La limite serveur est de quelques secondes entre deux questions. Deux
 * questions d'affilée sont un usage parfaitement normal (« et mes lunettes
 * ? ») : attendre puis réessayer une fois est bien meilleur que d'afficher
 * une erreur pour un délai que l'app connaît déjà.
 */
async function requestIntent(transcript: string): Promise<AssistantIntent> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await supabase.functions.invoke<{ intent: AssistantIntent }>('interpret-command', {
      body: { transcript },
    });

    if (!error) {
      if (!data?.intent) throw new Error('empty_intent');
      return data.intent;
    }

    const delay = attempt === 0 ? await rateLimitDelaySeconds(error) : null;
    if (delay === null) throw error;
    await new Promise((resolve) => setTimeout(resolve, delay * 1000));
  }

  throw new RateLimitedError('rate_limited');
}

/**
 * Assistant vocal : micro -> texte -> intention -> résultats réels -> réponse.
 *
 * `onDirectSearch` reçoit les dictées courtes, qui restent une simple
 * recherche texte sans passer par l'IA.
 */
export function useAssistant(onDirectSearch: (text: string) => void) {
  const { data: index } = useSearchIndex();
  const [state, setState] = useState<AssistantState>(EMPTY);

  // L'index est lu dans un callback d'événement, hors du rendu : un ref évite
  // de recréer les abonnements aux événements de reconnaissance à chaque
  // rafraîchissement de l'index.
  const indexRef = useRef(index);
  indexRef.current = index;

  // ⚠️ UNE SEULE QUESTION PAR APPUI SUR LE MICRO. Bug réel corrigé ici
  // (retour utilisateur du 2026-08-21 : « plusieurs popups se superposent,
  // comme si chaque mot déclenchait une popup », avec de nombreux « je n'ai
  // pas pu traiter ta demande »). La reconnaissance émet PLUSIEURS
  // événements `result` pour une même phrase — y compris avec
  // `interimResults: false`, que tous les moteurs Android ne respectent pas.
  // Chaque événement déclenchait un appel IA : la feuille se rouvrait à
  // chaque mot, et l'appel suivant tombait mécaniquement sur la limite de
  // débit de 3 s côté serveur, transformant une phrase parfaitement comprise
  // en message d'erreur.
  //
  // On ne traite donc RIEN pendant l'écoute : on retient la dernière
  // transcription reçue (la plus complète) et on ne l'envoie qu'une fois la
  // reconnaissance terminée, une seule fois par session.

  // Jeton de session : incrémenté à chaque nouvel appui sur le micro et à
  // chaque fermeture. Une réponse qui arrive après coup est ignorée plutôt
  // que de rouvrir la feuille que l'utilisateur vient de fermer.
  const sessionRef = useRef(0);
  const pendingRef = useRef('');
  const handledRef = useRef(true);
  const listeningRef = useRef(false);

  const handleTranscript = useCallback(
    async (transcript: string) => {
      const session = sessionRef.current;
      const isCurrent = () => sessionRef.current === session;
      const trimmed = transcript.trim();
      if (!trimmed) {
        setState(EMPTY);
        return;
      }

      if (trimmed.split(/\s+/).length <= DIRECT_SEARCH_MAX_WORDS) {
        onDirectSearch(trimmed);
        setState(EMPTY);
        return;
      }

      setState({ status: 'thinking', transcript: trimmed, answer: '', result: null, errorKey: 'error' });

      try {
        const intent = await requestIntent(trimmed);
        const result = resolveIntent(intent, indexRef.current ?? []);
        const answer = composeAnswer(result, (key, options) => i18n.t(key, options ?? {}));

        if (!isCurrent()) return;
        setState({ status: 'answered', transcript: trimmed, answer, result, errorKey: 'error' });
        void speak(answer, i18n.language);
      } catch (error) {
        const busy = error instanceof RateLimitedError;
        // Une limitation de débit n'est pas une panne : inutile d'encombrer
        // le journal d'erreurs avec un utilisateur qui parle vite.
        if (!busy) logClientError(error, { source: 'assistant', transcriptLength: trimmed.length });
        if (!isCurrent()) return;
        setState({
          status: 'error',
          transcript: trimmed,
          answer: '',
          result: null,
          errorKey: busy ? 'error_busy' : 'error',
        });
      }
    },
    [onDirectSearch],
  );

  /** Envoie la phrase retenue, au plus une fois par session d'écoute. */
  const consumePending = useCallback(() => {
    if (handledRef.current) return;
    handledRef.current = true;
    const transcript = pendingRef.current;
    pendingRef.current = '';
    void handleTranscript(transcript);
  }, [handleTranscript]);

  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript?.trim();
    // On garde la dernière transcription non vide : sur les moteurs qui
    // émettent des résultats partiels malgré tout, c'est la plus complète.
    if (transcript) pendingRef.current = transcript;
    // Filet de sécurité si `end` est déjà passé — l'ordre des deux
    // événements n'est pas garanti d'un moteur à l'autre.
    if (event.isFinal && !listeningRef.current) consumePending();
  });

  useSpeechRecognitionEvent('end', () => {
    if (!listeningRef.current) return;
    listeningRef.current = false;
    consumePending();
  });

  useSpeechRecognitionEvent('error', (event) => {
    listeningRef.current = false;
    handledRef.current = true;
    pendingRef.current = '';
    setState((current) => (current.status === 'listening' ? EMPTY : current));
    if (!SILENT_ERROR_CODES.has(event.error)) {
      Alert.alert(i18n.t('home.voice_search_error'));
    }
  });

  const start = useCallback(async () => {
    stopSpeaking();
    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) {
      Alert.alert(i18n.t('home.voice_search_permission_message'));
      return;
    }
    // Pendant que l'utilisateur parle, on fait chauffer la liste des voix :
    // l'énumération coûte un instant qui s'entendrait juste avant la réponse.
    primeVoices(i18n.language);
    sessionRef.current += 1;
    pendingRef.current = '';
    handledRef.current = false;
    listeningRef.current = true;
    setState({ status: 'listening', transcript: '', answer: '', result: null, errorKey: 'error' });
    ExpoSpeechRecognitionModule.start({
      lang: LOCALE_BY_LANGUAGE[i18n.language] ?? 'fr-FR',
      // Pas de résultats intermédiaires, contrairement à la recherche vocale :
      // ici on n'exploite que la phrase FINALE, et un résultat partiel
      // déclencherait un appel IA sur une phrase tronquée.
      interimResults: false,
      continuous: false,
    });
  }, []);

  const stop = useCallback(() => ExpoSpeechRecognitionModule.stop(), []);

  const dismiss = useCallback(() => {
    stopSpeaking();
    // Fermer la feuille annule aussi une phrase encore en vol : sans ça, une
    // réponse arriverait par-dessus l'écran que l'utilisateur vient de
    // quitter.
    sessionRef.current += 1;
    handledRef.current = true;
    pendingRef.current = '';
    setState(EMPTY);
  }, []);

  return { ...state, isListening: state.status === 'listening', start, stop, dismiss };
}
