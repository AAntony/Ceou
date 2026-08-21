import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';
import i18n from '../../lib/i18n';
import { logClientError } from '../../lib/errorLogging';
import { supabase } from '../../lib/supabase/client';
import { useSearchIndex } from '../search/queries';
import { composeAnswer } from './answer';
import { resolveIntent, type AssistantIntent, type AssistantResult } from './resolve';
import { speak, stopSpeaking } from './speak';

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

export type AssistantState = {
  status: AssistantStatus;
  transcript: string;
  answer: string;
  result: AssistantResult | null;
};

const EMPTY: AssistantState = { status: 'idle', transcript: '', answer: '', result: null };

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

  const handleTranscript = useCallback(
    async (transcript: string) => {
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

      setState({ status: 'thinking', transcript: trimmed, answer: '', result: null });

      try {
        const { data, error } = await supabase.functions.invoke<{ intent: AssistantIntent }>('interpret-command', {
          body: { transcript: trimmed },
        });
        if (error) throw error;

        const intent = data?.intent;
        if (!intent) throw new Error('empty_intent');

        const result = resolveIntent(intent, indexRef.current ?? []);
        const answer = composeAnswer(result, (key, options) => i18n.t(key, options ?? {}));

        setState({ status: 'answered', transcript: trimmed, answer, result });
        speak(answer, i18n.language);
      } catch (error) {
        logClientError(error, { source: 'assistant', transcriptLength: trimmed.length });
        setState({ status: 'error', transcript: trimmed, answer: '', result: null });
      }
    },
    [onDirectSearch],
  );

  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript;
    if (transcript) void handleTranscript(transcript);
  });

  useSpeechRecognitionEvent('end', () => {
    // Ne remet à zéro QUE si on écoutait encore : sans ce test, la fin de
    // reconnaissance effacerait la réponse déjà calculée pour une phrase
    // courte traitée dans la foulée.
    setState((current) => (current.status === 'listening' ? EMPTY : current));
  });

  useSpeechRecognitionEvent('error', (event) => {
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
    setState({ status: 'listening', transcript: '', answer: '', result: null });
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
    setState(EMPTY);
  }, []);

  return { ...state, isListening: state.status === 'listening', start, stop, dismiss };
}
