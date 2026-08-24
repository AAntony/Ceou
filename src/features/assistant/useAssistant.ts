import { useQueryClient } from '@tanstack/react-query';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import i18n from '../../lib/i18n';
import { logClientError } from '../../lib/errorLogging';
import { supabase } from '../../lib/supabase/client';
import type { EffectiveHabitationPermission } from '../../types/database';
import { invalidateAfterMove, moveObjet, undoLastMove } from '../inventory/queries';
import { useSearchIndex, type SearchIndexEntry } from '../search/queries';
import { canModify } from '../sharing/queries';
import { composeAnswer, composeMoveFailure } from './answer';
import { isAlreadyThere, resolveMove, type MoveDestination } from './move';
import { parseMove, splitClosing } from './phrase';
import { locationSentence, normalizeIntent, resolveIntent, type AssistantIntent, type AssistantResult } from './resolve';
import { primeVoices, speak, stopSpeaking } from './speak';

// L'ASSISTANT EST UNE SESSION, PAS UNE QUESTION.
//
// Un appui ouvre le micro et le laisse ouvert. On enchaîne les phrases, les
// ordres s'exécutent sans confirmation dès qu'ils ne prêtent à aucune
// confusion, et l'on dit « merci » pour clore.
//
// C'est le troisième état de ce fichier, et il vient de deux constats
// d'usage : le micro qui s'ouvrait à chaque phrase perdait le début de
// celle-ci, et chaque rangement demandait un appui alors qu'on range
// justement les mains prises. Les deux disparaissent en cessant de traiter
// une demande vocale comme un aller-retour.

const LOCALE_BY_LANGUAGE: Record<string, string> = {
  fr: 'fr-FR',
  en: 'en-US',
};

// Codes qu'un utilisateur déclenche sans que ce soit une panne — un silence
// entre deux objets est même l'état le plus courant d'une session.
const SILENT_ERROR_CODES = new Set(['no-speech', 'aborted', 'speech-timeout']);

// En dessous de ce nombre de mots, on considère que l'utilisateur DICTE un
// nom d'objet plutôt qu'il ne formule une demande. On répond alors sans
// passer par l'IA : « tournevis » n'a rien à faire dans un appel réseau
// facturé, et le quota Gemini est partagé entre tous les utilisateurs.
const SHORT_QUERY_MAX_WORDS = 2;

// Silence après lequel on considère qu'une phrase est terminée, quand le
// moteur ne le dit pas lui-même. Chaque centaine de millisecondes ici se
// ressent directement comme de la lenteur, puisqu'elle s'ajoute au délai que
// le moteur s'accorde déjà avant de rendre son verdict.
const PHRASE_PAUSE = 600;

// Ce que le moteur Android s'accorde AVANT de considérer qu'on a fini de
// parler. Ses valeurs par défaut sont taillées pour la dictée d'un texte
// long, pas pour un ordre de six mots enchaîné à un autre.
const ANDROID_SILENCE = {
  EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 900,
  EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 700,
};

// Le moteur s'arrête de lui-même après chaque silence : on le relance, et
// c'est ce qui donne l'impression d'un micro qui reste ouvert. Au bout de
// tant de relances SANS la moindre phrase, la session s'arrête d'elle-même —
// quelques minutes de silence veulent dire qu'on a reposé le téléphone, et un
// micro qui écoute indéfiniment n'est ni souhaitable ni honnête.
const MAX_SILENT_RESTARTS = 40;
const RESTART_DELAY = 120;

// Deux `result` identiques rapprochés viennent du moteur, pas de
// l'utilisateur. Passé ce délai, répéter la même phrase est un acte
// volontaire et doit être exécuté.
const REPEAT_GUARD = 2500;

// La permission ne se redemande qu'une fois. C'est le principal responsable
// du micro qui s'ouvrait en retard : un aller-retour natif attendu à chaque
// appui, alors que la réponse ne change plus après le premier accord.
let microphoneGranted = false;

