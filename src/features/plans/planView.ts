import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

// === Plan dessiné ou plan en liste =======================================
//
// Deux façons de lire le même niveau. Le canevas répond « où », la liste
// répond la même chose en phrases — et elle est la SEULE des deux qu'un
// lecteur d'écran sache restituer, ou qu'on puisse parcourir sans pincer ni
// glisser.
//
// LE CHOIX SE GARDE D'UNE SESSION À L'AUTRE, comme la taille des puces et le
// thème. C'est même plus vrai ici : quelqu'un qui a besoin de la liste en a
// besoin à chaque ouverture de chaque plan. La lui faire redemander à chaque
// fois aurait suffi à rendre le travail inutile.
export type PlanView = 'plan' | 'list';

const VIEWS: PlanView[] = ['plan', 'list'];

const STORAGE_KEY = 'ceou.planView';

export function usePlanView() {
  const [view, setViewState] = useState<PlanView>('plan');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored && (VIEWS as string[]).includes(stored)) setViewState(stored as PlanView);
      })
      .catch(() => {
        // Lecture impossible : on reste sur le plan dessiné. Rien à corriger
        // côté utilisateur, donc rien à signaler.
      });
  }, []);

  const setView = useCallback((next: PlanView) => {
    setViewState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  return { view, setView };
}
