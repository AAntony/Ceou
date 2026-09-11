import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';
import { logClientError } from '../../lib/errorLogging';
import { dateOrderFor, fromIsoDate } from './dateField';
import { envoyerParMail, partager } from './exportDelivery';
import { genererPdfFactures, type FactureAExporter } from './exportPdf';

// L'EXPORT, DU CLIC AU FICHIER PARTI.
//
// Deux écrans le déclenchent, sur des sélections de tailles très différentes :
// l'arborescence, qui en emporte quarante, et la feuille d'une facture, qui
// n'en sort qu'une. Tout le reste est identique — mêmes libellés traduits,
// même génération, mêmes deux sorties, mêmes échecs à raconter. D'où ce hook
// plutôt que deux copies qui divergeraient au premier correctif.
//
// LE MODE DE SORTIE SE DEMANDE OU SE DIT, SELON L'ÉCRAN. L'écran d'export a
// la place pour deux boutons ; la feuille d'une facture n'a qu'une icône dans
// son coin, et pose donc la question au moment d'appuyer. Une question de
// moins serait une décision prise à la place de la personne — envoyer un
// document à un tiers n'est pas un geste qu'on devine.

/** Une facture telle que les écrans la connaissent, avant mise en forme. */
export type FactureACibler = {
  id: string;
  vendor: string | null;
  amount: number | null;
  purchaseDate: string | null;
  warrantyUntil: string | null;
  documentUrl: string | null;
  documentKind: string;
  /** Ce que la facture couvre, avec le prix et la garantie de chaque objet. */
  lignes: { name: string; amount: number | null; warrantyUntil: string | null }[];
};

export type ModeSortie = 'mail' | 'partage';

export function useExportFactures() {
  const { t, i18n } = useTranslation();
  const [travail, setTravail] = useState<{ fait: number; total: number } | null>(null);

  const exporter = useCallback(
    async (cibles: FactureACibler[], mode: ModeSortie) => {
      if (cibles.length === 0) return;

      const order = dateOrderFor(i18n.language);
      const titre = t('factures.pdf.title', { date: new Date().toLocaleDateString(i18n.language) });
      const formaterMontant = (montant: number) =>
        new Intl.NumberFormat(i18n.language, { style: 'currency', currency: 'EUR' }).format(montant);

      setTravail({ fait: 0, total: cibles.length });

      // DEUX TEMPS SÉPARÉS : fabriquer, puis livrer.
      //
      // Le voile de progression DOIT être retombé avant qu'on présente la
      // feuille de partage ou le brouillon de mail. Ce sont des vues du
      // SYSTÈME : sur iOS, en présenter une alors qu'une modale est déjà à
      // l'écran ne fait rien du tout, en silence. C'est la raison du `finally`
      // posé sur la seule génération, et de la livraison écrite en dehors.
      let resultat: Awaited<ReturnType<typeof genererPdfFactures>>;
      try {
        const aExporter: FactureAExporter[] = cibles.map((cible) => ({
          id: cible.id,
          vendor: cible.vendor,
          amount: cible.amount,
          purchaseLabel: fromIsoDate(cible.purchaseDate, order),
          warrantyLabel: fromIsoDate(cible.warrantyUntil, order),
          documentUrl: cible.documentUrl,
          documentKind: cible.documentKind,
          objets: cible.lignes.map((ligne) => ligne.name),
          detailObjets: cible.lignes.map((ligne) => ({
            name: ligne.name,
            montant: ligne.amount != null ? formaterMontant(Number(ligne.amount)) : '—',
            garantie: ligne.warrantyUntil
              ? `${t('factures.pdf.warranty_short')} ${fromIsoDate(ligne.warrantyUntil, order)}`
              : '',
          })),
        }));

        resultat = await genererPdfFactures(
          aExporter,
          {
            titre,
            sousTitre: t('factures.pdf.subtitle', { count: aExporter.length }),
            colObjets: t('factures.pdf.col_objets'),
            colVendeur: t('factures.pdf.col_vendeur'),
            colAchat: t('factures.pdf.col_achat'),
            colMontant: t('factures.pdf.col_montant'),
            total: t('factures.pdf.total'),
            sansMontant: t('factures.pdf.without_amount', {
              count: aExporter.filter((f) => f.amount == null).length,
            }),
            sansTitre: t('factures.block.untitled'),
            achatLe: t('factures.pdf.bought_on'),
            garantieJusqu: t('factures.pdf.warranty_until'),
            objetsCouverts: t('factures.pdf.covers'),
            documentManquant: t('factures.pdf.document_missing'),
            documentPdf: t('factures.pdf.document_pdf'),
          },
          formaterMontant,
          (fait, total) => setTravail({ fait, total }),
        );
      } catch (error) {
        logClientError(error, { source: 'facture_export', count: cibles.length });
        Alert.alert(t('factures.export.error'));
        return;
      } finally {
        setTravail(null);
      }

      // LE PDF INCOMPLET SE DIT AVANT L'ENVOI, PAS APRÈS. Quelqu'un qui
      // transmet un dossier à son assureur doit savoir qu'il y manque une
      // preuve AVANT de l'envoyer : l'apprendre une fois le mail parti ne
      // sert plus à rien.
      if (resultat.manquants > 0) {
        await new Promise<void>((resoudre) => {
          Alert.alert(
            t('factures.export.missing', { count: resultat.manquants }),
            t('factures.export.missing_hint'),
            [{ text: t('common.done'), onPress: () => resoudre() }],
          );
        });
      }

      try {
        if (mode === 'mail') {
          await envoyerParMail(resultat.uri, { sujet: titre, corps: t('factures.export.mail_body') });
        } else if (!(await partager(resultat.uri, titre))) {
          Alert.alert(t('factures.export.no_share'));
        }
      } catch (error) {
        // Le fichier EXISTE : seul l'acheminement a échoué. On le dit, mais on
        // ne prétend pas que l'export n'a pas eu lieu.
        logClientError(error, { source: 'facture_export_livraison', mode });
        Alert.alert(t('factures.export.no_share'));
      }
    },
    [i18n.language, t],
  );

  /** Pose la question du mode, puis exporte. Pour les écrans sans place pour deux boutons. */
  const demander = useCallback(
    (cibles: FactureACibler[]) => {
      if (cibles.length === 0) return;
      Alert.alert(t('factures.export.title'), t('factures.export.choose'), [
        { text: t('factures.export.mail'), onPress: () => void exporter(cibles, 'mail') },
        { text: t('factures.export.save'), onPress: () => void exporter(cibles, 'partage') },
        { text: t('common.cancel'), style: 'cancel' },
      ]);
    },
    [exporter, t],
  );

  return { exporter, demander, travail };
}
