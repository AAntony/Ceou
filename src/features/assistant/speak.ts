// Synthèse vocale, volontairement défensive.
//
// `expo-speech` est un module NATIF : il n'existe que dans un build qui l'a
// compilé. Or les mises à jour de l'app partent en OTA, sur des appareils qui
// tournent encore un build antérieur. Sans ce garde-fou, la première réponse
// de l'assistant ferait planter l'app chez tous ceux qui n'ont pas encore
// réinstallé — un crash pour une fonctionnalité de confort, c'est le pire
// rapport risque/valeur possible.
//
// Ici, l'absence du module natif se traduit simplement par un assistant qui
// affiche sa réponse sans la dire.
//
// CHOIX DE LA VOIX (retour utilisateur du 2026-08-21 : « la voix est très
// robotique »). Android n'a pas UNE voix mais une liste, et la voix par
// défaut est presque toujours la moins bonne : une voix embarquée
// concaténative, celle qui sonne effectivement synthétique. Les moteurs
// Google exposent à côté des voix neuronales bien plus naturelles,
// reconnaissables à leur identifiant (`-network`) ou à leur qualité
// déclarée (`Enhanced`). On les préfère explicitement au lieu de laisser le
// système décider — c'est tout l'écart entre « robotique » et « acceptable ».

const LOCALE_BY_LANGUAGE: Record<string, string> = {
  fr: 'fr-FR',
  en: 'en-US',
};

type Voice = { identifier: string; name: string; quality: string; language: string };

type SpeakOptions = {
  language?: string;
  rate?: number;
  pitch?: number;
  voice?: string;
  onError?: (error: Error) => void;
};

type SpeechModule = {
  speak: (text: string, options?: SpeakOptions) => void;
  stop: () => void;
  getAvailableVoicesAsync?: () => Promise<Voice[]>;
};

let cached: SpeechModule | null | undefined;

/**
 * Charge le module une seule fois, et retient l'échec.
 *
 * `require` paresseux plutôt qu'un import en tête de fichier : un import
 * statique s'évalue au chargement du module, donc au démarrage de l'écran,
 * bien avant qu'on sache si on aura besoin de parler.
 */
function speechModule(): SpeechModule | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('expo-speech') as SpeechModule;
  } catch {
    cached = null;
  }
  return cached;
}

/** Vrai si l'appareil peut réellement parler (build récent). */
export function isSpeechAvailable(): boolean {
  return speechModule() !== null;
}

/**
 * Classe une voix pour une langue donnée. -1 = mauvaise langue, à écarter.
 *
 * Les poids sont volontairement écartés les uns des autres : une voix réseau
 * doit gagner contre une voix locale même si cette dernière est marquée
 * `Enhanced`, parce que c'est le critère qui s'entend le plus.
 */
function scoreVoice(voice: Voice, prefix: string, preferredLocale: string): number {
  const language = (voice.language ?? '').toLowerCase().replace('_', '-');
  if (!language.startsWith(prefix)) return -1;

  const identifier = (voice.identifier ?? '').toLowerCase();
  let score = 0;
  if (identifier.includes('network')) score += 40;
  if (voice.quality === 'Enhanced') score += 30;
  // Une voix locale explicite reste préférable à une voix non étiquetée, dont
  // on ne sait rien.
  if (identifier.includes('local')) score += 5;
  // fr-FR plutôt que fr-CA quand l'app est en français.
  if (language === preferredLocale.toLowerCase()) score += 10;
  return score;
}

// Une entrée par langue. `null` = liste consultée, aucune voix satisfaisante
// (on laissera alors le système choisir), `undefined` = pas encore consultée.
const voiceByLanguage = new Map<string, string | null>();

async function bestVoice(speech: SpeechModule, prefix: string, preferredLocale: string): Promise<string | undefined> {
  const known = voiceByLanguage.get(prefix);
  if (known !== undefined) return known ?? undefined;

  if (!speech.getAvailableVoicesAsync) {
    voiceByLanguage.set(prefix, null);
    return undefined;
  }

  try {
    const voices = await speech.getAvailableVoicesAsync();
    const best = voices
      .map((voice) => ({ voice, score: scoreVoice(voice, prefix, preferredLocale) }))
      .filter((candidate) => candidate.score >= 0)
      .sort((a, b) => b.score - a.score)[0];
    voiceByLanguage.set(prefix, best?.voice.identifier ?? null);
    return best?.voice.identifier;
  } catch {
    // Certains appareils refusent d'énumérer avant que le moteur TTS ne soit
    // initialisé. On n'insiste pas : parler avec la voix par défaut vaut
    // mieux que ne pas parler.
    voiceByLanguage.set(prefix, null);
    return undefined;
  }
}

/**
 * Fait chauffer la liste des voix pendant que l'utilisateur parle.
 *
 * L'énumération prend un instant sur Android ; la déclencher au moment de
 * répondre ajouterait ce délai juste avant la réponse, là où il s'entend.
 */
export function primeVoices(language: string): void {
  const speech = speechModule();
  if (!speech) return;
  const prefix = language.slice(0, 2);
  void bestVoice(speech, prefix, LOCALE_BY_LANGUAGE[prefix] ?? LOCALE_BY_LANGUAGE.fr);
}

export async function speak(text: string, language: string): Promise<void> {
  const speech = speechModule();
  if (!speech || !text.trim()) return;

  const prefix = language.slice(0, 2);
  const locale = LOCALE_BY_LANGUAGE[prefix] ?? LOCALE_BY_LANGUAGE.fr;
  const voice = await bestVoice(speech, prefix, locale);

  try {
    speech.stop();
    speech.speak(text, {
      language: locale,
      voice,
      // Débit et hauteur naturels. Une version précédente ralentissait à 0.95
      // pour la clarté : sur les voix embarquées, ralentir accentue en fait
      // l'effet robotique en étirant chaque phonème. Avec une bonne voix, le
      // débit normal est plus intelligible.
      rate: 1.0,
      pitch: 1.0,
      // Les voix réseau ont besoin de connectivité. Hors ligne, elles
      // échouent sans rien dire — on rejoue alors avec la voix par défaut
      // plutôt que de laisser l'assistant muet.
      onError: voice
        ? () => {
            voiceByLanguage.set(prefix, null);
            try {
              speech.speak(text, { language: locale, rate: 1.0, pitch: 1.0 });
            } catch {
              // Plus rien à tenter.
            }
          }
        : undefined,
    });
  } catch {
    // Module présent mais synthèse indisponible (voix non installée sur
    // l'appareil, par exemple) : on n'a rien de mieux à proposer que le
    // silence, et surtout pas une alerte à chaque réponse.
  }
}

export function stopSpeaking(): void {
  const speech = speechModule();
  if (!speech) return;
  try {
    speech.stop();
  } catch {
    // Rien à faire : on demandait juste le silence.
  }
}
