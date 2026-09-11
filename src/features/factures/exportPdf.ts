import { Directory, File, Paths } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as Print from 'expo-print';
import { getImageSize } from '../../lib/images/pickAndUploadImage';
import { parseStoredMedia } from '../../lib/images/media';
import { signMedia } from '../../lib/images/signMedia';

// LE DOSSIER QU'ON ENVOIE À UN ASSUREUR, EN UN SEUL FICHIER.
//
// ═══ CE QUE LE PDF CONTIENT, ET POURQUOI DANS CET ORDRE ═══
//
// Une première page RÉCAPITULATIVE — un tableau objet / vendeur / date /
// montant, et le total — puis une page par facture, document à l'appui. Ce
// n'est pas un choix esthétique : un assureur ne demande pas des photos, il
// demande une liste chiffrée. Les images sont la PREUVE de cette liste, pas
// le document lui-même. Quelqu'un qui reçoit ce fichier doit pouvoir lire le
// montant total sans faire défiler quarante pages.
//
// ═══ POURQUOI LES IMAGES SONT ENCODÉES EN BASE64 ═══
//
// Deux raisons qui se cumulent, et aucune n'est contournable :
//
//  - LES DOCUMENTS SONT DANS UN BUCKET PRIVÉ. Leur seule adresse lisible est
//    une URL signée, valable une heure. La poser dans le PDF produirait un
//    fichier dont les images meurent le lendemain — le pire des résultats,
//    puisqu'il paraît correct le jour où on l'envoie.
//  - iOS REFUSE LES ADRESSES LOCALES dans le HTML d'impression (limitation
//    WKWebView, documentée par expo-print). Un `file://` ne s'afficherait
//    tout simplement pas.
//
// Reste donc à embarquer les octets. C'est ce qui rend cet export DÉPENDANT
// DU RÉSEAU, contrairement à tout le reste de l'app : il faut d'abord
// retélécharger ce qu'on exporte.
//
// ═══ LA TAILLE, QUI EST LE VRAI RISQUE ═══
//
// Le base64 gonfle de 33 %, et le HTML entier doit tenir en mémoire d'un
// seul tenant pour être passé à l'imprimante. Trente tickets en pleine
// définition, c'est une chaîne de plus de dix mégaoctets. D'où deux
// précautions : les images sont RÉDUITES avant d'être encodées, et d'autant
// plus qu'elles sont nombreuses ; et elles sont traitées UNE PAR UNE, jamais
// en parallèle, pour qu'une seule soit décodée à la fois.

export type FactureAExporter = {
  id: string;
  vendor: string | null;
  amount: number | null;
  /** Déjà mise en forme par l'écran, qui connaît la langue. */
  purchaseLabel: string;
  warrantyLabel: string;
  documentUrl: string | null;
  documentKind: string;
  /** Les noms seuls, pour la colonne du récapitulatif. */
  objets: string[];
  /**
   * Le détail par objet, pour la page qui porte le document.
   *
   * UN TICKET DE CAISSE N'EST PAS UN MONTANT. Le récapitulatif donne le total
   * de chaque facture ; la page du document, elle, doit dire ce que CHAQUE
   * chose a coûté et jusqu'à quand elle est couverte — c'est exactement ce
   * qu'un assureur regarde quand il conteste une ligne. Déjà mis en forme par
   * l'appelant, qui connaît la langue.
   */
  detailObjets: { name: string; montant: string; garantie: string }[];
};

/** Les textes du PDF, déjà traduits : ce module ne connaît pas i18n. */
export type LibellesPdf = {
  titre: string;
  sousTitre: string;
  colObjets: string;
  colVendeur: string;
  colAchat: string;
  colMontant: string;
  total: string;
  sansMontant: string;
  sansTitre: string;
  achatLe: string;
  garantieJusqu: string;
  objetsCouverts: string;
  documentManquant: string;
  documentPdf: string;
};

export type ResultatExport = {
  /** Le fichier produit, prêt à être partagé ou joint à un mail. */
  uri: string;
  /** Les factures dont le document n'a pas pu être joint. Le PDF existe quand même. */
  manquants: number;
};

/**
 * LA DÉFINITION DES IMAGES, DÉCIDÉE PAR LEUR NOMBRE.
 *
 * Un ticket de caisse doit rester déchiffrable, donc on ne descend pas plus
 * bas que nécessaire — mais un dossier complet de logement ne doit pas non
 * plus faire exploser la mémoire du téléphone au moment précis où on en a
 * besoin. Les seuils sont un compromis mesuré sur des photos réelles : à
 * 1400 pixels de large, une facture A4 photographiée reste lisible.
 */
function largeurCible(nombre: number): number {
  if (nombre <= 20) return 1400;
  if (nombre <= 60) return 1000;
  return 800;
}

