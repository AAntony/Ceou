import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { showDialog } from '../../../lib/dialog';
import i18n from '../../../lib/i18n';
import { logClientError } from '../../../lib/errorLogging';
import { supabase } from '../../../lib/supabase/client';
import { invalidateAfterMove, moveObjet, undoLastMove } from '../../inventory/queries';
import { usePrets } from '../../loans/queries';
import { useSearchIndex } from '../../search/queries';
import { canModifyHabitation, isPermissionError } from '../permissions';
import { createLiveAudio, encodePcm16, isLiveAudioSupported, type LiveAudio } from './audio';
import { InactivityClock, OpeningAudio, ReplyGate } from './duplex';
import { LiveConnection, type FunctionCall } from './connection';
import { runTool, ToolSession, type ToolEffects, type ToolEvent } from './tools';

// UNE CONVERSATION, PAS UNE SUITE DE COMMANDES.
//
// L'assistant précédent entendait une phrase, la classait, répondait, puis se
// remettait à écouter. Ici on ouvre un fil avec Gemini Live et on le laisse
// ouvert : il entend, comprend, appelle les outils de l'app quand il en a
// besoin, et répond avec sa propre voix — naturelle, en continu.
//
// ═══ ON LUI COUPE LA PAROLE EN PARLANT ═══
//
// Le micro reste ouvert pendant que Céoù parle, comme avec n'importe quelle IA
// vocale : le serveur entend qu'on parle par-dessus, abandonne sa réponse et
// prévient (`interrupted`) ; on jette alors ce qui restait à jouer. Aucun
// bouton pour ça.
//
// Ça ne tient que grâce à l'annulation d'écho du téléphone : sans elle, Céoù
// s'entend dans le haut-parleur et se coupe lui-même. Le module audio publié
// ne l'active pas sur Android — patches/react-native-audio-api+0.13.3.patch
// passe le micro en mode « communication vocale », celui des applis d'appel.
//
// ═══ NI MINUTEUR, NI DURÉE PAR CONVERSATION ═══
//
// La conversation reçoit tout ce qui reste du plafond du jour et ne l'affiche
// pas. Quand il arrive à son terme, l'app envoie TIME_UP : Céoù l'annonce avec
// sa voix, puis l'assistant simple prend le relais.

// Même valeur dans supabase/functions/voice-session.
const TIME_UP = '[daily_time_up]';
// À cette distance de la fin, Céoù l'annonce dès qu'il ne parle plus.
const TIME_UP_NOTICE_SECONDS = 15;
// Passé la fin, on ne l'attend plus. Reste sous la minute de marge du jeton.
const TIME_UP_GRACE_SECONDS = 20;

// Après l'appel de fin, le modèle dit souvent au revoir DANS le tour qui suit.
// On attend la fin de ce tour, mais jamais plus que ce délai.
const END_GRACE_MS = 8000;

// LA DURÉE UTILISÉE EST NOTÉE AU FIL DE L'EAU. Une conversation réserve tout le
// reste du jour ; si l'app est tuée ou perd le réseau avant de rendre compte,
// cette note est renvoyée à l'ouverture suivante et rend ce qui n'a pas servi.
const PENDING_KEY = 'ceou.voice_live.pending';
const CHECKPOINT_SECONDS = 10;

const MAX_LINES = 30;
const MAX_CARDS = 12;

export type LiveStatus = 'idle' | 'connecting' | 'buffering' | 'listening' | 'thinking' | 'speaking';
export type LiveLine = { id: number; role: 'user' | 'assistant'; text: string };
export type LiveCard = Exclude<ToolEvent, { type: 'end' }> & { id: number };

export type LiveState = {
  active: boolean;
  status: LiveStatus;
  lines: LiveLine[];
  cards: LiveCard[];
};

/** Pourquoi une conversation n'a pas démarré : l'accueil en tire la suite. */
export type LiveStartOutcome = 'started' | 'unsupported' | 'permission' | 'consent' | 'quota' | 'unavailable';

type EndReason = 'user' | 'model' | 'time_up' | 'network' | 'error' | 'background';

