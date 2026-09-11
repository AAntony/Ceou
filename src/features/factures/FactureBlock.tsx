import { Image } from 'expo-image';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { confirmDelete } from '../../lib/confirmDelete';
import { useMediaSource } from '../../lib/images/media';
import { useScaled } from '../../lib/textScale';
import { useThemeColors } from '../../lib/theme';
import { dateOrderFor, fromIsoDate } from './dateField';
import { ExportProgress } from './ExportProgress';
import { FacturePickerModal } from './FacturePickerModal';
import { FactureFormSheet, type ValeursFacture } from './FactureFormSheet';
import {
  lignesDe,
  useAttachFactureToObjet,
  useCreateFacture,
  useDeleteFacture,
  useFacturesForObjet,
  useUpdateFacture,
  type FactureDObjet,
} from './queries';
import { useExportFactures } from './useExportFactures';
import { useFeuilleFacture } from './useFeuilleFacture';

// LES PREUVES D'ACHAT D'UN OBJET, SUR SA FICHE.
//
// C'est là que naît l'intention — « je viens d'acheter ça, je garde le
// ticket » — donc c'est là que la fonctionnalité vit.
//
// ═══ CE QU'ON MONTRE ICI, C'EST LA LIGNE DE CET OBJET ═══
//
// Une facture peut couvrir plusieurs choses. Sur la fiche du grille-pain, on
// affiche ce que LE GRILLE-PAIN a coûté et jusqu'à quand IL est couvert — pas
// les 840 € du ticket ni la garantie du frigo. C'est tout le défaut corrigé
// par le passage en en-tête/lignes.
//
// ═══ POURQUOI UN HOOK QUI REND DES ÉLÉMENTS ═══
//
// L'ACTION et la LISTE ne vont pas au même endroit de l'écran. « Ajouter une
// facture » est un geste, il rejoint « Déplacer » et « Prêter » dans leur
// rangée. La liste, elle, décrit l'objet : sa place est avec les informations.
// Les deux partagent pourtant un état — la feuille ouverte, ce qu'on y
// modifie, les écritures en cours. Ce hook le tient une fois et rend les
// morceaux à poser où il faut.

export function useFactures(objetId: string, isOwner: boolean, habitationId?: string) {
  const { t } = useTranslation();
  const { data } = useFacturesForObjet(isOwner ? objetId : '');
  const creer = useCreateFacture();
  const modifier = useUpdateFacture();
  const supprimer = useDeleteFacture();
  const rattacher = useAttachFactureToObjet();

  const [enEdition, setEnEdition] = useState<FactureDObjet | undefined>(undefined);
  const [objetNom, setObjetNom] = useState('');
  const [choixFacture, setChoixFacture] = useState(false);
  const feuilleEtat = useFeuilleFacture();
  const { demander, travail } = useExportFactures();

  const factures = data ?? [];

  const ouvrir = (facture?: FactureDObjet) => {
    setEnEdition(facture);
    feuilleEtat.ouvrir();
  };

  const enregistrer = (valeurs: ValeursFacture) => {
    if (enEdition) {
      modifier.mutate({
        id: enEdition.id,
        vendor: valeurs.vendor,
        purchaseDate: valeurs.purchaseDate,
        factureAmount: valeurs.factureAmount,
        document: valeurs.document,
        lignes: valeurs.lignes,
        lignesSupprimees: valeurs.lignesSupprimees,
        habitationId,
      });
    } else {
      creer.mutate({ habitationId, ...valeurs });
    }
    feuilleEtat.fermer();
  };

  const exporterCelleCi = (facture: FactureDObjet) => {
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
     * ELLE POSE UNE QUESTION AVANT, et c'est le seul endroit où le
     * rattachement se propose. Un ticket de caisse couvre souvent plusieurs
     * choses : on photographie en ajoutant la première chaise, et les trois
     * autres réutilisent le même document. Le geste courant reste en tête de
     * liste, il ne coûte qu'un appui de plus.
     */
    ouvrirAjout: (nomDeLObjet: string) => {
      setObjetNom(nomDeLObjet);
      Alert.alert(t('factures.block.add'), t('factures.block.add_choice'), [
        { text: t('factures.block.add_new'), onPress: () => ouvrir(undefined) },
        { text: t('factures.block.add_existing'), onPress: () => setChoixFacture(true) },
        { text: t('common.cancel'), style: 'cancel' },
      ]);
    },

    /**
     * La liste, ou `null` quand il n'y a rien.
     *
     * LES FACTURES D'AUTRUI N'EXISTENT PAS POUR LUI, et il ne faut pas le lui
     * laisser croire : elles sont privées à leur propriétaire. Quelqu'un qui
     * voit une habitation partagée ne recevrait jamais que des listes vides,
     * et un bloc « Aucune facture » lui ferait penser que le propriétaire n'en
     * a pas mis.
     */
    liste:
      !isOwner || factures.length === 0 ? null : (
        <View className="mb-6">
          <Text className="mb-2 text-label font-medium text-ink-soft">{t('factures.block.title')}</Text>
          <View className="gap-2">
            {factures.map((facture) => (
              <FactureRow
                key={facture.id}
                facture={facture}
                onPress={() => ouvrir(facture)}
                onDelete={() =>
                  confirmDelete(
                    t,
                    'factures.delete.title',
                    lignesDe(facture).length > 1 ? 'factures.delete.message_shared' : 'factures.delete.message',
                    () =>
                      supprimer.mutate({
                        id: facture.id,
                        vendor: facture.vendor,
                        ligneIds: lignesDe(facture).map((ligne) => ligne.id),
                      }),
                    { count: lignesDe(facture).length },
                  )
                }
              />
            ))}
          </View>
        </View>
      ),

    /**
     * Combien de preuves d'achat disparaîtraient avec cet objet.
     *
     * CELLES QUI NE COUVRENT QUE LUI, et elles seules : une facture partagée
     * avec d'autres objets leur survit (voir purge_facture_sans_objet).
     * Annoncer « 3 factures seront supprimées » quand deux resteront serait
     * une fausse alerte, et une fausse alerte dans une boîte de suppression
     * apprend à ne plus la lire.
     */
    facturesPerdues: factures.filter((facture) => lignesDe(facture).length <= 1).length,

    /** À poser n'importe où : ce sont des modales. */
    feuille: isOwner ? (
      <>
        <FactureFormSheet
          key={feuilleEtat.cle}
          visible={feuilleEtat.visible}
          facture={enEdition}
          objetInitial={enEdition ? undefined : { objetId, name: objetNom }}
          // EN MODIFICATION SEULEMENT : en création il n'y a encore rien à
          // sortir. La feuille se ferme avant — la feuille de partage et le
          // brouillon de mail sont des vues du système, et sur iOS en
          // présenter une par-dessus une modale ouverte ne fait rien du tout.
          onExport={enEdition ? () => exporterCelleCi(enEdition) : undefined}
          onClose={feuilleEtat.fermer}
          onSubmit={enregistrer}
          loading={creer.isPending || modifier.isPending}
        />
        <FacturePickerModal
          visible={choixFacture}
          objetId={objetId}
          onClose={() => setChoixFacture(false)}
          onChoisir={(facture) => {
            setChoixFacture(false);
            rattacher.mutate({
              factureId: facture.id,
              objetId,
              objetName: objetNom,
              vendor: facture.vendor,
              habitationId,
            });
          }}
        />
        <ExportProgress travail={travail} />
      </>
    ) : null,
  };
}

