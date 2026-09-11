import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { confirmDelete } from '../../lib/confirmDelete';
import { showDialog } from '../../lib/dialog';
import { useThemeColors } from '../../lib/theme';
import { dateOrderFor, fromIsoDate } from './dateField';
import { ExportProgress } from './ExportProgress';
import { FactureFormSheet, type ValeursFacture } from './FactureFormSheet';
import { RattacherFactureModal } from './RattacherFactureModal';
import { VignetteDocument } from './VignetteDocument';
import {
  lignesDe,
  useCreateFacture,
  useDeleteFacture,
  useDetachFactureFromObjet,
  useFacturesForObjet,
  useUpdateFacture,
  type FactureDObjet,
} from './queries';
import { useExportFactures } from './useExportFactures';
import { useFeuilleFacture } from './useFeuilleFacture';

// LA PREUVE D'ACHAT D'UN OBJET, SUR SA FICHE.
//
// C'est là que naît l'intention — « je viens d'acheter ça, je garde le
// ticket » — donc c'est là que la fonctionnalité vit.
//
// ═══ UNE SEULE, ET C'EST VOULU ═══
//
// Un objet n'a qu'une preuve d'achat. Le modèle permettrait d'en empiler
// plusieurs (l'achat, puis une réparation) mais l'interface n'en propose plus :
// deux montants sur une même fiche ne disent plus ce que la chose a coûté, et
// c'est le défaut signalé à l'usage. La tuile « Ajouter une facture » disparaît
// donc dès qu'il y en a une.
//
// Pas de contrainte en base pour autant : elle ferait échouer une écriture
// partie de la file des heures plus tard, avec le « le serveur a refusé ma
// modification » qu'on a mis du temps à faire disparaître.
//
// ═══ CE QU'ON MONTRE ICI, C'EST LA LIGNE DE CET OBJET ═══
//
// Une facture peut couvrir plusieurs choses. Sur la fiche du grille-pain on
// affiche ce que LE GRILLE-PAIN a coûté et jusqu'à quand IL est couvert — ni
// les 840 € du ticket, ni la liste de ses voisins de caisse. Les autres objets
// se gèrent depuis le dossier du logement, qui est l'écran du ticket.

