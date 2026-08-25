import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';

// « L'ÉCRAN DE DÉMARRAGE A FINI DE JOUER » — une information que personne
// n'avait besoin de connaître jusqu'ici, et qui le devient dès qu'une fenêtre
// peut s'ouvrir toute seule.
//
// Le calque du splash est rendu par la racine, donc au-dessus de tous les
// écrans. Un `Modal` de React Native, LUI, ouvre sa propre fenêtre native et
// passe au-dessus de tout, splash compris. Or le guide de démarrage remplit
// ses conditions d'ouverture (session lue, profil et habitations chargés) en
// quelques centaines de millisecondes, quand le splash, lui, dure environ
// deux secondes : sans cette barrière, le guide s'ouvrirait par-dessus
// l'animation d'ouverture, à peu près à chaque premier lancement.
//
// La valeur par défaut est `true` : hors du fournisseur, rien ne doit rester
// bloqué en attendant un signal qui n'arrivera jamais.

type SplashGateValue = {
  splashDone: boolean;
  markSplashDone: () => void;
};

const SplashGateContext = createContext<SplashGateValue>({ splashDone: true, markSplashDone: () => {} });

export function SplashGateProvider({ children }: PropsWithChildren) {
  const [splashDone, setSplashDone] = useState(false);
  const value = useMemo<SplashGateValue>(
    () => ({ splashDone, markSplashDone: () => setSplashDone(true) }),
    [splashDone],
  );
  return <SplashGateContext.Provider value={value}>{children}</SplashGateContext.Provider>;
}

export function useSplashGate(): SplashGateValue {
  return useContext(SplashGateContext);
}