export async function genererPdfFactures(
  factures: FactureAExporter[],
  libelles: LibellesPdf,
  formaterMontant: (montant: number) => string,
  onProgress?: (fait: number, total: number) => void,
): Promise<ResultatExport> {
  const largeur = largeurCible(factures.length);
  const dossier = new Directory(Paths.cache, 'ceou-export');
  if (!dossier.exists) dossier.create({ intermediates: true, idempotent: true });

  const documents = new Map<string, string>();
  let manquants = 0;

  // SÉQUENTIEL, ET C'EST DÉLIBÉRÉ. Un `Promise.all` téléchargerait et
  // décoderait toutes les images en même temps : c'est précisément ce qui
  // fait tomber un export de trente factures sur un téléphone d'entrée de
  // gamme. Une à la fois, c'est plus lent et ça aboutit.
  for (let i = 0; i < factures.length; i += 1) {
    const facture = factures[i];
    onProgress?.(i, factures.length);
    const base64 = await documentEnBase64(facture, dossier, largeur);
    if (base64) documents.set(facture.id, base64);
    else manquants += 1;
  }
  onProgress?.(factures.length, factures.length);

  const html = construireHtml(factures, documents, libelles, formaterMontant);

  // A4 ET NON US LETTER (612x792, le défaut) : l'app est écrite pour la
  // France, et un PDF au format américain s'imprime de travers sur tout ce
  // qui se trouve dans un bureau ici. 595x842 points, soit A4 à 72 ppp.
  const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 });

  return { uri: await renommer(uri, dossier, libelles.titre), manquants };
}

/**
 * Le document d'une facture, réduit et encodé.
 *
 * Rend `null` quand il n'y a rien à joindre — document jamais envoyé (créé
 * hors ligne), adresse illisible, signature refusée, ou PDF, que l'imprimante
 * ne sait pas incorporer. L'export CONTINUE dans tous ces cas : perdre le
 * dossier entier parce qu'une image manque serait la pire des réponses.
 */
async function documentEnBase64(
  facture: FactureAExporter,
  dossier: Directory,
  largeur: number,
): Promise<string | null> {
  if (!facture.documentUrl || facture.documentKind !== 'image') return null;

  const stored = parseStoredMedia(facture.documentUrl);
  if (!stored) return null;

  const fichier = new File(dossier, `${facture.id}.jpg`);
  try {
    const signee = await signMedia(stored.bucket, stored.path);
    if (!signee) return null;

    if (fichier.exists) fichier.delete();
    const telecharge = await File.downloadFileAsync(signee, fichier);

    // NE JAMAIS AGRANDIR : un upscale ressort flou, et le document devient
    // moins lisible qu'avant d'avoir été « amélioré ». Même garde-fou que
    // l'envoi d'une photo (uploadImage).
    const { width } = await getImageSize(telecharge.uri);
    const actions = width > largeur ? [{ resize: { width: largeur } }] : [];

    const reduit = await manipulateAsync(telecharge.uri, actions, {
      compress: 0.7,
      format: SaveFormat.JPEG,
      base64: true,
    });
    return reduit.base64 ?? null;
  } catch {
    // Volontairement muet : l'appelant compte les manquants et le dit à la
    // personne. Une exception ici n'est pas une anomalie de code, c'est un
    // fichier absent ou un réseau qui coupe au milieu.
    return null;
  } finally {
    try {
      if (fichier.exists) fichier.delete();
    } catch {
      // Le ménage du cache n'a pas à faire échouer un export réussi.
    }
  }
}

/**
 * LE NOM DU FICHIER, QUI COMPTE PLUS QU'IL N'EN A L'AIR.
 *
 * `printToFileAsync` rend un nom tiré au hasard. C'est celui que verra le
 * destinataire du mail en pièce jointe, et celui sous lequel le fichier sera
 * rangé dans le téléphone. « 3f2a8c1e.pdf » dans la boîte d'un assureur ne
 * dit rien à personne.
 */
