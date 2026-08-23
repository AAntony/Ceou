import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

// === Taille d'affichage des puces d'Emplacement ==========================
//
// Trois tailles, parce qu'un plan ne se lit pas de la même façon selon ce
// qu'on y cherche : S pour voir la structure du logement d'un coup d'œil, XL
// pour lire les rangements d'une pièce sans plisser les yeux.
//
// Chaque cran multiplie le PRÉCÉDENT par trois — c'est le rapport demandé, et
// il est franc : deux crans voisins ne se confondent jamais.
//
// Le TEXTE, lui, ne suit pas le même facteur (×2 puis ×3 au lieu de ×3 puis
// ×9). S'il grandissait comme la carte, exactement le même nombre de lettres
// tiendrait dans les trois tailles — agrandir la puce n'aurait alors rien
// apporté au nom, qui est justement ce qu'on agrandit pour lire. Le nom gagne
// donc de la place à chaque cran, et peut passer sur deux puis trois lignes.
export type PinSize = 'S' | 'M' | 'XL';

export const PIN_SIZES: PinSize[] = ['S', 'M', 'XL'];

export type PinMetrics = {
  cardWidth: number;
  cardHeight: number;
  icon: number;
  label: number;
  lineHeight: number;
  radius: number;
  border: number;
  padding: number;
  /** Lignes autorisées pour le nom. */
  lines: number;
  /** Plafond de lettres, ou `null` : le nom passe alors en entier. */
  maxChars: number | null;
  /** Diamètre du marqueur de localisation posé sur la puce. */
  marker: number;
};

export const PIN_METRICS: Record<PinSize, PinMetrics> = {
  S: {
    cardWidth: 54,
    cardHeight: 36,
    icon: 16,
    label: 8.5,
    lineHeight: 10,
    radius: 9,
    border: 1.5,
    padding: 4,
    lines: 1,
    maxChars: 8,
    marker: 20,
  },
  M: {
    cardWidth: 162,
    cardHeight: 108,
    icon: 48,
    label: 17,
    lineHeight: 20,
    radius: 27,
    border: 4.5,
    padding: 12,
    lines: 2,
    maxChars: null,
    marker: 60,
  },
  XL: {
    cardWidth: 486,
    cardHeight: 324,
    icon: 144,
    label: 25.5,
    lineHeight: 30,
    radius: 81,
    border: 13.5,
    padding: 36,
    lines: 3,
    maxChars: null,
    marker: 180,
  },
};

// Le choix se garde d'une session à l'autre, comme le thème : quelqu'un qui a
// besoin de XL en a besoin à chaque ouverture, pas seulement aujourd'hui.
const STORAGE_KEY = 'ceou.planPinSize';

export function usePinSize() {
  const [size, setSizeState] = useState<PinSize>('S');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored && (PIN_SIZES as string[]).includes(stored)) setSizeState(stored as PinSize);
      })
      .catch(() => {
        // Lecture impossible : on reste sur S. Rien à corriger côté
        // utilisateur, donc rien à signaler.
      });
  }, []);

  const setSize = useCallback((next: PinSize) => {
    setSizeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  return { size, setSize };
}