function FactureRow({
  facture,
  onPress,
  onDelete,
}: {
  facture: FactureDObjet;
  onPress: () => void;
  onDelete: () => void;
}) {
  const { t, i18n } = useTranslation();
  const colors = useThemeColors();
  const vignette = useMediaSource(facture.document_url);
  const order = dateOrderFor(i18n.language);

  // Proportion d'un ticket, plus haute que large : c'est ce qui la fait
  // reconnaître comme un document et non comme la photo d'un objet. Dessinée
  // en pixels, donc mise à l'échelle avec le texte posé à côté.
  const largeur = useScaled(40);
  const hauteur = useScaled(52);

  const date = fromIsoDate(facture.purchase_date, order);
  const titre = facture.vendor || date || t('factures.block.untitled');
  const garantieFinie = facture.warranty_until ? new Date(facture.warranty_until) < new Date() : null;
  const partagee = lignesDe(facture).length > 1;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={titre}
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-xl border border-ink/10 bg-surface p-2 active:opacity-70"
    >
      <View
        style={{ width: largeur, height: hauteur }}
        className="overflow-hidden rounded-lg border border-ink/10 bg-sand-dark"
      >
        {vignette ? (
          <Image source={vignette} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        ) : (
          <View className="flex-1 items-center justify-center">
            <Icon name="facture" size={16} color={colors.inkFaint} />
          </View>
        )}
      </View>

      {/* DEUX LIGNES, TOUJOURS, remplies ou non : c'est ce qui donne à toutes
          les lignes la même hauteur sans figer un nombre de pixels — donc une
          liste qui reste régulière même à 200 % de texte.
          LE MONTANT EST CELUI DE CET OBJET, pas le total du ticket. */}
      <View className="flex-1">
        <Text numberOfLines={1} className="text-body text-ink">
          {titre}
        </Text>
        <Text
          numberOfLines={1}
          className={facture.amount != null ? 'text-label font-semibold text-ink' : 'text-label text-ink-faint'}
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {facture.amount != null
            ? new Intl.NumberFormat(i18n.language, { style: 'currency', currency: 'EUR' }).format(Number(facture.amount))
            : t('factures.list.no_amount')}
        </Text>
      </View>

      {/* PARTAGÉE SE DIT, parce que ça change ce qu'on croit lire : le montant
          affiché n'est plus celui du ticket, et supprimer la facture emporte
          aussi les autres objets. */}
      {partagee ? (
        <View className="rounded-full bg-sand-dark px-2 py-0.5">
          <Text className="text-caption text-ink-soft">{t('factures.block.covers', { count: lignesDe(facture).length })}</Text>
        </View>
      ) : null}

      {garantieFinie === false ? (
        <View className="rounded-full bg-teal-light px-2 py-0.5">
          <Text className="text-caption font-semibold text-teal-dark">{t('factures.block.warranty_active')}</Text>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.delete')}
        onPress={onDelete}
        hitSlop={10}
        className="p-1"
      >
        <Icon name="delete" size={18} color={colors.inkSoft} />
      </Pressable>
    </Pressable>
  );
}