async function renommer(uri: string, dossier: Directory, titre: string): Promise<string> {
  const nom = `${titre.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '')}.pdf`;
  const cible = new File(dossier, nom);
  try {
    if (cible.exists) cible.delete();
    await new File(uri).move(cible);
    return cible.uri;
  } catch {
    // Le fichier existe et il est bon : un nom moins joli vaut mieux qu'un
    // export perdu.
    return uri;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// LE HTML
// ═══════════════════════════════════════════════════════════════════════

/**
 * TOUT CE QUI VIENT DE LA PERSONNE PASSE PAR ICI. Un vendeur nommé
 * « Leroy & fils <promo> » casserait le document sans cette fonction — et une
 * facture est précisément l'endroit où l'on recopie des noms trouvés sur un
 * ticket, sans les regarder.
 */
function escape(valeur: string): string {
  return valeur
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const STYLE = `
  * { box-sizing: border-box; }
  body { margin: 0; color: #2D2A26; font-family: -apple-system, "Helvetica Neue", Roboto, "Segoe UI", sans-serif; }
  /* LA COUPURE EST POSÉE AVANT CHAQUE PAGE SAUF LA PREMIÈRE, jamais après.
     Un « page-break-after » sur la dernière ajoute une page blanche, et elle
     se voit — c'est le défaut classique de ces générateurs. */
  .page { padding: 36px 40px; }
  .page + .page { page-break-before: always; }
  h1 { margin: 0 0 4px; font-size: 21px; }
  .sub { margin: 0 0 22px; font-size: 10px; color: #6B6459; }
  table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
  th { padding: 0 6px 6px; border-bottom: 1px solid #C9C2B6; color: #6B6459; font-size: 8.5px;
       letter-spacing: .07em; text-align: left; text-transform: uppercase; }
  td { padding: 7px 6px; border-bottom: 1px solid #EDE7DE; vertical-align: top; }
  .num { text-align: right; white-space: nowrap; }
  .faint { color: #8C857A; }
  tr.total td { border-top: 1.5px solid #2D2A26; border-bottom: none; font-size: 12px; font-weight: 700; padding-top: 9px; }
  .note { margin-top: 14px; font-size: 9.5px; color: #8C857A; }
  h2 { margin: 0 0 3px; font-size: 15px; }
  .meta { margin: 0 0 3px; font-size: 10.5px; color: #6B6459; }
  .doc { margin-top: 16px; text-align: center; }
  .doc img { max-width: 100%; max-height: 590px; border: 1px solid #D8D2C8; }
  .absent { padding: 40px 16px; border: 1px dashed #C9C2B6; color: #8C857A; font-size: 11px; text-align: center; }
  .lignes { width: 100%; margin-top: 6px; border-collapse: collapse; font-size: 10.5px; }
  .lignes td { padding: 4px 6px; border-bottom: 1px solid #EDE7DE; }
`;

function construireHtml(
  factures: FactureAExporter[],
  documents: Map<string, string>,
  l: LibellesPdf,
  formaterMontant: (montant: number) => string,
): string {
  const chiffrees = factures.filter((f) => f.amount != null);
  const total = chiffrees.reduce((somme, f) => somme + Number(f.amount), 0);

  const lignes = factures
    .map(
      (f) => `<tr>
        <td>${escape(f.objets.join(', '))}</td>
        <td>${f.vendor ? escape(f.vendor) : '<span class="faint">—</span>'}</td>
        <td class="num">${f.purchaseLabel ? escape(f.purchaseLabel) : '<span class="faint">—</span>'}</td>
        <td class="num">${
          f.amount != null ? escape(formaterMontant(Number(f.amount))) : '<span class="faint">—</span>'
        }</td>
      </tr>`,
    )
    .join('');

  const recapitulatif = `<section class="page">
    <h1>${escape(l.titre)}</h1>
    <p class="sub">${escape(l.sousTitre)}</p>
    <table>
      <thead><tr>
        <th>${escape(l.colObjets)}</th>
        <th>${escape(l.colVendeur)}</th>
        <th class="num">${escape(l.colAchat)}</th>
        <th class="num">${escape(l.colMontant)}</th>
      </tr></thead>
      <tbody>
        ${lignes}
        <tr class="total">
          <td colspan="3">${escape(l.total)}</td>
          <td class="num">${escape(formaterMontant(total))}</td>
        </tr>
      </tbody>
    </table>
    ${
      // LE TOTAL DIT SUR QUOI IL PORTE, comme à l'écran. Le montant étant
      // facultatif, un total muet laisserait croire qu'il couvre tout —
      // devant un assureur, ce serait un chiffre faux présenté comme vrai.
      chiffrees.length < factures.length
        ? `<p class="note">${escape(l.sansMontant)}</p>`
        : ''
    }
  </section>`;

  const pages = factures.map((f) => pageFacture(f, documents.get(f.id), l, formaterMontant)).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${STYLE}</style></head><body>${recapitulatif}${pages}</body></html>`;
}

function pageFacture(
  f: FactureAExporter,
  base64: string | undefined,
  l: LibellesPdf,
  formaterMontant: (montant: number) => string,
): string {
  const titre = f.vendor || f.purchaseLabel || l.sansTitre;

  const details = [
    f.amount != null ? formaterMontant(Number(f.amount)) : null,
    f.purchaseLabel ? `${l.achatLe} ${f.purchaseLabel}` : null,
    f.warrantyLabel ? `${l.garantieJusqu} ${f.warrantyLabel}` : null,
  ].filter((part): part is string => part !== null);

  const document = base64
    ? `<img src="data:image/jpeg;base64,${base64}" />`
    : `<div class="absent">${escape(f.documentKind === 'pdf' ? l.documentPdf : l.documentManquant)}</div>`;

  return `<section class="page">
    <h2>${escape(titre)}</h2>
    ${details.length > 0 ? `<p class="meta">${escape(details.join(' · '))}</p>` : ''}
    <p class="meta">${escape(l.objetsCouverts)}</p>
    <table class="lignes">
      ${f.detailObjets
        .map(
          (objet) => `<tr>
            <td>${escape(objet.name)}</td>
            <td class="num faint">${escape(objet.garantie)}</td>
            <td class="num">${escape(objet.montant)}</td>
          </tr>`,
        )
        .join('')}
    </table>
    <div class="doc">${document}</div>
  </section>`;
}
