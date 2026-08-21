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

const LOCALE_BY_LANGUAGE: Record<string, string> = {
  fr: 'fr-FR',
  en: 'en-US',
};

type SpeechModule = {
  speak: (text: string, options?: { language?: string; rate?: number; pitch?: number }) => void;
  stop: () => void;
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

export function speak(text: string, language: string): void {
  const speech = speechModule();
  if (!speech || !text.trim()) return;

  try {
    speech.stop();
    speech.speak(text, {
      language: LOCALE_BY_LANGUAGE[language.slice(0, 2)] ?? LOCALE_BY_LANGUAGE.fr,
      // Légèrement ralenti : la réponse contient des noms propres de pièces et
      // de meubles, que la voix par défaut enchaîne trop vite pour être
      // comprise du premier coup.
      rate: 0.95,
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
