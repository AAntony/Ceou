import { File } from 'expo-file-system';
// `pdf-lib/cjs` ET NON `pdf-lib`, et ce n'est pas un detail de style.
// Le point d'entree par defaut renvoie vers la construction ES du paquet, qui
// importe `tslib` en export par defaut ; Metro ne lui en fabrique pas, et le
// bundle s'arrete au chargement sur « Cannot destructure property '__extends'
// of 'tslib.default' ». La construction CommonJS n'a pas ce probleme. Constate
// dans l'apercu, pas devine.
import { PDFDocument } from 'pdf-lib/cjs';

// LES FACTURES QUI ÉTAIENT DÉJÀ DES PDF, COLLÉES À LA FIN DU DOSSIER.
//
// CE QUE ÇA CORRIGE : l'export listait ces factures-là dans son récapitulatif
// puis écrivait « document PDF, à joindre séparément » — c'est-à-dire qu'il
// annonçait une preuve qu'il n'apportait pas. Envoyé à un assureur, ce
// dossier se présentait comme complet en étant troué.
//
// POURQUOI PAS À LEUR PLACE, chacune derrière son récapitulatif. Le
// récapitulatif est produit par l'imprimante du système à partir de HTML, qui
// ne sait pas incorporer un PDF — c'est la limite qui a créé le trou. On
// fusionne donc APRÈS l'impression, et une fusion ne sait qu'ajouter des
// pages à la suite. Elles arrivent dans l'ordre du récapitulatif, qui est
// celui de la liste, et chaque entrée concernée dit qu'elle est en fin de
// dossier.
//
// ⚠️ LES ANNEXES SE RASSEMBLENT AVANT QUE LE HTML NE SOIT ÉCRIT, et c'est
// tout l'intérêt de les accumuler dans un document à part plutôt que de les
// coller une à une à la fin. Un PDF illisible (protégé par mot de passe,
// tronqué par une coupure réseau) ne se découvre qu'en l'ouvrant : s'il se
// découvrait après l'impression, le récapitulatif aurait déjà promis une
// pièce jointe absente. En le découvrant avant, la ligne dit « document non
// joint », ce qui est vrai.

export type Annexe = {
  /**
   * Les pages accumulées, ou `null` quand il n'y en a aucune.
   *
   * Un document pdf-lib et non des octets : les pages n'ont à être décodées
   * qu'une fois, et `collerLesAnnexes` les recopie ensuite telles quelles.
   */
  pages: PDFDocument | null;
  /** Les identifiants de facture réellement joints. Le récapitulatif s'en sert. */
  jointes: Set<string>;
  /** Combien n'ont pas pu être lus — comptés avec les documents manquants. */
  echecs: number;
};

export async function rassemblerLesAnnexes(sources: { id: string; fichier: File }[]): Promise<Annexe> {
  const jointes = new Set<string>();
  let echecs = 0;

  if (sources.length === 0) return { pages: null, jointes, echecs };

  const pages = await PDFDocument.create();

  // UNE PAR UNE, jamais en parallèle — même règle que les images du
  // récapitulatif. Décoder six documents à la fois est précisément ce qui
  // fait tomber un export sur un téléphone d'entrée de gamme.
  for (const source of sources) {
    try {
      const document = await PDFDocument.load(await source.fichier.bytes());
      const copiees = await pages.copyPages(document, document.getPageIndices());
      for (const page of copiees) pages.addPage(page);
      jointes.add(source.id);
    } catch {
      // VOLONTAIREMENT MUET, et sans `ignoreEncryption`. Un PDF protégé se
      // charge avec cette option mais ses pages sortent illisibles : mieux
      // vaut une ligne qui dit « non joint » qu'une page de charabia
      // présentée comme une preuve d'achat.
      echecs += 1;
    }
  }

  return { pages: jointes.size > 0 ? pages : null, jointes, echecs };
}

/**
 * Recopie les annexes à la suite du dossier imprimé, en place.
 *
 * Le fichier est réécrit : c'est le même chemin qui repart ensuite vers le
 * mail ou la feuille de partage.
 */
export async function collerLesAnnexes(baseUri: string, annexe: Annexe): Promise<void> {
  if (!annexe.pages) return;

  const fichier = new File(baseUri);
  const dossier = await PDFDocument.load(await fichier.bytes());
  const copiees = await dossier.copyPages(annexe.pages, annexe.pages.getPageIndices());
  for (const page of copiees) dossier.addPage(page);
  fichier.write(await dossier.save());
}
