import { useQueryClient } from '@tanstack/react-query';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';
import i18n from '../../lib/i18n';
import { logClientError } from '../../lib/errorLogging';
import { supabase } from '../../lib/supabase/client';
import type { EffectiveHabitationPermission } from '../../types/database';
import { invalidateAfterMove, moveObjet } from '../inventory/queries';
import { useSearchIndex, type SearchIndexEntry } from '../search/queries';
import { canModify } from '../sharing/queries';
import { composeAnswer, composeMoveFailure } from './answer';
import { isAlreadyThere, resolveMove, type MoveDestination } from './move';
import { normalizeIntent, resolveIntent, type AssistantIntent, type AssistantResult } from './resolve';
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

export type AssistantStatus =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'answered'
  | 'error'
  /** Rangement compris, en attente du choix et de l'accord de l'utilisateur. */
  | 'move'
  | 'moving'
  | 'moved';

/** Clé i18n du message d'erreur, sous `assistant.`. */
export type AssistantErrorKey = 'error' | 'error_busy';

/**
 * Un rangement en attente d'accord.
 *
 * Les candidats restent au pluriel jusqu'au bout : quand la dictée est
 * ambiguë, c'est l'utilisateur qui tranche, et le même écran sert alors à
 * choisir ET à confirmer. Un identifiant nul veut dire « pas encore choisi ».
 */
export type MoveDraft = {
  objets: SearchIndexEntry[];
  destinations: MoveDestination[];
  objetId: string | null;
  destinationId: string | null;
};

export type AssistantState = {
  status: AssistantStatus;
  transcript: string;
  answer: string;
  result: AssistantResult | null;
  move: MoveDraft | null;
  errorKey: AssistantErrorKey;
};

const EMPTY: AssistantState = {
  status: 'idle',
  transcript: '',
  answer: '',
  result: null,
  move: null,
  errorKey: 'error',
};

/** Ce que la feuille a sélectionné, ou `null` tant qu'il reste un choix à faire. */
export function draftSelection(draft: MoveDraft): { objet: SearchIndexEntry; destination: MoveDestination } | null {
  const objet = draft.objets.find((entry) => entry.id === draft.objetId);
  const destination = draft.destinations.find((entry) => entry.id === draft.destinationId);
  return objet && destination ? { objet, destination } : null;
}

const tr = (key: string, options?: Record<string, unknown>) => i18n.t(key, options ?? {});

/**
 * Le refus vient-il des droits plutôt que d'une panne ?
 *
 * `move_objet` s'exécute avec les droits de l'appelant : sur une Habitation
 * partagée en consultation, c'est la RLS qui refuse l'écriture. Ça mérite une
 * phrase compréhensible, pas le message d'erreur générique.
 */
function isPermissionError(error: unknown): boolean {
  const failure = error as { code?: string; message?: string } | null;
  if (failure?.code === '42501') return true;
  return typeof failure?.message === 'string' && failure.message.toLowerCase().includes('row-level security');
}

/**
 * Ce que l'assistant énonce en présentant un rangement.
 *
 * Soit la question qui reste à trancher, soit la proposition complète. Elle
 * est dite à voix haute parce que ranger se fait les mains prises : on doit
 * pouvoir savoir ce qui va être écrit sans regarder l'écran.
 */
function movePrompt(draft: MoveDraft): string {
  if (!draft.objetId) return tr('assistant.move.which_object', { n: draft.objets.length });
  if (!draft.destinationId) return tr('assistant.move.which_destination', { n: draft.destinations.length });

  const selection = draftSelection(draft);
  if (!selection) return tr('assistant.move.which_object', { n: draft.objets.length });
  return tr('assistant.move.confirm_question', {
    name: selection.objet.name,
    location: selection.destination.sentence,
  });
}

