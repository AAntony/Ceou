import { useCallback, useState } from 'react';

// L'OUVERTURE D'UNE FEUILLE DE FACTURE, ET SON REMONTAGE.
//
// Six lignes, mais elles portent un piège qui s'est présenté trois fois — sur
// la fiche d'un objet, dans la liste des objets sans preuve, et dans le
// dossier d'un logement. Autant l'écrire une fois.
//
// LE PIÈGE : `FactureFormSheet` lit ses valeurs initiales À LA CONSTRUCTION,
// délibérément (un effet de réinitialisation provoquait un rendu en cascade).
// Tant qu'elle reste montée, rouvrir la feuille ne relit donc rien : on
// enregistre une facture, on en ouvre une deuxième, et le vendeur de la
// première est encore dans le champ. Le compteur d'ouvertures posé en `key`
// force React à remonter la feuille, donc à relire.
//
// Pourquoi ne pas simplement démonter la feuille quand elle se ferme : elle
// perdrait son animation de sortie, et l'écran donnerait l'impression de
// sauter à chaque enregistrement.

export function useFeuilleFacture() {
  const [visible, setVisible] = useState(false);
  const [ouvertures, setOuvertures] = useState(0);

  // STABLES, parce qu'un appelant les met en dépendance d'un `useCallback` :
  // la liste des objets sans preuve mémorise son `renderItem`, et des
  // fonctions recréées à chaque rendu le feraient retravailler pour rien.
  const ouvrir = useCallback(() => {
    setOuvertures((n) => n + 1);
    setVisible(true);
  }, []);
  const fermer = useCallback(() => setVisible(false), []);

  return {
    visible,
    /** À poser en `key` sur la feuille : c'est elle qui force la relecture. */
    cle: ouvertures,
    ouvrir,
    fermer,
  };
}
