import { Platform } from 'react-native';

// LE MICRO ET LE HAUT-PARLEUR D'UNE CONVERSATION TEMPS RÉEL.
//
// Gemini Live attend du PCM 16 bits mono à 16 kHz, et rend du PCM 16 bits mono
// à 24 kHz, par petits morceaux encodés en base64. Aucun module Expo ne livre
// le micro morceau par morceau : `react-native-audio-api` (Software Mansion)
// le fait, et joue une file de morceaux sans trou ni craquement.
//
// C'EST UN MODULE NATIF, CHARGÉ PARESSEUSEMENT. Il n'existe que dans un build
// qui l'a compilé ; une mise à jour OTA arrive sur des téléphones qui ne l'ont
// pas encore. L'import lance l'installation native et JETTE si elle échoue :
// on l'attrape ici, et l'app retombe sur l'assistant simple au lieu de
// planter. Même logique que speak.ts.

type AudioApi = typeof import('react-native-audio-api');

let cached: AudioApi | null | undefined;

function audioApi(): AudioApi | null {
  if (cached !== undefined) return cached;
  // Le web n'est pas une cible de l'app : l'aperçu garde l'assistant simple.
  if (Platform.OS === 'web') {
    cached = null;
    return cached;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('react-native-audio-api') as AudioApi;
  } catch {
    cached = null;
  }
  return cached;
}

/** Vrai quand ce build sait tenir une conversation temps réel. */
export function isLiveAudioSupported(): boolean {
  return audioApi() !== null;
}

export const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;
// 100 ms de son par envoi : assez court pour que la détection de parole du
// serveur réagisse vite, assez long pour ne pas saturer le pont natif.
const CHUNK_FRAMES = 1600;

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Encodage base64 écrit à la main : ni `btoa` ni `Buffer` ne sont garantis partout. */
function toBase64(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += BASE64[(n >> 18) & 63] + BASE64[(n >> 12) & 63] + BASE64[(n >> 6) & 63] + BASE64[n & 63];
  }
  const rest = bytes.length - i;
  if (rest === 1) {
    const n = bytes[i] << 16;
    out += `${BASE64[(n >> 18) & 63]}${BASE64[(n >> 12) & 63]}==`;
  } else if (rest === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out += `${BASE64[(n >> 18) & 63]}${BASE64[(n >> 12) & 63]}${BASE64[(n >> 6) & 63]}=`;
  }
  return out;
}

/**
 * Échantillons flottants vers PCM 16 bits little-endian, au débit attendu.
 *
 * Le débit demandé au micro n'est qu'une préférence : un appareil peut en
 * livrer un autre. On rééchantillonne alors linéairement — c'est de la voix
 * destinée à être comprise, pas de la musique.
 */