export function useFactures(objetId: string, isOwner: boolean, habitationId?: string) {
  const { t } = useTranslation();
  const { data } = useFacturesForObjet(isOwner ? objetId : '');
  const creer = useCreateFacture();
  const modifier = useUpdateFacture();
  const supprimer = useDeleteFacture();
  const detacher = useDetachFactureFromObjet();

  const [objet, setObjet] = useState<{ name: string; photoUrl: string | null }>({ name: '', photoUrl: null });
  const [rattachement, setRattachement] = useState(false);
  const feuilleEtat = useFeuilleFacture();
  const { demander, travail } = useExportFactures();

  // LA PREMIÈRE ET RIEN D'AUTRE. La requête peut en rendre plusieurs — des
  // données d'avant cette règle, ou une écriture concurrente — et l'écran doit
  // rester lisible plutôt que d'en afficher deux.
  const facture = (data ?? [])[0];

  const enregistrer = (valeurs: ValeursFacture) => {
    if (facture) {
      modifier.mutate({
        id: facture.id,
        vendor: valeurs.vendor,
        purchaseDate: valeurs.purchaseDate,
        factureAmount: valeurs.factureAmount,
        document: valeurs.document,
        documentKind: valeurs.documentKind,
        lignes: valeurs.lignes,
        lignesSupprimees: valeurs.lignesSupprimees,
        habitationId,
      });
    } else {
      creer.mutate({ habitationId, ...valeurs });
    }
    feuilleEtat.fermer();
  };

  const lignes = facture ? lignesDe(facture) : [];
  // PARTAGÉE : le document couvre d'autres objets que celui-ci. C'est ce qui
  // décide de tout le geste destructeur ci-dessous.
  const partagee = lignes.length > 1;

  /**
   * RETIRER CET OBJET — pas supprimer le document.
   *
   * C'est le défaut signalé à l'usage, et il était grave : depuis la fiche
   * d'une chaise, on supprimait le ticket de caisse des quatre. Un ticket
   * couvre plusieurs choses, se débarrasser de l'une ne doit pas priver les
   * autres de leur preuve d'achat.
   *
   * Quand la facture ne couvre QUE cet objet, retirer la ligne revient à la
   * supprimer — la base s'en charge (purge_facture_sans_objet). Autant passer
   * par la vraie suppression, qui annule aussi le rappel de garantie et fait
   * sortir la ligne du cache, et surtout autant le DIRE : le libellé et la
   * boîte changent tous les deux.
   */
  const retirerDeCetteFacture = () => {
    if (!facture) return;
    feuilleEtat.fermer();

    const ligne = lignes.find((candidate) => candidate.objetId === objetId);
    if (partagee && ligne) {
      // PAS `confirmDelete` ICI : son bouton dit « Supprimer », et ce n'est
      // pas ce qui se passe — la facture reste, seul cet objet s'en detache.
      // Meme regle que le libelle rouge qui ouvre cette boite (plus bas) : le
      // bouton doit dire ce qu'il fait. Il reste rouge, parce que c'est le
      // meme geste vu a deux moments.
      showDialog({
        title: t('factures.delete.detach_title'),
        message: t('factures.delete.detach_message', { count: lignes.length - 1 }),
        actions: [
          {
            label: t('factures.delete.detach_confirm'),
            destructive: true,
            onPress: () => detacher.mutate({ ligneId: ligne.id, vendor: facture.vendor }),
          },
          { label: t('common.cancel'), cancel: true },
        ],
      });
      return;
    }

    confirmDelete(t, 'factures.delete.title', 'factures.delete.message_last', () =>
      supprimer.mutate({
        id: facture.id,
        vendor: facture.vendor,
        ligneIds: lignes.map((autre) => autre.id),
      }),
    );
  };

  const exporterCelleCi = () => {
    if (!facture) return;
    feuilleEtat.fermer();
    demander([
      {
        id: facture.id,
        vendor: facture.vendor,
        // LE TOTAL DU TICKET DANS L'EXPORT, pas la ligne : le PDF sort la
        // facture entière, avec tous les objets qu'elle couvre.
        amount: facture.facture_amount ?? facture.amount,
        purchaseDate: facture.purchase_date,
        warrantyUntil: facture.warranty_until,
        documentUrl: facture.document_url,
        documentKind: facture.document_kind,
        lignes: lignesDe(facture).map((ligne) => ({
          name: ligne.name,
          amount: ligne.amount,
          warrantyUntil: ligne.warrantyUntil,
        })),
      },
    ]);
  };

  return {
    /**
     * À brancher sur la tuile de la rangée d'actions.
     *
     * L'écran passe le nom et la photo de l'objet : la feuille les affiche sur
     * la carte de la première ligne, et les redemander au réseau pour ça seul
     * serait un aller-retour de plus.
     */
    ouvrirAjout: (nom: string, photoUrl: string | null) => {
      setObjet({ name: nom, photoUrl });
      // DEUX CHEMINS, ET LE SECOND EST CELUI DU TICKET DE CAISSE : on sort du
      // magasin avec quatre chaises et un seul document. La deuxieme chaise ne
      // doit pas rephotographier le meme papier — elle se rattache a la
      // facture deja saisie. Le geste courant reste en tete de liste.
      showDialog({
        title: t('factures.block.add'),
        message: t('factures.block.add_choice'),
        actions: [
          { label: t('factures.block.add_new'), onPress: () => feuilleEtat.ouvrir() },
          { label: t('factures.block.add_existing'), onPress: () => setRattachement(true) },
          { label: t('common.cancel'), cancel: true },
        ],
      });
    },

    /** Vrai quand l'objet en a déjà une : la tuile d'ajout n'a plus lieu d'être. */
    dejaUneFacture: Boolean(facture),

    /**
     * La facture de cet objet, ou `null`.
     *
     * LES FACTURES D'AUTRUI N'EXISTENT PAS POUR LUI, et il ne faut pas le lui
     * laisser croire : elles sont privées à leur propriétaire. Quelqu'un qui
     * voit une habitation partagée ne recevrait jamais que du vide, et un bloc
     * « Aucune facture » lui ferait penser que le propriétaire n'en a pas mis.
     */
    liste:
      !isOwner || !facture ? null : (
        <View className="mb-6">
          <Text className="mb-2 text-label font-medium text-ink-soft">{t('factures.block.title')}</Text>
          <FactureCarte facture={facture} onPress={feuilleEtat.ouvrir} />
        </View>
      ),

    /**
     * Combien de preuves d'achat disparaîtraient avec cet objet.
     *
     * CELLE QUI NE COUVRE QUE LUI, et elle seule : une facture partagée avec
     * d'autres objets leur survit (voir purge_facture_sans_objet). Annoncer une
     * suppression qui n'aura pas lieu serait une fausse alerte, et une fausse
     * alerte dans une boîte de suppression apprend à ne plus la lire.
     */
    facturesPerdues: facture && lignesDe(facture).length <= 1 ? 1 : 0,

    /** À poser n'importe où : ce sont des modales. */
    feuille: isOwner ? (
      <>
        <FactureFormSheet
          key={feuilleEtat.cle}
          visible={feuilleEtat.visible}
          facture={facture}
          // RÉDUITE À CET OBJET. Le ticket reste modifiable — c'est le même
          // papier — mais ses autres objets ne se montrent ni ne se gèrent
          // d'ici : ça se fait depuis le dossier du logement.
          mode="ligne"
          objetId={objetId}
          objetInitial={facture ? undefined : { objetId, name: objet.name, photoUrl: objet.photoUrl }}
          // LA FEUILLE SE FERME AVANT D'EXPORTER OU DE SUPPRIMER : la feuille
          // de partage, le brouillon de mail et la boîte de confirmation sont
          // des vues du système, et sur iOS en présenter une par-dessus une
          // modale ouverte ne fait rien du tout.
          onExport={facture ? exporterCelleCi : undefined}
          onDelete={facture ? retirerDeCetteFacture : undefined}
          // « Retirer cet objet » quand le document en couvre d'autres,
          // « Supprimer » quand il n'y a que lui : le bouton doit dire ce
          // qu'il fait, pas ce qu'il fait la plupart du temps.
          deleteLabel={t(partagee ? 'factures.delete.detach' : 'factures.delete.action')}
          onClose={feuilleEtat.fermer}
          onSubmit={enregistrer}
          loading={creer.isPending || modifier.isPending}
        />
        <RattacherFactureModal
          visible={rattachement}
          objetId={objetId}
          // Le nom et la photo viennent de la tuile qui a ouvert le choix :
          // c'est la nouvelle ligne de la facture qui les portera, pour
          // s'afficher ici meme sans reseau.
          objetName={objet.name}
          objetPhotoUrl={objet.photoUrl}
          habitationId={habitationId}
          onClose={() => setRattachement(false)}
        />
        <ExportProgress travail={travail} />
      </>
    ) : null,
  };
}