const EMPTY: LiveState = { active: false, status: 'idle', lines: [], cards: [] };

type StartResponse = { token: string; model: string; sessionId: string; maxSeconds: number };
type Pending = { sessionId: string; usedSeconds: number };

async function readPending(): Promise<Pending | null> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as Pending) : null;
  } catch {
    return null;
  }
}

function writePending(pending: Pending): void {
  AsyncStorage.setItem(PENDING_KEY, JSON.stringify(pending)).catch(() => {});
}

/** Le code d'erreur d'une fonction Edge, lu dans le corps de la réponse HTTP. */
async function invokeErrorCode(error: unknown): Promise<string | null> {
  const context = (error as { context?: { json?: () => Promise<unknown> } } | null)?.context;
  try {
    const body = (await context?.json?.()) as { error?: string } | undefined;
    return typeof body?.error === 'string' ? body.error : null;
  } catch {
    return null;
  }
}

export function useLiveAssistant({ onTimeUp }: { onTimeUp?: () => void } = {}) {
  const supported = isLiveAudioSupported();
  const queryClient = useQueryClient();
  const { data: index } = useSearchIndex();
  const { data: loans } = usePrets(false);
  const [state, setState] = useState<LiveState>(EMPTY);

  // Lus depuis des callbacks natifs et réseau, hors du rendu.
  const indexRef = useRef(index);
  indexRef.current = index;
  const loansRef = useRef(loans);
  loansRef.current = loans;
  const onTimeUpRef = useRef(onTimeUp);
  onTimeUpRef.current = onTimeUp;

  const activeRef = useRef(false);
  const statusRef = useRef<LiveStatus>('idle');
  const audioRef = useRef<LiveAudio | null>(null);
  const connectionRef = useRef<LiveConnection | null>(null);
  const toolsRef = useRef<ToolSession | null>(null);
  const permissionsRef = useRef(new Map<string, boolean>());
  const sessionRef = useRef<{ id: string; startedAt: number; grantedSeconds: number; checkpoint: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingEndRef = useRef(false);
  const turnCompleteRef = useRef(false);
  const openingRef = useRef(false);
  const closingRef = useRef(false);
  const generationRef = useRef(0);
  const connectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeUpSentRef = useRef(false);
  const lineIdRef = useRef(0);
  const inputRef = useRef<OpeningAudio | null>(null);
  const gateRef = useRef(new ReplyGate());
  const skipReplyRef = useRef(false);
  const inactivityRef = useRef(new InactivityClock());

  const appendTranscript = useCallback((role: LiveLine['role'], chunk: string) => {
    setState((current) => {
      const last = current.lines[current.lines.length - 1];
      // Le serveur livre la transcription par fragments : on les recolle tant
      // que c'est la même personne qui parle.
      if (last && last.role === role) {
        const lines = current.lines.slice(0, -1);
        return { ...current, lines: [...lines, { ...last, text: `${last.text}${chunk}` }] };
      }
      lineIdRef.current += 1;
      const lines = [...current.lines, { id: lineIdRef.current, role, text: chunk.trimStart() }];
      return { ...current, lines: lines.slice(-MAX_LINES) };
    });
  }, []);

  const setStatus = useCallback((status: LiveStatus) => {
    statusRef.current = status;
    setState((current) => (current.active && current.status !== status ? { ...current, status } : current));
  }, []);

  const finish = useCallback(async (requested: EndReason) => {
    if (!activeRef.current) return;
    // L'au revoir qui suit l'annonce de fin du temps est une fin de plafond,
    // pas une conversation close par le modèle.
    const reason = requested === 'model' && timeUpSentRef.current ? 'time_up' : requested;
    activeRef.current = false;
    closingRef.current = true;
    generationRef.current += 1;
    if (connectTimerRef.current) clearTimeout(connectTimerRef.current);
    connectTimerRef.current = null;
    pendingEndRef.current = false;
    statusRef.current = 'idle';
    if (timerRef.current) clearInterval(timerRef.current);
    if (endTimerRef.current) clearTimeout(endTimerRef.current);
    timerRef.current = null;
    endTimerRef.current = null;

    connectionRef.current?.close();
    inputRef.current?.close();
    inputRef.current = null;
    connectionRef.current = null;
    toolsRef.current = null;
    const audio = audioRef.current;
    audioRef.current = null;
    setState(EMPTY);
    await audio?.dispose().catch(() => undefined);
    closingRef.current = false;

    // RENDRE CE QUI N'A PAS SERVI. La note locale n'est effacée qu'une fois le
    // serveur d'accord : sans réseau, elle repartira à l'ouverture suivante.
    const session = sessionRef.current;
    sessionRef.current = null;
    if (session) {
      const pending = { sessionId: session.id, usedSeconds: Math.ceil((Date.now() - session.startedAt) / 1000) };
      writePending(pending);
      void supabase.functions
        .invoke('voice-session', { body: { action: 'end', ...pending } })
        .then(({ error }) => {
          if (error) throw error;
          return AsyncStorage.removeItem(PENDING_KEY);
        })
        .catch((error: unknown) => logClientError(error, { source: 'assistant.live', step: 'settle' }));
    }

    if (reason === 'network' || reason === 'error') showDialog({
      message: i18n.t('assistant.live.lost'),
      actions: [
        { label: i18n.t('assistant.live.use_simple'), onPress: () => onTimeUpRef.current?.() },
        { label: i18n.t('common.cancel'), cancel: true },
      ],
    });
    else if (reason === 'time_up') onTimeUpRef.current?.();
  }, []);

  /** Clôt dès que l'au revoir est dit — ou au bout d'un délai si rien ne vient. */
  const finishAfterGoodbye = useCallback(() => {
    pendingEndRef.current = true;
    turnCompleteRef.current = false;
    if (endTimerRef.current) clearTimeout(endTimerRef.current);
    endTimerRef.current = setTimeout(() => void finish('model'), END_GRACE_MS);
  }, [finish]);

  const effects: ToolEffects = {
    canModify: async (habitationId) => {
      // Mis en cache pour la conversation : le droit sur un logement ne change
      // pas entre deux objets rangés.
      const known = permissionsRef.current.get(habitationId);
      if (known !== undefined) return known;
      const allowed = await canModifyHabitation(habitationId);
      permissionsRef.current.set(habitationId, allowed);
      return allowed;
    },
    move: async (objetId, destination) => {
      await moveObjet(objetId, destination);
      invalidateAfterMove(queryClient, objetId);
    },
    undo: async (objetId) => {
      await undoLastMove(objetId);
      invalidateAfterMove(queryClient, objetId);
    },
    isPermissionError,
  };
  const effectsRef = useRef(effects);
  effectsRef.current = effects;

  const handleToolCalls = useCallback(
    async (calls: FunctionCall[]) => {
      const tools = toolsRef.current;
      const connection = connectionRef.current;
      if (!tools || !connection) return;
      setStatus('thinking');

      const responses = [];
      for (const call of calls) {
        if (!activeRef.current || connectionRef.current !== connection) break;
        try {
          const outcome = await runTool(call.name, call.args, {
            session: tools,
            index: indexRef.current ?? [],
            loans: loansRef.current ?? [],
            effects: effectsRef.current,
          });
          responses.push({ id: call.id, name: call.name, response: outcome.response });

          const event = outcome.event;
          if (event?.type === 'end') {
            finishAfterGoodbye();
          } else if (event) {
            lineIdRef.current += 1;
            const card = { ...event, id: lineIdRef.current } as LiveCard;
            setState((current) => ({ ...current, cards: [...current.cards, card].slice(-MAX_CARDS) }));
          }
        } catch (error) {
          logClientError(error, { source: 'assistant.live', tool: call.name });
          responses.push({ id: call.id, name: call.name, response: { status: 'failed' } });
        }
      }

      // La session a pu être fermée pendant l'exécution (appui sur Terminer).
      if (connectionRef.current === connection) connection.sendToolResponses(responses);
    },
    [finishAfterGoodbye, setStatus],
  );

  /** Chaque seconde : noter la durée utilisée, et annoncer la fin du plafond. */
  const tick = useCallback(() => {
    const session = sessionRef.current;
    const audio = audioRef.current;
    if (!session || !audio) return;
    if (inactivityRef.current.check(Date.now(), statusRef.current === 'listening' && gateRef.current.allowsInput(Date.now()) && !audio.isPlaying())) {
      void finish('user');
      return;
    }
    const elapsed = Math.floor((Date.now() - session.startedAt) / 1000);
    const left = session.grantedSeconds - elapsed;

    if (elapsed - session.checkpoint >= CHECKPOINT_SECONDS) {
      session.checkpoint = elapsed;
      writePending({ sessionId: session.id, usedSeconds: elapsed });
    }

    if (left <= -TIME_UP_GRACE_SECONDS) {
      void finish('time_up');
      return;
    }
    // Annoncé entre deux répliques plutôt qu'au milieu d'une phrase de Céoù —
    // sauf si le temps est déjà écoulé : là, on n'attend plus.
    const between = !audio.isPlaying() && statusRef.current !== 'thinking';
    if (!timeUpSentRef.current && left <= TIME_UP_NOTICE_SECONDS && (between || left <= 0)) {
      timeUpSentRef.current = true;
      connectionRef.current?.sendText(TIME_UP);
    }
  }, [finish]);

  const start = useCallback(async (): Promise<LiveStartOutcome> => {
    if (activeRef.current || openingRef.current || closingRef.current) return 'started';
    openingRef.current = true;
    try {
    const audio = createLiveAudio();
    if (!audio) return 'unsupported';
    if (!(await audio.requestPermission().catch(() => false))) return 'permission';

    activeRef.current = true;
    const generation = ++generationRef.current;
    audioRef.current = audio;
    pendingEndRef.current = false;
    turnCompleteRef.current = false;
    timeUpSentRef.current = false;
    permissionsRef.current.clear();
    setState({ ...EMPTY, active: true, status: 'connecting' });
    statusRef.current = 'connecting';

    const gate = new ReplyGate();
    gateRef.current = gate;
    inactivityRef.current = new InactivityClock();
    skipReplyRef.current = false;
    const input = new OpeningAudio();
    inputRef.current = input;
    const silence = encodePcm16(new Float32Array(1600), 1600, 16000);
    connectTimerRef.current = setTimeout(() => {
      logClientError(new Error('voice_setup_timeout'), { source: 'assistant.live', step: 'connect' });
      void finish('error');
    }, 15000);
    // Listen immediately after the user's explicit action and permission.
    // Only delivery waits for authentication and the Gemini handshake.
    void audio.startCapture((chunk, speechDetected) => {
      if (!activeRef.current || generationRef.current !== generation) return;
      if (speechDetected && gate.allowsInput(Date.now())) inactivityRef.current.activity(Date.now());
      try { input.push(gate.allowsInput(Date.now()) ? chunk : silence); }
      catch (captureError) {
        logClientError(captureError, { source: 'assistant.live', step: 'opening_audio' });
        void finish('error');
      }
    }).then(() => {
      if (activeRef.current && generationRef.current === generation && statusRef.current === 'connecting') setStatus('buffering');
    }).catch((captureError: unknown) => {
      logClientError(captureError, { source: 'assistant.live', step: 'capture' });
      void finish('error');
    });

    const pending = await readPending();
    const { data, error } = await supabase.functions.invoke<StartResponse>('voice-session', {
      body: { action: 'start', language: i18n.language.toLowerCase().startsWith('en') ? 'en' : 'fr', pending },
    });

    if (generation !== generationRef.current || !activeRef.current) {
      if (data?.sessionId) {
        const cancelled = { sessionId: data.sessionId, usedSeconds: 0 };
        writePending(cancelled);
        await supabase.functions.invoke('voice-session', { body: { action: 'end', ...cancelled } });
      }
      return 'started';
    }

    if (error || !data?.token) {
      if (connectTimerRef.current) clearTimeout(connectTimerRef.current);
      connectTimerRef.current = null;
      input.close();
      activeRef.current = false;
      audioRef.current = null;
      setState(EMPTY);
      await audio.dispose().catch(() => undefined);
      const code = error ? await invokeErrorCode(error) : null;
      if (code === 'consent_required') return 'consent';
      if (code === 'quota_exhausted') return 'quota';
      if (code !== 'account_required') logClientError(error ?? new Error('empty_token'), { source: 'assistant.live', step: 'start', code });
      return 'unavailable';
    }

    // La conversation précédente est soldée : la note devient celle-ci.
    writePending({ sessionId: data.sessionId, usedSeconds: 0 });
    audioRef.current = audio;
    toolsRef.current = new ToolSession();
    sessionRef.current = { id: data.sessionId, startedAt: Date.now(), grantedSeconds: data.maxSeconds, checkpoint: 0 };

    audio.setOnIdle(() => {
      if (!activeRef.current || audio.isPlaying()) return;
      gate.idle(Date.now());
      if (pendingEndRef.current && turnCompleteRef.current) {
        void finish('model');
        return;
      }
      if (turnCompleteRef.current) setStatus('listening');
    });
    audio.setOnError((playbackError) => {
      logClientError(playbackError, { source: 'assistant.live', step: 'playback' });
      void finish('error');
    });

    const connection = new LiveConnection(data.token, data.model, {
      onReady: () => {
        if (!activeRef.current) return;
        if (connectTimerRef.current) clearTimeout(connectTimerRef.current);
        connectTimerRef.current = null;
        input.ready(chunk => connection.sendAudio(chunk));
        setStatus('listening');
        timerRef.current = setInterval(tick, 1000);
      },
      onAudio: (base64) => {
        if (!activeRef.current || skipReplyRef.current) return;
        gate.start();
        audio.play(base64);
        turnCompleteRef.current = false;
        setStatus('speaking');
      },
      onInputTranscript: (text) => {
        inactivityRef.current.activity(Date.now());
        if (!audio.isPlaying()) setStatus('thinking');
        appendTranscript('user', text);
      },
      onOutputTranscript: (text) => appendTranscript('assistant', text),
      // L'utilisateur a parlé par-dessus : ce qui restait à dire est caduc.
      onInterrupted: () => {
        skipReplyRef.current = false;
        gate.interrupt(Date.now());
        audio.flush();
      },
      onTurnComplete: () => {
        turnCompleteRef.current = true;
        skipReplyRef.current = false;
        gate.finish(audio.isPlaying(), Date.now());
        if (audio.isPlaying()) return;
        if (pendingEndRef.current) {
          void finish('model');
          return;
        }
        setStatus('listening');
      },
      onToolCall: (calls) => void handleToolCalls(calls),
      // Le serveur va couper : on finit proprement le tour en cours.
      onGoAway: () => finishAfterGoodbye(),
      onClose: ({ failed }) => {
        if (activeRef.current) void finish(failed ? 'network' : 'model');
      },
    });
    connectionRef.current = connection;
    connection.open();
    return 'started';
    } catch (error) {
      logClientError(error, { source: 'assistant.live', step: 'start' });
      await finish('error');
      return 'started';
    } finally {
      openingRef.current = false;
    }
  }, [appendTranscript, finish, finishAfterGoodbye, handleToolCalls, setStatus, tick]);

  const stop = useCallback(() => void finish('user'), [finish]);
  const interrupt = useCallback(() => {
    if (!activeRef.current) return;
    skipReplyRef.current = true;
    gateRef.current.interrupt(Date.now());
    pendingEndRef.current = false;
    if (endTimerRef.current) clearTimeout(endTimerRef.current);
    endTimerRef.current = null;
    audioRef.current?.flush();
    setStatus('listening');
  }, [setStatus]);

  // Une conversation ne continue pas en arrière-plan : le micro d'un téléphone
  // posé dans une poche n'a rien à écouter, et chaque seconde se paie.
  useEffect(() => {
    if (!state.active) return;
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') void finish('background');
    });
    return () => subscription.remove();
  }, [finish, state.active]);

  useEffect(() => () => void finish('user'), [finish]);

  return { ...state, supported, start, stop, interrupt };
}
