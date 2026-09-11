// LES BOITES DE DIALOGUE DE L'APP.
//
// Elles passaient toutes par `Alert.alert`, c'est-a-dire par la boite du
// SYSTEME : coins carres d'Android, police et couleurs du telephone, aucun
// rapport avec le reste de l'ecran dont elles sortent. Un retour utilisateur
// l'a dit sans detour — « on dirait des alert javascript ». Et au-dela de
// l'allure, cette boite-la ne se ferme pas quand on appuie a cote, alors que
// TOUTES les feuilles de l'app le font (voir BottomSheetModal) : la seule
// fenetre de l'app a ne pas obeir au geste qu'on y a appris.
//
// Ce module ne porte QUE la demande. Le dessin est dans AppDialogHost, monte
// une fois a la racine — c'est ce qui permet d'ouvrir une boite depuis un
// hook, un module sans composant (useAssistant, useExportFactures) ou le
// fond d'un `catch`, exactement comme `Alert.alert` le permettait. Sans ce
// relais, chaque appelant devrait porter un etat `visible` et un composant,
// et les trente appels d'aujourd'hui ne migreraient jamais.
//
// LES LIBELLES ARRIVENT DEJA TRADUITS, comme ceux d'`Alert.alert`. Ce fichier
// ignore i18n : une demande posee ici est une demande d'AFFICHAGE, pas une
// cle a resoudre, et l'appelant a deja son `t` sous la main.

export type DialogAction = {
  label: string;
  /** Peut etre asynchrone : la fiche Objet attend la suppression avant de revenir en arriere. */
  onPress?: () => void | Promise<void>;
  /** Le geste irreversible : peint en rouge, et fait apparaitre la pastille d'alerte. */
  destructive?: boolean;
  /** La porte de sortie. Sans fond, et remise en DERNIER quel que soit l'ordre donne. */
  cancel?: boolean;
};

export type DialogRequest = {
  /** Une question ou un verdict court. Absent pour une simple notification. */
  title?: string;
  /** Ce que le geste entraine. Sous le titre, ou seul (voir `showMessage`). */
  message?: string;
  /** Vide = un seul bouton « Fermer », pose par l'hote pour rester traduit. */
  actions?: DialogAction[];
  /**
   * Appele quand la boite se ferme SANS choix : appui a cote, bouton Retour
   * d'Android. Indispensable des qu'une promesse attend la reponse — sinon
   * l'appui a cote la laisse en suspens pour toujours.
   */
  onDismiss?: () => void;
};

// UNE FILE, PAS UNE SEULE BOITE. Une action de boite peut en ouvrir une autre
// (« Supprimer » -> echec -> « Une erreur est survenue »), et deux erreurs
// peuvent tomber coup sur coup. Empilees, la fenetre ne se ferme jamais entre
// les deux : elle change de contenu. Remplacer l'une par l'autre aurait fait
// disparaitre un message sans que personne ne l'ait lu.
let queue: readonly DialogRequest[] = [];
const listeners = new Set<() => void>();

function publish(next: readonly DialogRequest[]) {
  queue = next;
  listeners.forEach((listener) => listener());
}

export function showDialog(request: DialogRequest): void {
  publish([...queue, request]);
}

/** Une phrase et un bouton pour la refermer — ce que faisait une alerte a un seul argument. */
export function showMessage(message: string): void {
  showDialog({ message });
}

export function subscribeToDialogs(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// L'identite du tableau ne change QUE sur `publish` : c'est ce que
// `useSyncExternalStore` exige pour ne pas rendre en boucle.
export function getDialogQueue(): readonly DialogRequest[] {
  return queue;
}

export function closeTopDialog(): void {
  publish(queue.slice(1));
}
