import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

// CE QU'ON A DÉJÀ LU.
//
// PRÉFÉRENCE D'APPAREIL, PAS DE COMPTE — même raison que le thème et la
// taille du texte (voir lib/theme) : c'est un état de LECTURE, il n'a rien à
// faire dans un profil, et un visiteur anonyme ne peut rien écrire en base,
// la RLS le lui refuse. Il vit donc sur le téléphone.
//
// UN MAGASIN DE MODULE plutôt qu'un état par écran : le sommaire et le
// chapitre sont deux routes distinctes, et marquer un chapitre lu doit se
// voir sur le sommaire dès qu'on y revient — sans le relire du disque, donc
// sans le clignotement d'une case qui se coche après coup.
//
// LA LECTURE DU DISQUE EST DÉCLENCHÉE UNE FOIS, au premier abonnement. Avant
// qu'elle n'aboutisse, l'ensemble est vide : rien n'est affiché comme lu, ce
// qui est le bon défaut — annoncer un chapitre lu à tort le ferait sauter.

const STORAGE_KEY = 'ceou.tutoriels.lus';

let lus: ReadonlySet<string> = new Set();
let charge = false;
const listeners = new Set<() => void>();

function publier(suivant: ReadonlySet<string>) {
  lus = suivant;
  listeners.forEach((listener) => listener());
}

function charger() {
  if (charge) return;
  charge = true;
  AsyncStorage.getItem(STORAGE_KEY)
    .then((brut) => {
      if (!brut) return;
      const valeur: unknown = JSON.parse(brut);
      if (Array.isArray(valeur)) publier(new Set(valeur.filter((id): id is string => typeof id === 'string')));
    })
    .catch(() => {
      // Lecture impossible, ou contenu illisible écrit par une version d'avant :
      // on repart d'une progression vide. Personne n'a rien à corriger.
    });
}

function souscrire(listener: () => void): () => void {
  charger();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function lire(): ReadonlySet<string> {
  return lus;
}

/** Les chapitres déjà lus. L'ensemble ne change d'identité qu'à l'écriture. */
export function useChapitresLus(): ReadonlySet<string> {
  return useSyncExternalStore(souscrire, lire, lire);
}

export function marquerLu(id: string): void {
  if (lus.has(id)) return;
  const suivant = new Set(lus);
  suivant.add(id);
  publier(suivant);
  ecrire(suivant);
}

export function marquerNonLu(id: string): void {
  if (!lus.has(id)) return;
  const suivant = new Set(lus);
  suivant.delete(id);
  publier(suivant);
  ecrire(suivant);
}

function ecrire(valeur: ReadonlySet<string>) {
  // L'ÉCRAN N'ATTEND PAS LE DISQUE. La coche est déjà retournée quand
  // l'écriture part ; si elle échoue, on perd une progression de lecture,
  // pas une donnée.
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...valeur])).catch(() => {});
}
