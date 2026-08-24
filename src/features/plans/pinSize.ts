import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

// === Taille d'affichage des puces d'Emplacement ==========================
//
// Trois tailles, parce qu'un plan ne se lit pas de la même façon selon ce
// qu'on y cherche : S pour voir la structure du logement d'un coup d'œil, XL
// pour lire les rangements d'une pièce sans plisser les yeux.
//
// Les crans montent d'environ moitié à chaque fois (×1,5 puis ×1,3), et non
// plus ×3 puis ×9 : à ce rythme-là, M dépassait déjà la largeur d'une chambre
// et XL était plus grand que n'importe quelle pièce du plan. Une puce doit
// tenir DANS la pièce qu'elle habite — c'est la contrainte qui fixe l'échelle,
// pas un rapport choisi à l'avance.
//
// Le TEXTE ne suit pas le même facteur que la carte. S'il grandissait comme
// elle, exactement le même nombre de lettres tiendrait dans les trois tailles
// — agrandir la puce n'aurait alors rien apporté au nom, qui est justement ce
// qu'on agrandit pour lire. Le nom gagne donc de la place à chaque cran, et
// passe sur deux lignes dès M.
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
    cardWidth: 82,
    cardHeight: 58,
    icon: 24,
    label: 11.5,
    lineHeight: 13.5,
    radius: 11,
    border: 2,
    padding: 5,
    lines: 2,
    maxChars: null,
    marker: 28,
  },
  XL: {
    cardWidth: 108,
    cardHeight: 74,
    icon: 34,
    label: 14,
    lineHeight: 16,
    radius: 15,
    border: 2.5,
    padding: 7,
    lines: 2,
    maxChars: null,
    marker: 38,
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
