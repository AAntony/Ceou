import { Image } from 'expo-image';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { confirmDelete } from '../../lib/confirmDelete';
import { useMediaSource } from '../../lib/images/media';
import { useScaled } from '../../lib/textScale';
import { useThemeColors } from '../../lib/theme';
import { dateOrderFor, fromIsoDate } from './dateField';
import { FactureFormSheet } from './FactureFormSheet';
import { useCreateFacture, useDeleteFacture, useFacturesForObjet, useUpdateFacture, type FactureWithObjets } from './queries';

// LES PREUVES D'ACHAT D'UN OBJET, SUR SA FICHE.
//
// C'est là que naît l'intention — « je viens d'acheter ça, je garde le
// ticket » — donc c'est là que la fonctionnalité vit.
//
// ═══ POURQUOI UN HOOK QUI REND DES ÉLÉMENTS ═══
//
// L'ACTION et la LISTE ne vont pas au même endroit de l'écran. « Ajouter une
// facture » est un geste, il rejoint « Déplacer » et « Prêter » dans leur
// rangée — seule sur toute la largeur, la tuile écrasait les deux autres. La
// liste, elle, décrit l'objet : sa place est avec les informations.
//
// Les deux partagent pourtant un état — la feuille ouverte, ce qu'on y
// modifie, les écritures en cours. Ce hook le tient une fois et rend les
// morceaux à poser où il faut. Le projet a déjà ce motif : `usePullToRefresh`
// rend un `<RefreshControl>`.

export function useFactures(objetId: string, isOwner: boolean, habitationId?: string) {
  const { t } = useTranslation();
  const { data } = useFacturesForObjet(isOwner ? objetId : '');
  const creer = useCreateFacture();
  const modifier = useUpdateFacture();
  const supprimer = useDeleteFacture();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [enEdition, setEnEdition] = useState<FactureWithObjets | undefined>(undefined);
  // COMPTEUR D'OUVERTURES, ET IL SERT DE CLÉ DE REMONTAGE. La feuille lit ses
  // valeurs initiales à la construction ; sans remontage, rouvrir « Ajouter »
  // juste après en avoir enregistré une afficherait encore la précédente.
  const [ouvertures, setOuvertures] = useState(0);

  const factures = data ?? [];

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
      // `habitationId` ne part pas en base : il dit seulement quel dossier
      // rafraîchir sans attendre le réseau (voir useCreateFacture).
      creer.mutate({ objetId, habitationId, ...valeurs });
    }
    setSheetOpen(false);
  };

  return {
    /** À brancher sur la tuile de la rangée d'actions. */
    ouvrirAjout: () => ouvrir(undefined),

    /**
     * La liste, ou `null` quand il n'y a rien.
     *
     * LES FACTURES D'AUTRUI N'EXISTENT PAS POUR LUI, et il ne faut pas le lui
     * laisser croire : elles sont privées à leur propriétaire. Quelqu'un qui
     * voit une habitation partagée ne recevrait jamais que des listes vides,
     * et un bloc « Aucune facture » lui ferait penser que le propriétaire n'en
     * a pas mis.
     *
     * VIDE, ELLE NE S'AFFICHE PAS DU TOUT. Le moyen d'en ajouter une est dans
     * la rangée d'actions, sur le même écran : un intitulé « Factures » suivi
     * de « Aucune preuve d'achat » ne serait qu'une section morte.
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
                  confirmDelete(t, 'factures.delete.title', 'factures.delete.message', () =>
                    supprimer.mutate({ id: facture.id, vendor: facture.vendor }),
                  )
                }
              />
            ))}
          </View>
        </View>
      ),

    /** À poser n'importe où : c'est une modale. */
    feuille: isOwner ? (
      <FactureFormSheet
        key={ouvertures}
        visible={sheetOpen}
        facture={enEdition}
        onClose={() => setSheetOpen(false)}
        onSubmit={enregistrer}
        loading={creer.isPending || modifier.isPending}
      />
    ) : null,
  };
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

  // Proportion d'un ticket, plus haute que large : c'est ce qui la fait
  // reconnaître comme un document et non comme la photo d'un objet. Dessinée
  // en pixels, donc mise à l'échelle avec le texte posé à côté.
  const largeur = useScaled(40);
  const hauteur = useScaled(52);

  const date = fromIsoDate(facture.purchase_date, order);
  const titre = facture.vendor || date || t('factures.block.untitled');
  const garantieFinie = facture.warranty_until ? new Date(facture.warranty_until) < new Date() : null;

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
          liste qui reste régulière même à 200 % de texte. */}
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
