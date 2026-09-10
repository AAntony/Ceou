import { Image } from 'expo-image';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { confirmDelete } from '../../lib/confirmDelete';
import { useMediaSource } from '../../lib/images/media';
import { useThemeColors } from '../../lib/theme';
import { fromIsoDate, dateOrderFor } from './dateField';
import { FactureFormSheet } from './FactureFormSheet';
import { useCreateFacture, useDeleteFacture, useFacturesForObjet, useUpdateFacture, type FactureWithObjets } from './queries';

// LES PREUVES D'ACHAT D'UN OBJET, SUR SA FICHE.
//
// C'est là que naît l'intention — « je viens d'acheter ça, je garde le
// ticket » — donc c'est là que la fonctionnalité doit se trouver. Une liste
// rangée ailleurs obligerait à se souvenir qu'elle existe, et à retrouver
// l'objet une seconde fois.
//
// UNE SEULE CIBLE PAR LIGNE. Toucher une facture ouvre la feuille, qui montre
// le document en grand ET permet de corriger les champs : consulter et
// modifier sont le même geste. Séparer les deux aurait demandé de viser la
// vignette ou le texte selon l'intention — un partage de cible que le
// réglage de grande taille rend vite impraticable.

type FactureBlockProps = {
  objetId: string;
  /**
   * Vrai pour le PROPRIÉTAIRE de l'habitation, pas pour qui peut modifier.
   *
   * La nuance compte : un ami a qui l'habitation est ouverte en modification
   * peut renommer un objet, mais les factures ne lui appartiennent pas.
   */
  isOwner: boolean;
};

export function FactureBlock({ objetId, isOwner }: FactureBlockProps) {
  const { t } = useTranslation();
  const { data: factures } = useFacturesForObjet(objetId);
  const creer = useCreateFacture();
  const modifier = useUpdateFacture();
  const supprimer = useDeleteFacture();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [enEdition, setEnEdition] = useState<FactureWithObjets | undefined>(undefined);
  // COMPTEUR D'OUVERTURES, ET IL SERT DE CLE DE REMONTAGE.
  //
  // La feuille lit ses valeurs initiales a la construction. Sans remontage,
  // rouvrir « Ajouter » juste apres en avoir enregistre une afficherait
  // encore la precedente. Une cle tiree de l'identifiant ne suffirait pas :
  // deux creations d'affilee la laisseraient inchangee.
  const [ouvertures, setOuvertures] = useState(0);

  // LES FACTURES D'AUTRUI N'EXISTENT PAS POUR LUI, et il ne faut pas le lui
  // laisser croire. Elles sont privées à leur propriétaire (voir la migration
  // factures) : quelqu'un qui voit une habitation partagée ne recevrait jamais
  // que des listes vides. Un bloc « Aucune facture » lui ferait penser que le
  // propriétaire n'en a pas mis, ce qui est faux — et un bouton « Ajouter »
  // lui ferait attacher SA facture a l'objet de quelqu'un d'autre, invisible
  // pour les deux.
  if (!isOwner) return null;

  const ouvrir = (facture?: FactureWithObjets) => {
    setEnEdition(facture);
    setOuvertures((n) => n + 1);
    setSheetOpen(true);
  };

  const enregistrer = (valeurs: Parameters<Parameters<typeof FactureFormSheet>[0]['onSubmit']>[0]) => {
    if (enEdition) {
      modifier.mutate({
        id: enEdition.id,
        vendor: valeurs.vendor,
        amount: valeurs.amount,
        purchaseDate: valeurs.purchaseDate,
        warrantyUntil: valeurs.warrantyUntil,
      });
    } else {
      creer.mutate({ objetId, ...valeurs });
    }
    setSheetOpen(false);
  };

  return (
    <View className="mt-6">
      <Text className="mb-2 text-label font-medium text-ink-soft">{t('factures.block.title')}</Text>

      {factures && factures.length > 0 ? (
        <View className="mb-3 gap-2">
          {factures.map((facture) => (
            <FactureRow
              key={facture.id}
              facture={facture}
              onPress={() => ouvrir(facture)}
              onDelete={() =>
                confirmDelete(t, 'factures.delete.title', 'factures.delete.message', () =>
                  supprimer.mutate({ id: facture.id, vendor: facture.vendor }),
                )
              }
            />
          ))}
        </View>
      ) : (
        <Text className="mb-3 text-label text-ink-soft">{t('factures.block.empty')}</Text>
      )}

      {/* EN PASTILLE, COMME « DEPLACER » ET « PRETER ». En ghost, le libelle
          n'etait qu'une ligne de texte de plus dans une fiche qui en compte
          beaucoup : rien ne disait que c'etait une action, et on ne le
          decouvrait qu'en appuyant dessus par hasard. Meme traitement que les
          deux autres gestes de la fiche, donc meme lecture. */}
      <Button label={t('factures.block.add')} variant="tile" icon="facture" onPress={() => ouvrir(undefined)} />

      <FactureFormSheet
        key={ouvertures}
        visible={sheetOpen}
        facture={enEdition}
        onClose={() => setSheetOpen(false)}
        onSubmit={enregistrer}
        loading={creer.isPending || modifier.isPending}
      />
    </View>
  );
}

