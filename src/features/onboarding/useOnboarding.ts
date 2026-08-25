import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useIsAnonymous, useSession } from '../auth/SessionProvider';
import { useHabitations } from '../inventory/queries';
import { useProfile } from '../profile/useProfile';
import { useSplashGate } from '../../lib/splashGate';
import { supabase } from '../../lib/supabase/client';

// QUAND LE GUIDE S'OUVRE TOUT SEUL, ET QUAND IL SE TAIT.
//
// Le besoin vient d'un test réel : quelqu'un installe l'app, arrive sur
// l'accueil — qui est un écran de RECHERCHE — et n'a rien à y chercher.
// L'écran ne dit ni par où commencer, ni à quoi sert l'app. Le guide comble
// exactement ce trou, donc il s'ouvre là où le trou se trouve : au premier
// lancement, sur l'accueil.
//
// TROIS CONDITIONS, toutes nécessaires :
//
// - Ce n'est pas un VISITEUR. Une session anonyme n'a le droit d'écrire nulle
//   part (la RLS le refuse) : lui proposer de créer son logement serait lui
//   promettre ce que le serveur va refuser.
// - La personne ne possède AUCUNE habitation. C'est le seul signal honnête de
//   « première utilisation » : il vaut aussi pour les comptes créés avant que
//   ce guide n'existe, sans rien avoir à rattraper en base.
// - Le guide n'a jamais été terminé NI passé (voir les deux verrous plus bas).
//
// Une habitation PARTAGÉE par un ami ne compte pas : recevoir un accès n'est
// pas avoir rangé chez soi, et c'est précisément quelqu'un qui découvre l'app.

const STORAGE_KEY = 'ceou.onboarding-done';

// DEUX VERROUS, parce qu'il y a deux questions différentes.
//
// Le verrou LOCAL (AsyncStorage) répond à « est-ce que je viens de le
// fermer ? ». Il est instantané, marche hors ligne, et ne dépend d'aucune
// colonne : c'est lui qui garantit que le guide ne se rouvre pas en boucle,
// quoi qu'il arrive côté serveur.
//
// Le verrou DISTANT (profiles.onboarding_done_at) répond à « est-ce que je
// l'ai déjà vu un jour ? ». C'est lui qui évite de réimposer le guide après
// une réinstallation ou sur un nouveau téléphone.
//
// L'écriture distante est VOLONTAIREMENT sans conséquence en cas d'échec : la
// colonne peut ne pas encore exister sur le projet (migration non poussée),
// et un guide terminé ne doit surtout pas se rouvrir pour autant. Le verrou
// local, lui, a déjà fait le travail.

async function readLocalLatch(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(STORAGE_KEY)) === '1';
  } catch {
    // Lecture impossible : on considère que le guide n'a pas été vu. Au pire
    // il s'ouvre une fois de trop, et il se ferme en un geste.
    return false;
  }
}

export function useMarkOnboardingDone() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: async () => {
      await AsyncStorage.setItem(STORAGE_KEY, '1').catch(() => {});
      if (!userId) return;
      // Sans `throw` : voir plus haut, l'échec distant ne doit rien casser.
      await supabase
        .from('profiles')
        .update({ onboarding_done_at: new Date().toISOString() })
        .eq('id', userId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile', userId] }),
  });
}

/**
 * Pilote l'ouverture du guide sur l'accueil.
 *
 * `open` est un ÉTAT LOCAL, pas une condition recalculée à chaque rendu — et
 * c'est indispensable : dès l'étape « ton logement », la personne possède une
 * habitation, donc la condition d'ouverture devient fausse. Reliée
 * directement à l'affichage, elle refermerait le guide au milieu.
 */
export function useOnboardingLaunch() {
  const isGuest = useIsAnonymous();
  const { session } = useSession();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: habitations, isLoading: habitationsLoading } = useHabitations();
  const markDone = useMarkOnboardingDone();

  const [localLatch, setLocalLatch] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    readLocalLatch().then((seen) => {
      if (alive) setLocalLatch(seen);
    });
    return () => {
      alive = false;
    };
  }, []);

  const [open, setOpen] = useState(false);
  // Une seule ouverture automatique par session d'application : refermer le
  // guide ne doit pas le laisser se rouvrir au prochain rendu, avant même que
  // le verrou local n'ait été relu.
  const autoOpened = useRef(false);

  // Un Modal passe au-dessus du calque de démarrage : sans cette condition,
  // le guide s'ouvrirait pendant l'animation d'ouverture, qui dure plus
  // longtemps que les deux requêtes ci-dessus.
  const { splashDone } = useSplashGate();

  const ownsNothing = (habitations ?? []).every((habitation) => habitation.user_id !== session?.user.id);
  const ready = localLatch !== null && !profileLoading && !habitationsLoading && splashDone;
  const shouldAutoOpen =
    ready && !isGuest && !localLatch && !profile?.onboarding_done_at && ownsNothing;

  useEffect(() => {
    if (!shouldAutoOpen || autoOpened.current) return;
    autoOpened.current = true;
    setOpen(true);
  }, [shouldAutoOpen]);

  const close = useCallback(() => {
    setOpen(false);
    setLocalLatch(true);
    markDone.mutate();
  }, [markDone]);

  // « Revoir le guide » : rouvre sans rien réinitialiser. Le guide sait
  // travailler avec un inventaire déjà rempli (il propose ce qui existe
  // plutôt que de forcer une création).
  const start = useCallback(() => {
    autoOpened.current = true;
    setOpen(true);
  }, []);

  return {
    open,
    start,
    close,
    /**
     * Vrai quand l'accueil est vide ET que le guide n'est pas déjà ouvert :
     * l'écran d'accueil y accroche son invitation « Découvrir Ceou », pour
     * que quelqu'un qui a passé le guide puisse encore le retrouver.
     */
    canOffer: ready && !isGuest && ownsNothing && !open,
  };
}