async function canModifyHabitation(habitationId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('get_effective_habitation_permission', {
    p_habitation_id: habitationId,
  });
  if (error) throw error;
  return canModify(data as EffectiveHabitationPermission | null);
}

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
    const { data, error } = await supabase.functions.invoke<{ intent: Partial<AssistantIntent> }>('interpret-command', {
      body: { transcript },
    });

    if (!error) {
      if (!data?.intent) throw new Error('empty_intent');
      return normalizeIntent(data.intent);
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
  const queryClient = useQueryClient();
  const [state, setState] = useState<AssistantState>(EMPTY);

  // L'index est lu dans un callback d'événement, hors du rendu : un ref évite
  // de recréer les abonnements aux événements de reconnaissance à chaque
  // rafraîchissement de l'index.
  const indexRef = useRef(index);
  indexRef.current = index;

  // Même raison pour l'état : la confirmation d'un rangement est déclenchée
  // par la feuille et lit le brouillon courant sans que le callback ait
  // besoin d'être recréé à chaque choix.
  const stateRef = useRef(state);
  stateRef.current = state;

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

      setState({ status: 'thinking', transcript: trimmed, answer: '', result: null, move: null, errorKey: 'error' });

      try {
        const intent = await requestIntent(trimmed);

        if (intent.action === 'move') {
          const resolution = resolveMove(intent, indexRef.current ?? []);
          if (!isCurrent()) return;

          // Un rangement impossible se présente comme une réponse ordinaire :
          // même feuille, même voix. C'est un renseignement, pas une panne.
          if (resolution.status !== 'ready') {
            const answer = composeMoveFailure(resolution, tr);
            setState({ status: 'answered', transcript: trimmed, answer, result: null, move: null, errorKey: 'error' });
            void speak(answer, i18n.language);
            return;
          }

          const draft: MoveDraft = {
            objets: resolution.objets,
            destinations: resolution.destinations,
            // Un seul candidat = aucune question à poser. La confirmation, elle,
            // reste due dans tous les cas.
            objetId: resolution.objets.length === 1 ? resolution.objets[0].id : null,
            destinationId: resolution.destinations.length === 1 ? resolution.destinations[0].id : null,
          };

          setState({ status: 'move', transcript: trimmed, answer: '', result: null, move: draft, errorKey: 'error' });
          void speak(movePrompt(draft), i18n.language);
          return;
        }

        const result = resolveIntent(intent, indexRef.current ?? []);
        const answer = composeAnswer(result, tr);

        if (!isCurrent()) return;
        setState({ status: 'answered', transcript: trimmed, answer, result, move: null, errorKey: 'error' });
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
          move: null,
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

  // `null` remet le choix en jeu : c'est le « Changer » de l'écran de
  // confirmation, qui évite d'avoir à tout redicter pour un candidat mal
  // sélectionné.
  const chooseObjet = useCallback((objetId: string | null) => {
    setState((current) => (current.move ? { ...current, move: { ...current.move, objetId } } : current));
  }, []);

  const chooseDestination = useCallback((destinationId: string | null) => {
    setState((current) => (current.move ? { ...current, move: { ...current.move, destinationId } } : current));
  }, []);

  /**
   * Applique le rangement — le SEUL endroit de l'assistant qui écrive.
   *
   * Déclenché par un appui explicite, jamais par la voix seule : cette
   * version confirme systématiquement. La reconnaissance vocale se trompe de
   * mot assez souvent pour qu'un inventaire réputé fiable ne puisse pas être
   * modifié sur sa seule foi.
   */
  const confirmMove = useCallback(async () => {
    const { move: draft, transcript } = stateRef.current;
    const selection = draft ? draftSelection(draft) : null;
    if (!draft || !selection) return;
    const { objet, destination } = selection;

    const session = sessionRef.current;
    const settle = (answer: string, status: AssistantStatus, move: MoveDraft | null) => {
      if (sessionRef.current !== session) return;
      setState({ status, transcript, answer, result: null, move, errorKey: 'error' });
      void speak(answer, i18n.language);
    };

    // Déjà au bon endroit : on n'écrit rien. Un déplacement redondant
    // ajouterait à l'historique une ligne racontant un rangement qui n'a pas
    // eu lieu — et cet historique est censé faire foi.
    if (isAlreadyThere(objet, destination)) {
      settle(tr('assistant.move.already_there', { name: objet.name, location: destination.sentence }), 'answered', null);
      return;
    }

    setState({ status: 'moving', transcript, answer: '', result: null, move: draft, errorKey: 'error' });

    try {
      // Droits vérifiés AVANT d'écrire, et des DEUX côtés : ranger, c'est
      // retirer d'un logement et poser dans un autre, qui peuvent être
      // partagés à des niveaux différents. La RLS refuserait de toute façon,
      // mais après coup et avec un message que personne ne comprend.
      const homes = [...new Set([objet.habitation_id, destination.habitationId])];
      for (const home of homes) {
        if (!(await canModifyHabitation(home))) {
          settle(tr('assistant.move.denied'), 'answered', null);
          return;
        }
      }

      await moveObjet(objet.id, { type: destination.type, id: destination.id });
      invalidateAfterMove(queryClient, objet.id);
      settle(tr('assistant.move.done', { name: objet.name, location: destination.sentence }), 'moved', draft);
    } catch (error) {
      const denied = isPermissionError(error);
      if (!denied) logClientError(error, { source: 'assistant.move' });
      // On n'annonce JAMAIS un rangement qu'on n'a pas fait : quelqu'un qui
      // range n'ira pas vérifier dans l'app que ça a bien été enregistré.
      settle(tr(denied ? 'assistant.move.denied' : 'assistant.move.failed'), 'answered', null);
    }
  }, [queryClient]);

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
    setState({ status: 'listening', transcript: '', answer: '', result: null, move: null, errorKey: 'error' });
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

  return {
    ...state,
    isListening: state.status === 'listening',
    start,
    stop,
    dismiss,
    chooseObjet,
    chooseDestination,
    confirmMove,
  };
}