function FactureRow({
  facture,
  onPress,
  onDelete,
}: {
  facture: FactureWithObjets;
  onPress: () => void;
  onDelete: () => void;
}) {
  const { t, i18n } = useTranslation();
  const colors = useThemeColors();
  const vignette = useMediaSource(facture.document_url);
  const order = dateOrderFor(i18n.language);

  // CE QU'ON MONTRE QUAND IL N'Y A PAS DE VENDEUR : la date, puis à défaut le
  // nombre d'objets couverts. Les quatre champs étant facultatifs, une ligne
  // doit rester lisible même vide de tout — « Facture » seul ne dirait rien.
  const titre = facture.vendor || fromIsoDate(facture.purchase_date, order) || t('factures.block.untitled');

  const details = [
    facture.amount != null ? formatMontant(facture.amount, i18n.language) : null,
    facture.vendor && facture.purchase_date ? fromIsoDate(facture.purchase_date, order) : null,
    facture.objets.length > 1 ? t('factures.block.covers', { count: facture.objets.length }) : null,
  ].filter(Boolean);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={titre}
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-xl border border-ink/10 bg-surface p-2 active:opacity-70"
    >
      <View className="h-12 w-12 overflow-hidden rounded-lg bg-sand">
        {vignette ? <Image source={vignette} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : null}
      </View>

      <View className="flex-1">
        <Text numberOfLines={1} className="text-body text-ink">
          {titre}
        </Text>
        {details.length > 0 ? (
          <Text numberOfLines={1} className="text-caption text-ink-soft">
            {details.join(' · ')}
          </Text>
        ) : null}
      </View>

      {facture.warranty_until ? <GarantieBadge until={facture.warranty_until} /> : null}

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

/**
 * La garantie, et surtout SI ELLE COURT ENCORE.
 *
 * C'est ce qui fait rouvrir une facture un mardi ordinaire : savoir d'un coup
 * d'oeil qu'un appareil est encore couvert avant d'appeler un réparateur.
 * Une date brute obligerait à faire le calcul de tête.
 */
function GarantieBadge({ until }: { until: string }) {
  const { t } = useTranslation();
  const finie = new Date(until) < new Date();
  return (
    <View className={finie ? 'rounded-full bg-ink/5 px-2 py-1' : 'rounded-full bg-teal-light px-2 py-1'}>
      <Text className={finie ? 'text-caption text-ink-soft' : 'text-caption font-semibold text-teal-dark'}>
        {t(finie ? 'factures.block.warranty_over' : 'factures.block.warranty_active')}
      </Text>
    </View>
  );
}

function formatMontant(montant: number, langue: string): string {
  // `Intl` est disponible dans Hermes depuis longtemps ; la devise reste
  // l'euro tant que l'app n'en propose pas d'autre (voir la migration).
  return new Intl.NumberFormat(langue, { style: 'currency', currency: 'EUR' }).format(montant);
}
