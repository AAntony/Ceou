import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import fr from './locales/fr.json';

export const SUPPORTED_LANGUAGES = ['fr', 'en'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const deviceLanguage = getLocales()[0]?.languageCode;
const initialLanguage: SupportedLanguage = SUPPORTED_LANGUAGES.includes(deviceLanguage as SupportedLanguage)
  ? (deviceLanguage as SupportedLanguage)
  : 'fr';

i18n.use(initReactI18next).init({
  resources: {
    fr: { translation: fr },
    en: { translation: en },
  },
  lng: initialLanguage,
  fallbackLng: 'fr',
  interpolation: { escapeValue: false },
});

export default i18n;