/**
 * La facture d'un objet, en une carte.
 *
 * TROIS LIGNES, TOUJOURS, remplies ou non : la hauteur ne vient pas d'un nombre
 * de pixels — qui se romprait au premier agrandissement du texte — mais du fait
 * qu'on rend toujours le même nombre de lignes.
 */
function FactureCarte({ facture, onPress }: { facture: FactureDObjet; onPress: () => void }) {
  const { t, i18n } = useTranslation();
  const colors = useThemeColors();
  const order = dateOrderFor(i18n.language);

  const date = fromIsoDate(facture.purchase_date, order);
  const titre = facture.vendor || date || t('factures.block.untitled');
  const couvert = facture.warranty_until ? new Date(facture.warranty_until) > new Date() : false;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('factures.block.open', { name: titre })}
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-2xl border border-ink/10 bg-surface p-3 active:opacity-70"
    >
      <VignetteDocument
        documentUrl={facture.document_url}
        documentKind={facture.document_kind}
        width={48}
        height={62}
        iconSize={18}
      />

      <View className="flex-1">
        <Text numberOfLines={1} className="text-body font-semibold text-ink">
          {titre}
        </Text>
        {/* LE MONTANT EST CELUI DE CET OBJET, pas le total du ticket. */}
        <Text
          numberOfLines={1}
          className={facture.amount != null ? 'text-subheading font-bold text-ink' : 'text-subheading text-ink-faint'}
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {facture.amount != null
            ? new Intl.NumberFormat(i18n.language, { style: 'currency', currency: 'EUR' }).format(Number(facture.amount))
            : t('factures.list.no_amount')}
        </Text>
        {/* LA TROISIÈME LIGNE DIT CE QUI SERT LE PLUS : la garantie tant
            qu'elle court — c'est elle qu'on vient vérifier — la date d'achat
            sinon, et à défaut l'invitation à ouvrir. */}
        <Text numberOfLines={1} className="text-caption text-ink-soft">
          {couvert && facture.warranty_until
            ? t('factures.list.warranty_until', { date: fromIsoDate(facture.warranty_until, order) })
            : facture.vendor && date
              ? date
              : t('factures.block.tap_to_edit')}
        </Text>
      </View>

      <Icon name="chevron" size={20} color={colors.inkFaint} />
    </Pressable>
  );
}
