import type { IconName } from '../../components/Icon';

// LE SOMMAIRE DES TUTORIELS, DÉCLARÉ À UN SEUL ENDROIT.
//
// POURQUOI CE FICHIER EXISTE À CÔTÉ DU GUIDE DE DÉMARRAGE, et ne le remplace
// pas : le guide FAIT FAIRE — il crée une vraie habitation, une vraie pièce,
// un vrai objet, en deux minutes et une seule fois. Ces tutoriels-ci se
// RELISENT : on y revient trois semaines plus tard pour comprendre comment
// un même ticket de caisse couvre quatre chaises. Un même écran ne peut pas
// être les deux à la fois, et le premier chapitre renvoie d'ailleurs au
// guide plutôt que de le réécrire.
//
// TOUT LE TEXTE EST DANS i18n, jamais ici : ce module ne porte que la
// STRUCTURE — l'ordre des chapitres, leur icône, et quelle démonstration
// accompagne quelle étape. Le contenu se relit et se corrige dans fr.json et
// en.json, côte à côte, sans toucher au code.
//
// L'ORDRE DU TABLEAU EST L'ORDRE DE LECTURE, et c'est aussi lui qui décide de
// « précédent » et « suivant ». Il va du geste qu'on fait le premier jour à
// ceux qu'on découvre ensuite.

/** Les mini-écrans simulés. Voir Demos.tsx pour ce que chacun dessine. */
export type DemoId = 'rangement' | 'recherche' | 'tuile-facture' | 'dossier' | 'export';

export type Chapitre = {
  /** Sert de segment d'URL et de racine de clé i18n (`tutoriels.chapters.<id>`). */
  id: string;
  icon: IconName;
  /** Posée en tête du chapitre : on voit de quoi on parle avant de lire. */
  demo: DemoId;
  /**
   * Une démonstration attachée à une étape précise, par son rang (0 = la
   * première). C'est ce qui permet de montrer LE bouton dont parle l'étape,
   * au moment où on la lit, plutôt qu'une capture générale en haut de page.
   */
  demosEtapes?: Record<number, DemoId>;
  /**
   * Le chapitre peut rendre la main à quelque chose de réel.
   *
   * `guide` relance le guide de démarrage : lire comment on range est utile,
   * le faire l'est davantage.
   */
  action?: 'guide';
};

export const CHAPITRES: Chapitre[] = [
  {
    id: 'demarrer',
    icon: 'guide',
    demo: 'rangement',
    demosEtapes: { 4: 'recherche' },
    action: 'guide',
  },
  {
    id: 'factures',
    icon: 'facture',
    demo: 'tuile-facture',
    demosEtapes: { 3: 'dossier', 5: 'export' },
  },
];

export function chapitreParId(id: string | undefined): Chapitre | undefined {
  return CHAPITRES.find((chapitre) => chapitre.id === id);
}

/**
 * Le chapitre d'avant et celui d'après.
 *
 * Rendus ensemble parce qu'ils se lisent ensemble, en bas de chaque
 * chapitre : c'est la seule navigation qui compte une fois qu'on a commencé à
 * lire, et elle doit dire OÙ elle mène, pas seulement « suivant ».
 */
export function voisins(id: string): { precedent?: Chapitre; suivant?: Chapitre } {
  const rang = CHAPITRES.findIndex((chapitre) => chapitre.id === id);
  if (rang === -1) return {};
  return { precedent: CHAPITRES[rang - 1], suivant: CHAPITRES[rang + 1] };
}

/** Le rang de lecture, pour l'afficher (« 2 sur 10 ») sans recompter partout. */
export function rangDe(id: string): number {
  return CHAPITRES.findIndex((chapitre) => chapitre.id === id) + 1;
}

/** La racine de clé i18n d'un chapitre. Écrite une fois plutôt qu'à chaque lecture. */
export function cleDe(chapitre: Chapitre, suffixe: string): string {
  return `tutoriels.chapters.${chapitre.id}.${suffixe}`;
}
