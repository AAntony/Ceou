import AsyncStorage from '@react-native-async-storage/async-storage';
import { rem } from 'nativewind';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { AppState, PixelRatio } from 'react-native';

export type TextScalePreference = 'normal' | 'large' | 'huge';

export const TEXT_SCALE_PREFERENCES: TextScalePreference[] = ['normal', 'large', 'huge'];

// TROIS CRANS, pas un curseur continu. Un curseur demande de viser, et c'est
// justement la personne qui a du mal a lire l'ecran qui devrait le faire.
//
// Le pas de 30 % est celui qui se VOIT : plus petit, on ne sait pas si on a
// change quelque chose et on tape deux fois. 1,6 place le corps de texte a
// 22 px la ou le systeme Android s'arrete a 2,0 sur le texte seul — mais ici
// c'est l'interface ENTIERE qui grandit, rembourrages et pastilles compris,
// donc le meme confort sans les debordements.
export const TEXT_SCALE_FACTORS: Record<TextScalePreference, number> = {
  normal: 1,
  large: 1.3,
  huge: 1.6,
};

// PREFERENCE D'APPAREIL, pas de compte — meme raisonnement que le theme
// (voir lib/theme). On choisit une taille de texte pour SES yeux et POUR CET
// ECRAN ; et un visiteur anonyme ne peut rien ecrire dans `profiles`, la RLS
// le lui refuse.
const STORAGE_KEY = 'ceou.text-scale';

// Valeur de `rem` telle que la plateforme la pose AVANT toute intervention :
// 14 sur mobile (le corps de texte par defaut de React Native), la taille
// calculee de la racine sur le web. La LIRE plutot que d'ecrire 14 en dur,
// sinon le web repartirait de 14 au lieu de 16 et toute l'app y retrecirait
// d'un coup.
const BASE_REM = rem.get();

// SEUILS DE MISE EN PAGE, exprimes en grossissement REEL du texte (choix de
// l'app x reglage du telephone). Nommes ici plutot que recopies en litteral
// dans chaque ecran : ce sont des decisions de mise en page, elles doivent se
// relire au meme endroit.
//
// Ils s'appliquent au produit des deux echelles parce que le probleme est le
// meme des deux cotes : trois tuiles par rangee ne tiennent pas davantage
// parce que c'est Android qui a grossi le texte plutot que nous.
export const TWO_COLUMN_SCALE = 1.25;
export const ONE_COLUMN_SCALE = 1.6;
// Au-dela, un libelle et son bouton cessent de tenir cote a cote : ils
// passent l'un sous l'autre.
export const STACK_SCALE = 1.3;
// Au-dela, un nom sur une seule ligne n'est plus qu'un debut de nom.
export const WRAP_SCALE = 1.15;

type TextScaleContextValue = {
  preference: TextScalePreference;
  /** Zoom choisi DANS l'app. Texte, rembourrages, pastilles et icones. */
  factor: number;
  /** Reglage de taille de police du telephone. Texte uniquement. */
  osFontScale: number;
  /** Grossissement reellement subi par le texte : le produit des deux. */
  textScale: number;
  setPreference: (preference: TextScalePreference) => void;
};

const TextScaleContext = createContext<TextScaleContextValue>({
  preference: 'normal',
  factor: 1,
  osFontScale: 1,
  textScale: 1,
  setPreference: () => {},
});

export function TextScaleProvider({ children }: PropsWithChildren) {
  const [preference, setPreferenceState] = useState<TextScalePreference>('normal');
  const [osFontScale, setOsFontScale] = useState(() => PixelRatio.getFontScale());

  // Relu au RETOUR DANS L'APP, et pas a chaque rendu. Le parcours reel est
  // « je sors regler la taille de police du telephone, je reviens » : sans
  // cette relecture, l'app garderait la valeur d'avant jusqu'au prochain
  // demarrage a froid et les mises en page adaptatives resteraient calees
  // sur l'ancienne taille.
  //
  // Volontairement PAS useWindowDimensions, qui donne pourtant `fontScale` :
  // il se declenche aussi a chaque ouverture de clavier, et ce fournisseur
  // enveloppe l'app entiere — on la ferait re-rendre en entier a chaque
  // frappe dans un champ.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') setOsFontScale(PixelRatio.getFontScale());
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored !== 'large' && stored !== 'huge') return;
        setPreferenceState(stored);
      })
      .catch(() => {
        // Lecture impossible : on reste sur la taille normale. Personne n'a
        // rien a corriger, inutile d'alerter.
      });
  }, []);

  // TOUT PASSE PAR CETTE SEULE LIGNE.
  //
  // NativeWind exprime ses tailles Tailwind en `rem` et les resout a
  // l'execution contre cette valeur observable : `text-base`, mais aussi
  // `p-4`, `gap-2`, `h-12`, `rounded-2xl`. La deplacer agrandit donc le
  // texte ET la place qu'on lui a reservee, en une fois et partout.
  //
  // C'est ce qui evite la classe de bugs qu'on aurait eue en grossissant le
  // texte seul : un nom de 22 px dans une pastille dimensionnee pour du
  // 14 px deborde, et il aurait fallu le rattraper ecran par ecran.
  useEffect(() => {
    rem.set(BASE_REM * TEXT_SCALE_FACTORS[preference]);
  }, [preference]);

  const setPreference = useCallback((next: TextScalePreference) => {
    setPreferenceState(next);
    // 'normal' n'est pas stocke mais EFFACE : c'est l'absence de choix, et
    // l'ecrire figerait aujourd'hui ce que le defaut pourrait devenir.
    const write =
      next === 'normal' ? AsyncStorage.removeItem(STORAGE_KEY) : AsyncStorage.setItem(STORAGE_KEY, next);
    write.catch(() => {});
  }, []);

  const value = useMemo<TextScaleContextValue>(() => {
    const factor = TEXT_SCALE_FACTORS[preference];
    return { preference, factor, osFontScale, textScale: factor * osFontScale, setPreference };
  }, [preference, osFontScale, setPreference]);

  return <TextScaleContext.Provider value={value}>{children}</TextScaleContext.Provider>;
}

export function useTextScale() {
  return useContext(TextScaleContext);
}

/**
 * Met une valeur EN PIXELS a l'echelle du zoom choisi dans l'app.
 *
 * Pour tout ce qui ne passe pas par une classe Tailwind et echappe donc a
 * `rem` : la taille d'une icone, la vignette d'une rangee, le diametre d'un
 * avatar. Volontairement indexe sur `factor` seul et NON sur `textScale` :
 * `factor` est aussi ce qui deplace `rem`, donc une icone mise a l'echelle
 * de cette facon reste synchrone avec le rembourrage qui l'entoure. La
 * suivre sur le reglage du telephone, lui, la ferait grossir dans un cadre
 * qui, lui, n'a pas bouge.
 */
export function useScaled(size: number): number {
  const { factor } = useTextScale();
  return Math.round(size * factor);
}