export type AssistantStatus =
  | 'idle'
  /** Appui reçu, le moteur n'a pas encore la parole : ne parle pas tout de suite. */
  | 'starting'
  | 'listening'
  | 'thinking'
  | 'moving'
  /** Une ambiguïté attend une réponse à l'écran. */
  | 'choosing';

/** Clé i18n du message d'erreur, sous `assistant.`. */
export type AssistantErrorKey = 'error' | 'error_busy';

/**
 * Un rangement dont il reste quelque chose à trancher.
 *
 * Les candidats restent au pluriel jusqu'au bout : quand la dictée est
 * ambiguë, c'est l'utilisateur qui choisit, et son choix VAUT accord — il n'y
 * a pas de confirmation par-dessus. Un identifiant nul veut dire « pas encore
 * choisi ».
 */
export type MoveDraft = {
  objets: SearchIndexEntry[];
  destinations: MoveDestination[];
  objetId: string | null;
  destinationId: string | null;
};

/**
 * De quoi revenir en arrière sur le dernier rangement écrit.
 *
 * C'est la contrepartie de l'exécution sans confirmation : ce qui protège
 * d'un mot mal entendu n'est pas une question posée avant, c'est un retour en
 * arrière offert après.
 */
export type MoveUndo = {
  objetId: string;
  objetName: string;
  /** D'où il vient, sous la forme qui se lit à voix haute. */
  fromLabel: string;
};

/** Une ligne du relevé de session. */
export type SessionEntry = { objetName: string; location: string };

export type AssistantState = {
  status: AssistantStatus;
  /** Une session est en cours : le micro lui appartient, la feuille est ouverte. */
  active: boolean;
  transcript: string;
  answer: string;
  result: AssistantResult | null;
  move: MoveDraft | null;
  undo: MoveUndo | null;
  entries: SessionEntry[];
  errorKey: AssistantErrorKey;
};