export function encodePcm16(samples: Float32Array, frames: number, sampleRate: number): string {
  const ratio = sampleRate / INPUT_SAMPLE_RATE;
  const length = ratio === 1 ? frames : Math.floor(frames / ratio);
  const bytes = new Uint8Array(length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < length; i++) {
    const position = i * ratio;
    const left = Math.floor(position);
    const right = Math.min(left + 1, frames - 1);
    const value = samples[left] + (samples[right] - samples[left]) * (position - left);
    const clamped = Math.max(-1, Math.min(1, value));
    view.setInt16(i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }
  return toBase64(bytes);
}

export type LiveAudio = {
  /** Demande le micro. Faux si refusé. */
  requestPermission: () => Promise<boolean>;
  startCapture: (onChunk: (base64Pcm16k: string) => void) => Promise<void>;
  stopCapture: () => Promise<void>;
  /** Met un morceau de voix en file ; les morceaux sont joués dans l'ordre d'arrivée. */
  play: (base64Pcm24k: string) => void;
  /** Coupe net ce qui reste à dire : l'utilisateur a parlé par-dessus. */
  flush: () => void;
  isPlaying: () => boolean;
  /** Prévenu quand la file de voix se vide : Céoù a fini de parler. */
  setOnIdle: (callback: (() => void) | null) => void;
  setOnError: (callback: ((error: unknown) => void) | null) => void;
  dispose: () => Promise<void>;
};

export function createLiveAudio(): LiveAudio | null {
  const api = audioApi();
  if (!api) return null;

  const { AudioContext, AudioManager, AudioRecorder, decodePCMInBase64 } = api;

  let recorder: InstanceType<typeof AudioRecorder> | null = null;
  let context: InstanceType<typeof AudioContext> | null = null;
  let queue: ReturnType<InstanceType<typeof AudioContext>['createBufferQueueSource']> | null = null;
  const pending = new Set<string>();
  let onIdle: (() => void) | null = null;
  let onError: ((error: unknown) => void) | null = null;
  let disposed = false;
  // Les morceaux sont décodés en natif, donc de façon asynchrone : cette chaîne
  // garantit qu'ils entrent dans la file dans leur ordre d'arrivée.
  let decoding: Promise<void> = Promise.resolve();
  // Un morceau reçu mais pas encore en file compte déjà comme de la voix en
  // cours : sans ça, Céoù passerait pour silencieux dans le creux du décodage.
  let decodingCount = 0;
  // Incrémenté à chaque coupure : un morceau encore en décodage au moment de
  // l'interruption ne doit pas repartir après elle.
  let generation = 0;

  const notifyIdle = () => {
    if (!disposed && pending.size === 0 && decodingCount === 0) onIdle?.();
  };

  const ensureQueue = async () => {
    if (!context) context = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
    if (context.state !== 'running') await context.resume();
    if (disposed) throw new Error('audio_disposed');
    if (!queue) {
      queue = context.createBufferQueueSource();
      queue.connect(context.destination);
      const currentQueue = queue;
      queue.onBufferEnded = ({ bufferId }) => {
        if (queue !== currentQueue) return;
        pending.delete(String(bufferId));
        notifyIdle();
      };
      // 0.13.3 defaults offset to -1, then rejects it itself.
      queue.start(0, 0);
    }
    return queue;
  };

  return {
    requestPermission: async () => (await AudioManager.requestRecordingPermissions()) === 'Granted',

    startCapture: async (onChunk) => {
      if (disposed) return;
      // LE MICRO RESTE OUVERT PENDANT QUE CÉOÙ PARLE : l'annulation d'écho du
      // téléphone est ce qui l'empêche de s'entendre. Sur Android, elle vient
      // du mode « communication vocale » imposé par
      // patches/react-native-audio-api+0.13.3.patch. Sur iOS, `voiceChat`
      // active le traitement de voix du système ; `defaultToSpeaker` garde la
      // voix sur le haut-parleur plutôt que dans l'écouteur du haut.
      AudioManager.setAudioSessionOptions({
        iosCategory: 'playAndRecord',
        iosMode: 'voiceChat',
        iosOptions: ['defaultToSpeaker', 'allowBluetoothHFP'],
      });
      await AudioManager.setAudioSessionActivity(true);
      if (disposed) {
        await AudioManager.setAudioSessionActivity(false);
        return;
      }
      recorder = new AudioRecorder();
      const ready = recorder.onAudioReady(
        { sampleRate: INPUT_SAMPLE_RATE, bufferLength: CHUNK_FRAMES, channelCount: 1 },
        ({ buffer, numFrames }) => onChunk(encodePcm16(buffer.getChannelData(0), numFrames, buffer.sampleRate)),
      );
      if (ready.status === 'error') throw new Error(ready.message);
      const current = recorder;
      const started = await current.start();
      if (disposed) {
        current.clearOnAudioReady();
        await current.stop();
        return;
      }
      if (started.status === 'error') throw new Error(started.message);
    },

    stopCapture: async () => {
      const current = recorder;
      recorder = null;
      if (!current) return;
      current.clearOnAudioReady();
      await current.stop();
    },

    play: (base64) => {
      if (disposed) return;
      const expected = generation;
      decodingCount += 1;
      decoding = decoding
        .then(async () => {
          const buffer = await decodePCMInBase64(base64, OUTPUT_SAMPLE_RATE, 1);
          if (expected !== generation) return;
          const target = await ensureQueue();
          if (expected !== generation || disposed) return;
          pending.add(String(target.enqueueBuffer(buffer)));
        })
        .catch((error: unknown) => {
          if (expected === generation && !disposed) onError?.(error);
        })
        .finally(() => {
          decodingCount -= 1;
          notifyIdle();
        });
    },

    flush: () => {
      generation += 1;
      pending.clear();
      if (queue) {
        queue.clearBuffers();
        queue.stop();
        queue.onBufferEnded = null;
        queue = null;
      }
      notifyIdle();
    },

    isPlaying: () => pending.size > 0 || decodingCount > 0,

    setOnIdle: (callback) => {
      onIdle = callback;
    },
    setOnError: (callback) => { onError = callback; },

    dispose: async () => {
      disposed = true;
      generation += 1;
      onIdle = null;
      onError = null;
      pending.clear();
      if (recorder) {
        recorder.clearOnAudioReady();
        await recorder.stop().catch(() => undefined);
        recorder = null;
      }
      if (queue) {
        queue.stop();
        queue.onBufferEnded = null;
        queue = null;
      }
      if (context) {
        await context.close().catch(() => undefined);
        context = null;
      }
      await AudioManager.setAudioSessionActivity(false).catch(() => undefined);
    },
  };
}
