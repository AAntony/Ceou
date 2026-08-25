import AsyncStorage from '@react-native-async-storage/async-storage';
import { colorScheme, useColorScheme } from 'nativewind';
import { shade } from './color';
import { createContext, useCallback, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { Platform, useColorScheme as useSystemColorScheme } from 'react-native';

export type ThemePreference = 'system' | 'light' | 'dark';

// Préférence D'APPAREIL, pas de compte. Deux raisons : on choisit le sombre
// pour un écran et un moment de la journée, pas pour son identité ; et un
// visiteur anonyme ne peut RIEN écrire en base (la RLS le lui refuse), donc
// une préférence rangée dans `profiles` lui serait tout simplement
// impossible à enregistrer.
const STORAGE_KEY = 'ceou.theme';

type ThemeContextValue = {
  preference: ThemePreference;
  isDark: boolean;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  preference: 'system',
  isDark: false,
  setPreference: () => {},
});

export function ThemeProvider({ children }: PropsWithChildren) {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  // Le thème RÉELLEMENT appliqué : en 'system' il suit le téléphone, et
  // change tout seul si l'appareil bascule pendant que l'app est ouverte.
  const { colorScheme: active } = useColorScheme();
  const systemScheme = useSystemColorScheme();

  // LE WEB NE SAIT PAS SUIVRE LE SYSTÈME TOUT SEUL. Sur mobile, ne rien
  // imposer suffit : NativeWind lit le réglage de l'appareil. Sur le web il
  // bascule ses variables sur la présence d'une classe "dark", que personne
  // ne pose tant qu'aucun choix explicite n'a été fait — l'app restait donc
  // claire dans un navigateur en thème sombre. Constaté dans l'aperçu, pas
  // deviné.
  useEffect(() => {
    if (Platform.OS !== 'web' || preference !== 'system') return;
    colorScheme.set(systemScheme === 'dark' ? 'dark' : 'light');
  }, [preference, systemScheme]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored !== 'light' && stored !== 'dark') return;
        setPreferenceState(stored);
        colorScheme.set(stored);
      })
      .catch(() => {
        // Lecture impossible : on reste sur le réglage du téléphone. Pas de
        // quoi alerter la personne, elle n'a rien à corriger.
      });
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    colorScheme.set(next);
    // 'system' n'est pas stocké mais EFFACÉ : c'est l'absence de choix, et
    // l'écrire reviendrait à figer aujourd'hui ce que le défaut pourrait
    // devenir demain.
    const write = next === 'system' ? AsyncStorage.removeItem(STORAGE_KEY) : AsyncStorage.setItem(STORAGE_KEY, next);
    write.catch(() => {});
  }, []);

  return (
    <ThemeContext.Provider value={{ preference, isDark: active === 'dark', setPreference }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

// LES MÊMES COULEURS QUE global.css, en JavaScript.
//
// Nécessaire parce qu'une partie de l'interface ne passe pas par des classes
// Tailwind : la couleur d'une icône, l'en-tête natif d'un écran, le rouleau
// de rafraîchissement, le canevas Skia d'un plan. Ces API-là veulent une
// chaîne de couleur, pas un nom de classe.
//
// LES DEUX TABLES DOIVENT RESTER D'ACCORD : une valeur changée ici et pas
// dans global.css (ou l'inverse) donne une icône qui jure avec le fond sur
// lequel elle est posée. Elles sont volontairement écrites avec les mêmes
// noms pour que la comparaison soit immédiate.
// Le type est ecrit a la main plutot que deduit de la table claire : deduit,
// il aurait fige les valeurs CLAIRES comme seules valeurs permises, et la
// table sombre aurait ete rejetee ligne par ligne.
export type ThemeColors = {
  sand: string;
  sandDark: string;
  surface: string;
  ink: string;
  inkSoft: string;
  inkFaint: string;
  accent: string;
  accentDark: string;
  accentLight: string;
  teal: string;
  tealDark: string;
  mustard: string;
  // Les deux teintes « foncées » de moutarde et de bleu ciel, qui n'existaient
  // qu'en classe Tailwind (bg-mustard-dark). Une icône vectorielle ne prend
  // pas de classe : elle veut une valeur, et elle doit changer avec le thème
  // comme le reste. Mêmes valeurs que global.css.
  mustardDark: string;
  skyDark: string;
  danger: string;
  ripple: string;
};

const LIGHT: ThemeColors = {
  sand: '#FFFBF8',
  sandDark: '#F5EEE6',
  surface: '#FFFFFF',
  ink: '#2D2A26',
  inkSoft: '#6B6459',
  inkFaint: '#A39C8F',
  // Les vives sont communes aux deux thèmes — d'où leur absence de la partie
  // sombre de global.css.
  accent: '#1591EA',
  accentDark: '#0B5E9E',
  accentLight: '#D8E8F3',
  teal: '#2EC4B6',
  tealDark: '#219488',
  mustard: '#FFC857',
  mustardDark: '#927028',
  skyDark: '#3F7BC0',
  danger: '#E2571F',
  ripple: 'rgba(45,42,38,0.08)',
};

const DARK: ThemeColors = {
  sand: '#191714',
  sandDark: '#26231F',
  surface: '#201E1A',
  ink: '#F4F0E9',
  inkSoft: '#A8A094',
  inkFaint: '#7A7369',
  accent: '#1591EA',
  accentDark: '#8FCBF7',
  accentLight: '#12324D',
  teal: '#2EC4B6',
  tealDark: '#6FDDD1',
  mustard: '#FFC857',
  mustardDark: '#F0C266',
  skyDark: '#9CC4F0',
  danger: '#FF8A5C',
  ripple: 'rgba(244,240,233,0.10)',
};

export function useThemeColors(): ThemeColors {
  const { isDark } = useTheme();
  return isDark ? DARK : LIGHT;
}

// LES COULEURS D'ENTITÉ (le pastel d'une Pièce, la teinte d'une carte) ne
// peuvent pas vivre dans les jetons : elles sont choisies par la personne, ou
// tirées d'une palette décorative. Elles doivent quand même s'adapter, sinon
// un fond pastel garde du texte clair par-dessus — illisible.
export function useEntityTints() {
  const { isDark } = useTheme();
  return {
    // Fond de carte : le pastel tel quel en clair ; très assombri en sombre,
    // où le texte posé dessus est devenu clair. La teinte reste reconnaissable,
    // c'est elle qui distingue une carte d'une autre.
    surfaceTint: (hex: string) => (isDark ? shade(hex, 0.82) : hex),
    // Icône posée sur une surface : le pastel brut serait trop pâle sur du
    // blanc, d'où l'assombrissement en clair — et exactement l'inverse sur
    // fond sombre, où c'est le pastel brut qui ressort.
    iconTint: (hex: string) => (isDark ? hex : shade(hex, 0.45)),
  };
}