const EMPTY: AssistantState = {
  status: 'idle',
  active: false,
  transcript: '',
  answer: '',
  result: null,
  move: null,
  undo: null,
  entries: [],
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
 * La limite serveur est de quelques secondes entre deux demandes. En session
 * on enchaîne les phrases, donc on la rencontre : attendre puis réessayer une
 * fois vaut mieux qu'une erreur pour un délai que l'app connaît déjà.
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

/** Assistant vocal : un appui, une session, autant de phrases qu'on veut. */
export function useAssistant() {
  const { data: index } = useSearchIndex();
  const queryClient = useQueryClient();
  const [state, setState] = useState<AssistantState>(EMPTY);

  // L'index et l'état sont lus dans des callbacks d'événement, hors du
  // rendu : les refs évitent de recréer les abonnements à chaque
  // rafraîchissement.
  const indexRef = useRef(index);
  indexRef.current = index;
  const stateRef = useRef(state);
  stateRef.current = state;

  // Jeton de session : incrémenté à chaque ouverture et à chaque fermeture.
  // Une réponse qui arrive après coup est ignorée plutôt que de rouvrir la
  // feuille que l'utilisateur vient de fermer.
  const sessionRef = useRef(0);
  const activeRef = useRef(false);
  const listeningRef = useRef(false);
  /** Écoute suspendue le temps qu'on réponde à une question posée à l'écran. */
  const pausedRef = useRef(false);

  // ⚠️ UN MOTEUR DE RECONNAISSANCE ÉMET PLUSIEURS `result` POUR UNE PHRASE,
  // y compris avec `interimResults: false`, et rien ne garantit qu'il marque
  // le dernier comme final. Bug réel déjà corrigé une fois ici (retour du
  // 2026-08-21 : « plusieurs popups se superposent, comme si chaque mot
  // déclenchait une popup »). D'où l'agrégation ci-dessous plutôt qu'un
  // traitement direct de chaque événement.
  const phraseRef = useRef('');
  const phraseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPhraseRef = useRef({ text: '', at: 0 });
  /** Une phrase à la fois : deux appels coup sur coup se heurteraient à la limite de débit. */
  const queueRef = useRef<string[]>([]);
  const busyRef = useRef(false);
  const silentRestartsRef = useRef(0);
  /** Droits déjà vérifiés pendant cette session : un aller-retour par logement, pas par objet. */
  const permissionsRef = useRef(new Map<string, boolean>());

  // La permission est relue AU MONTAGE, pas au premier appui : c'est
  // justement l'appui qui doit être instantané. Sans ça, la toute première
  // session de chaque lancement d'app payait encore l'aller-retour natif.
  useEffect(() => {
    if (microphoneGranted) return;
    ExpoSpeechRecognitionModule.getPermissionsAsync()
      .then(({ granted }) => {
        if (granted) microphoneGranted = true;
      })
      .catch(() => {
        // Sans réponse, on redemandera au premier appui : le comportement
        // d'avant, jamais pire.
      });
  }, []);

  /**
   * Remplace l'état en préservant ce qui appartient à la SESSION.
   *
   * Une ambiguïté, une erreur, un rangement réussi ne mettent pas fin à la
   * session : ils ne sont qu'un moment dedans. Passer par ici évite d'avoir à
   * répéter le relevé et le drapeau d'activité à chaque transition — et de
   * les oublier.
   */
  const settleState = useCallback((next: Partial<AssistantState> & { status: AssistantStatus }) => {
    setState((current) => ({
      ...EMPTY,
      active: current.active,
      entries: current.entries,
      undo: current.undo,
      ...next,
    }));
  }, []);

  const beginListening = useCallback(() => {
    pausedRef.current = false;
    listeningRef.current = true;
    ExpoSpeechRecognitionModule.start({
      lang: LOCALE_BY_LANGUAGE[i18n.language] ?? 'fr-FR',
      // Pas de résultats intermédiaires : on n'exploite que la phrase
      // terminée, et un résultat partiel déclencherait un appel IA sur une
      // phrase tronquée.
      interimResults: false,
      continuous: true,
      androidIntentOptions: ANDROID_SILENCE,
    });
  }, []);

  /** Suspend l'écoute : on ne répond pas en parlant à une question posée à l'écran. */
  const pauseListening = useCallback(() => {
    pausedRef.current = true;
    listeningRef.current = false;
    ExpoSpeechRecognitionModule.stop();
  }, []);

  const ensureListening = useCallback(() => {
    if (!activeRef.current || listeningRef.current) return;
    silentRestartsRef.current = 0;
    beginListening();
  }, [beginListening]);

  /** Ferme la session : une phrase de conclusion, et la feuille disparaît. */
  const endSession = useCallback((spoken: string | null) => {
    activeRef.current = false;
    pausedRef.current = false;
    listeningRef.current = false;
    queueRef.current = [];
    sessionRef.current += 1;
    if (phraseTimerRef.current) {
      clearTimeout(phraseTimerRef.current);
      phraseTimerRef.current = null;
    }
    ExpoSpeechRecognitionModule.stop();
    setState(EMPTY);
    // La feuille se referme tout de suite ; la phrase de conclusion se
    // termine par-dessus, comme une personne à qui on dit au revoir en
    // quittant la pièce.
    if (spoken) void speak(spoken, i18n.language);
    else stopSpeaking();
  }, []);

  /**
   * Écrit le rangement. LE seul endroit de l'assistant qui modifie l'inventaire.
   *
   * Aucune confirmation ne le précède : soit la dictée ne prêtait à aucune
   * confusion, soit l'utilisateur vient de trancher en désignant à l'écran —
   * et ce choix vaut accord.
   */
  const applyMove = useCallback(
    async (draft: MoveDraft, transcript: string, session: number) => {
      const selection = draftSelection(draft);
      if (!selection) return;
      const { objet, destination } = selection;

      const settle = (answer: string) => {
        if (sessionRef.current !== session) return;
        settleState({ status: 'listening', transcript, answer });
        void speak(answer, i18n.language);
        ensureListening();
      };

      // Déjà au bon endroit : on n'écrit rien. Un déplacement redondant
      // ajouterait à l'historique une ligne racontant un rangement qui n'a pas
      // eu lieu — et cet historique est censé faire foi.
      if (isAlreadyThere(objet, destination)) {
        settle(tr('assistant.move.already_there', { name: objet.name, location: destination.sentence }));
        return;
      }

      settleState({ status: 'moving', transcript, move: draft });

      try {
        // Droits vérifiés AVANT d'écrire, et des DEUX côtés : ranger, c'est
        // retirer d'un logement et poser dans un autre, qui peuvent être
        // partagés à des niveaux différents. La RLS refuserait de toute façon,
        // mais après coup et avec un message que personne ne comprend.
        const homes = [...new Set([objet.habitation_id, destination.habitationId])];
        for (const home of homes) {
          // Mis en cache pour la session : le droit sur un logement ne change
          // pas entre deux objets rangés, et l'aller-retour se payait jusqu'ici
          // sur CHAQUE rangement.
          let allowed = permissionsRef.current.get(home);
          if (allowed === undefined) {
            allowed = await canModifyHabitation(home);
            permissionsRef.current.set(home, allowed);
          }
          if (!allowed) {
            settle(tr('assistant.move.denied'));
            return;
          }
        }

        await moveObjet(objet.id, { type: destination.type, id: destination.id });
        invalidateAfterMove(queryClient, objet.id);
        if (sessionRef.current !== session) return;

        // L'index n'a pas encore été rechargé : l'entrée décrit donc bien
        // l'emplacement d'AVANT, celui où « Annuler » doit remettre l'objet.
        const undo = { objetId: objet.id, objetName: objet.name, fromLabel: locationSentence(objet) };

        // La confirmation est BRÈVE : on enchaîne les objets, une phrase
        // entière à chaque fois deviendrait vite insupportable. Le relevé à
        // l'écran garde le détail pour qui veut regarder.
        setState((current) => ({
          ...current,
          status: 'listening',
          transcript,
          answer: tr('assistant.move.done', { name: objet.name, location: destination.sentence }),
          move: null,
          undo,
          entries: [...current.entries, { objetName: objet.name, location: destination.label }],
        }));
        void speak(tr('assistant.move.ack'), i18n.language);
        ensureListening();
      } catch (error) {
        const denied = isPermissionError(error);
        if (!denied) logClientError(error, { source: 'assistant.move' });
        // On n'annonce JAMAIS un rangement qu'on n'a pas fait : quelqu'un qui
        // range n'ira pas vérifier dans l'app que ça a bien été enregistré.
        settle(tr(denied ? 'assistant.move.denied' : 'assistant.move.failed'));
      }
    },
    [ensureListening, queryClient, settleState],
  );

  /** Répond, et se remet aussitôt à écouter. */
  const respond = useCallback(
    (transcript: string, answer: string, result: AssistantResult | null = null) => {
      settleState({ status: 'listening', transcript, answer, result });
      void speak(answer, i18n.language);
      ensureListening();
    },
    [ensureListening, settleState],
  );

  /** Résout un rangement et l'exécute, ou pose la seule question qui manque. */
  const runMove = useCallback(
    async (intent: AssistantIntent, transcript: string, session: number) => {
      const resolution = resolveMove(intent, indexRef.current ?? []);
      if (sessionRef.current !== session) return;

      // Un rangement impossible se dit comme une réponse ordinaire : c'est un
      // renseignement, pas une panne, et la session continue.
      if (resolution.status !== 'ready') {
        respond(transcript, composeMoveFailure(resolution, tr));
        return;
      }

      const draft: MoveDraft = {
        objets: resolution.objets,
        destinations: resolution.destinations,
        objetId: resolution.objets.length === 1 ? resolution.objets[0].id : null,
        destinationId: resolution.destinations.length === 1 ? resolution.destinations[0].id : null,
      };

      if (resolution.confident) {
        await applyMove(draft, transcript, session);
        return;
      }

      // On ne peut pas répondre à une question en parlant : le micro se tait
      // le temps du choix, et reprend après.
      pauseListening();
      settleState({ status: 'choosing', transcript, move: draft });
      void speak(movePrompt(draft), i18n.language);
    },
    [applyMove, pauseListening, respond, settleState],
  );

  const handlePhrase = useCallback(
    async (text: string, session: number) => {
      // 1. ANALYSE LOCALE D'ABORD. « J'ai rangé X dans Y » se découpe très
      //    bien ici, sans les deux secondes d'un aller-retour réseau — et
      //    c'est la tournure de très loin la plus fréquente. Le modèle reste
      //    pour tout ce qui n'entre pas dans le moule.
      const local = parseMove(text);
      if (local) {
        await runMove(
          {
            action: 'move',
            object_query: local.object_query,
            room_query: '',
            destination_query: local.destination_query,
            scope: local.scope,
          },
          text,
          session,
        );
        return;
      }

      // 2. Une dictée très courte est un nom d'objet : on y répond localement,
      //    sans appel à l'IA, exactement comme le ferait la barre de recherche.
      if (text.split(/s+/).length <= SHORT_QUERY_MAX_WORDS) {
        const found = resolveIntent(
          { action: 'locate', object_query: text, room_query: '', destination_query: '', scope: 'one' },
          indexRef.current ?? [],
        );
        respond(text, composeAnswer(found, tr), found);
        return;
      }

      // 3. Tout le reste passe par le modèle.
      settleState({ status: 'thinking', transcript: text });
      try {
        const intent = await requestIntent(text);
        if (sessionRef.current !== session) return;

        if (intent.action === 'move') {
          await runMove(intent, text, session);
          return;
        }

        const result = resolveIntent(intent, indexRef.current ?? []);
        respond(text, composeAnswer(result, tr), result);
      } catch (error) {
        const busy = error instanceof RateLimitedError;
        // Une limitation de débit n'est pas une panne : inutile d'encombrer
        // le journal d'erreurs avec un utilisateur qui parle vite.
        if (!busy) logClientError(error, { source: 'assistant', transcriptLength: text.length });
        if (sessionRef.current !== session) return;
        respond(text, tr(busy ? 'assistant.error_busy' : 'assistant.error'));
      }
    },
    [respond, runMove, settleState],
  );

  const handleTranscript = useCallback(
    async (transcript: string) => {
      const session = sessionRef.current;
      const trimmed = transcript.trim();
      if (!trimmed) return;

      // « Merci » clôt la session, y compris posé à la FIN d'un ordre —
      // « range mes clés dans le tiroir, merci » est une phrase normale.
      // Testé avant tout le reste : c'est la seule chose qui ne coûte pas un
      // appel réseau, et la seule qui doive marcher même quand tout échoue.
      const { closing, rest } = splitClosing(trimmed);
      if (!closing) {
        await handlePhrase(trimmed, session);
        return;
      }

      if (rest) await handlePhrase(rest, session);
      if (sessionRef.current !== session) return;
      // Sauf si l'ordre a soulevé une question : on ne raccroche pas au nez
      // de quelqu'un à qui l'on vient de demander quelque chose.
      if (stateRef.current.status === 'choosing') return;

      const count = stateRef.current.entries.length;
      endSession(count > 0 ? tr('assistant.session.closing', { count }) : tr('assistant.session.closing_empty'));
    },
    [endSession, handlePhrase],
  );

  /**
   * Traite les phrases UNE PAR UNE.
   *
   * Deux phrases dites coup sur coup lanceraient deux appels simultanés, dont
   * le second se heurterait à la limite de débit du serveur. La file les
   * sérialise ; l'attente se voit à peine parce que le temps de dire la
   * suivante couvre déjà le traitement de la précédente.
   */
  const drainQueue = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      while (queueRef.current.length > 0) {
        const next = queueRef.current.shift();
        if (next) await handleTranscript(next);
      }
    } finally {
      busyRef.current = false;
    }
  }, [handleTranscript]);

  /** Relance le moteur, qui s'arrête de lui-même à chaque silence. */
  const restartListening = useCallback(() => {
    if (!activeRef.current || pausedRef.current) return;
    if (silentRestartsRef.current >= MAX_SILENT_RESTARTS) {
      endSession(null);
      return;
    }
    silentRestartsRef.current += 1;
    setTimeout(() => {
      if (activeRef.current && !pausedRef.current) beginListening();
    }, RESTART_DELAY);
  }, [beginListening, endSession]);

  /** Déclare la phrase courante terminée et la met en file. */
  const flushPhrase = useCallback(() => {
    if (phraseTimerRef.current) {
      clearTimeout(phraseTimerRef.current);
      phraseTimerRef.current = null;
    }
    const phrase = phraseRef.current;
    phraseRef.current = '';
    if (!phrase) return;

    // Deux résultats identiques rapprochés viennent du moteur, pas de
    // l'utilisateur : les traiter tous les deux rangerait l'objet deux fois.
    const now = Date.now();
    if (phrase === lastPhraseRef.current.text && now - lastPhraseRef.current.at < REPEAT_GUARD) return;
    lastPhraseRef.current = { text: phrase, at: now };

    silentRestartsRef.current = 0;
    queueRef.current.push(phrase);
    void drainQueue();
  }, [drainQueue]);

  // Le moteur a réellement la parole : c'est SEULEMENT maintenant qu'on
  // affiche « je t'écoute ». Annoncer l'écoute dès l'appui, alors que le
  // moteur met encore un instant à démarrer, est précisément ce qui faisait
  // perdre le début des phrases.
  useSpeechRecognitionEvent('start', () => {
    if (!activeRef.current) return;
    listeningRef.current = true;
    setState((current) => (current.status === 'starting' ? { ...current, status: 'listening' } : current));
  });

  useSpeechRecognitionEvent('result', (event) => {
    if (!activeRef.current) return;
    const transcript = event.results[0]?.transcript?.trim();
    if (!transcript) return;

    phraseRef.current = transcript;
    if (phraseTimerRef.current) clearTimeout(phraseTimerRef.current);
    // Un résultat marqué final n'a plus rien à attendre. Sinon on laisse
    // passer un silence : certains moteurs livrent la phrase par morceaux
    // successifs sans jamais dire lequel est le dernier.
    if (event.isFinal) flushPhrase();
    else phraseTimerRef.current = setTimeout(flushPhrase, PHRASE_PAUSE);
  });

  useSpeechRecognitionEvent('end', () => {
    if (!activeRef.current) return;
    listeningRef.current = false;
    // Une phrase encore en attente de son silence part maintenant : le moteur
    // vient de nous dire qu'il n'y aura rien de plus.
    flushPhrase();
    restartListening();
  });

  useSpeechRecognitionEvent('error', (event) => {
    listeningRef.current = false;
    if (!activeRef.current) return;

    // Un silence n'est pas une panne : en session, c'est même l'état le plus
    // courant entre deux objets. On relance.
    if (SILENT_ERROR_CODES.has(event.error)) {
      restartListening();
      return;
    }
    endSession(null);
    Alert.alert(i18n.t('home.voice_search_error'));
  });

  /**
   * Enregistre un choix — et l'exécute dès qu'il ne manque plus rien.
   *
   * Désigner à l'écran VAUT accord : demander en plus « confirmez-vous ? »
   * ferait deux gestes pour une seule décision.
   */
  const choose = useCallback(
    (patch: { objetId?: string | null; destinationId?: string | null }) => {
      const current = stateRef.current;
      if (!current.move) return;
      const next = { ...current.move, ...patch };

      if (draftSelection(next)) {
        void applyMove(next, current.transcript, sessionRef.current);
        return;
      }
      setState((state) => (state.move ? { ...state, move: next } : state));
    },
    [applyMove],
  );

  const chooseObjet = useCallback((objetId: string | null) => choose({ objetId }), [choose]);
  const chooseDestination = useCallback((destinationId: string | null) => choose({ destinationId }), [choose]);

  /** Abandonne la question en cours et se remet à écouter. */
  const skipChoice = useCallback(() => {
    stopSpeaking();
    settleState({ status: 'listening', answer: tr('assistant.move.skipped') });
    ensureListening();
  }, [ensureListening, settleState]);

  /**
   * Remet l'objet là où il était.
   *
   * C'est ce qui remplace la confirmation : plutôt que de faire valider
   * chaque phrase, on écrit, on annonce, et le retour en arrière reste à
   * portée. L'annulation est elle-même un déplacement, donc journalisée —
   * l'historique doit raconter ce qui s'est passé, correction comprise.
   */
  const undoMove = useCallback(async () => {
    const { undo, transcript } = stateRef.current;
    if (!undo) return;

    const session = sessionRef.current;
    setState((current) => ({ ...current, status: 'moving' }));

    try {
      await undoLastMove(undo.objetId);
      invalidateAfterMove(queryClient, undo.objetId);
      if (sessionRef.current !== session) return;
      const answer = tr('assistant.move.undone', { name: undo.objetName, location: undo.fromLabel });
      setState((current) => ({
        ...current,
        status: 'listening',
        answer,
        undo: null,
        entries: current.entries.slice(0, -1),
      }));
      void speak(answer, i18n.language);
      ensureListening();
    } catch (error) {
      logClientError(error, { source: 'assistant.undo' });
      if (sessionRef.current !== session) return;
      // L'annulation reste offerte : elle a échoué, l'objet est donc toujours
      // à son nouvel emplacement, et réessayer est le geste attendu.
      const answer = tr('assistant.move.undo_failed');
      settleState({ status: 'listening', transcript, answer });
      void speak(answer, i18n.language);
      ensureListening();
    }
  }, [ensureListening, queryClient, settleState]);

  /** Ouvre une session : le micro s'ouvre et reste ouvert. */
  const start = useCallback(async () => {
    stopSpeaking();
    sessionRef.current += 1;
    activeRef.current = true;
    pausedRef.current = false;
    phraseRef.current = '';
    lastPhraseRef.current = { text: '', at: 0 };
    queueRef.current = [];
    silentRestartsRef.current = 0;
    // Le cache des droits ne survit pas à la session : un partage peut avoir
    // été retiré entre deux.
    permissionsRef.current.clear();
    setState({ ...EMPTY, active: true, status: 'starting' });

    // La permission n'est demandée qu'une fois : c'est l'aller-retour natif
    // qu'on attendait à chaque appui, pour une réponse qui ne change plus.
    if (!microphoneGranted) {
      const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!granted) {
        activeRef.current = false;
        setState(EMPTY);
        Alert.alert(i18n.t('home.voice_search_permission_message'));
        return;
      }
      microphoneGranted = true;
    }

    beginListening();
    // Après le démarrage du micro, jamais avant : l'énumération des voix ne
    // doit retarder l'écoute d'aucun instant.
    primeVoices(i18n.language);
  }, [beginListening]);

  /** Ferme la session à la main, quand la voix n'a pas suffi. */
  const stop = useCallback(() => {
    const count = stateRef.current.entries.length;
    endSession(count > 0 ? tr('assistant.session.closing', { count }) : null);
  }, [endSession]);

  return {
    ...state,
    isListening: state.status === 'listening',
    start,
    stop,
    chooseObjet,
    chooseDestination,
    skipChoice,
    undoMove,
  };
}

/**
 * Ce que l'assistant énonce en posant une question.
 *
 * Elle est dite à voix haute parce que ranger se fait les mains prises : on
 * doit savoir qu'on est attendu sans regarder l'écran.
 */
function movePrompt(draft: MoveDraft): string {
  if (!draft.objetId) return tr('assistant.move.which_object', { n: draft.objets.length });
  return tr('assistant.move.which_destination', { n: draft.destinations.length });
}
