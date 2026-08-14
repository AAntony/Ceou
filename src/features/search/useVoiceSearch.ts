import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useState } from 'react';
import { Alert } from 'react-native';
import i18n from '../../lib/i18n';

const LOCALE_BY_LANGUAGE: Record<string, string> = {
  fr: 'fr-FR',
  en: 'en-US',
};

// Codes qu'un utilisateur peut déclencher sans que ce soit une vraie panne
// (silence, appui répété sur le micro) — pas la peine de les remonter par
// une alerte, contrairement à un vrai problème de permission/réseau.
const SILENT_ERROR_CODES = new Set(['no-speech', 'aborted', 'speech-timeout']);

// Recherche à la voix pour le champ de recherche du tableau de bord :
// résultat (même partiel) reversé directement dans le texte de recherche
// déjà réactif, donc la liste se filtre en direct pendant que l'utilisateur
// parle — pas de logique de correspondance séparée à maintenir.
export function useVoiceSearch(onResult: (text: string) => void) {
  const [isListening, setIsListening] = useState(false);

  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript;
    if (transcript) onResult(transcript);
  });

  useSpeechRecognitionEvent('end', () => setIsListening(false));

  useSpeechRecognitionEvent('error', (event) => {
    setIsListening(false);
    if (!SILENT_ERROR_CODES.has(event.error)) {
      Alert.alert(i18n.t('home.voice_search_error'));
    }
  });

  const start = async () => {
    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) {
      Alert.alert(i18n.t('home.voice_search_permission_message'));
      return;
    }
    setIsListening(true);
    ExpoSpeechRecognitionModule.start({
      lang: LOCALE_BY_LANGUAGE[i18n.language] ?? 'fr-FR',
      interimResults: true,
      continuous: false,
    });
  };

  const stop = () => ExpoSpeechRecognitionModule.stop();

  return { isListening, start, stop };
}
