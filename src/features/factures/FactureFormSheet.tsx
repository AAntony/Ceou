import { Image } from 'expo-image';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, Text, View } from 'react-native';
import { BottomSheetModal } from '../../components/BottomSheetModal';
import { Button } from '../../components/Button';
import { ButtonRow } from '../../components/ButtonRow';
import { FormActions } from '../../components/FormActions';
import { PhotoViewerModal } from '../../components/PhotoViewerModal';
import { TextField } from '../../components/TextField';
import { logClientError } from '../../lib/errorLogging';
import { useMediaSource } from '../../lib/images/media';
import { pickImage, takePhoto } from '../../lib/images/pickAndUploadImage';
import type { Facture } from '../../types/database';
import { dateOrderFor, datePlaceholder, formatDateInput, fromIsoDate, isDateIncomplete, toIsoDate } from './dateField';

// AJOUTER UNE FACTURE DOIT PRENDRE DIX SECONDES.
//
// C'est un geste qu'on fait debout, dans un magasin ou un garage, souvent
// sans réseau. Deux choses en découlent :
//
//  - LE DOCUMENT D'ABORD. On photographie, et le formulaire s'ouvre déjà
//    rempli de ce qui compte le plus. Demander le montant avant la photo
//    inverserait l'ordre du geste réel.
//  - LES QUATRE CHAMPS SONT FACULTATIFS. Une facture photographiée sans rien
//    saisir vaut infiniment mieux qu'une facture qu'on renonce à ajouter
//    parce que le formulaire est long. Le dossier dira ce qu'il sait.

/**
 * CE QUE LA FEUILLE LIT D'UNE FACTURE, ET RIEN DE PLUS.
 *
 * Pas `FactureWithObjets` : le dossier d'un logement ouvre la même feuille sur
 * des lignes qui viennent d'une fonction SQL, sans `user_id` ni `objets`. La
 * feuille n'a jamais eu besoin de ces champs-là — les demander n'aurait servi
 * qu'à interdire un appelant légitime.
 */
export type FactureModifiable = Pick<
  Facture,
  'document_url' | 'vendor' | 'amount' | 'purchase_date' | 'warranty_until'
>;

type FactureFormSheetProps = {
  visible: boolean;
  /** Absente en création, présente en modification. */
  facture?: FactureModifiable;
  onClose: () => void;
  onSubmit: (valeurs: {
    document: string;
    amount: number | null;
    purchaseDate: string | null;
    warrantyUntil: string | null;
    vendor: string | null;
  }) => void;
  loading?: boolean;
};

export function FactureFormSheet({ visible, facture, onClose, onSubmit, loading }: FactureFormSheetProps) {
  const { t, i18n } = useTranslation();
  const order = dateOrderFor(i18n.language);

  // L'ETAT SE CONSTRUIT UNE FOIS, IL NE SE REMET PAS A JOUR PAR EFFET.
  //
  // La feuille est remontee a chaque ouverture (voir la cle rendue par
  // useFeuilleFacture) : ces valeurs initiales sont donc relues a chaque
  // fois, sans le rendu en cascade qu'un effet de reinitialisation provoque.
  //
  // Le point decimal a l'affichage : la virgule reviendra a la saisie sur un
  // clavier francais, et normaliserMontant la reprend.
  const [document, setDocument] = useState<string | null>(facture?.document_url ?? null);
  const [vendor, setVendor] = useState(facture?.vendor ?? '');
  const [amount, setAmount] = useState(facture?.amount != null ? String(facture.amount) : '');
  const [purchase, setPurchase] = useState(() => fromIsoDate(facture?.purchase_date ?? null, order));
  const [warranty, setWarranty] = useState(() => fromIsoDate(facture?.warranty_until ?? null, order));
  const [visionneuse, setVisionneuse] = useState(false);

  const aperçu = useMediaSource(document);

  const choisir = async (source: 'camera' | 'library') => {
    try {
      // PAS DE RECADRAGE IMPOSÉ, contrairement aux photos d'objets. Une
      // facture est un document : rogner au format d'une vignette couperait
      // le montant ou l'en-tête, c'est-à-dire ce qu'on garde le document
      // pour lire.
      const uri = source === 'camera' ? await takePhoto(undefined, false) : await pickImage(undefined, false);
      if (uri) setDocument(uri);
    } catch (error) {
      logClientError(error, { source: 'facture_form', step: source });
      Alert.alert(t('common.error_generic'));
    }
  };

  const dateInvalide = isDateIncomplete(purchase, order) || isDateIncomplete(warranty, order);

  const valider = () => {
    if (!document) return;
    onSubmit({
      document,
      amount: normaliserMontant(amount),
      purchaseDate: toIsoDate(purchase, order),
      warrantyUntil: toIsoDate(warranty, order),
      vendor: vendor.trim() || null,
    });
  };

  return (
    <>
      <BottomSheetModal
        visible={visible}
        onClose={onClose}
        sheetClassName="rounded-t-3xl bg-surface px-6 pb-8 pt-6"
        scrollable
      >
        <Text className="mb-4 text-subheading font-bold text-ink">
          {t(facture ? 'factures.form.edit_title' : 'factures.form.add_title')}
        </Text>

        {/* APPUYER SUR LE DOCUMENT L'OUVRE EN GRAND — tant qu'il y en a un.
            Cette zone ouvrait la galerie, ce qui doublait inutilement les deux
            boutons posés juste en dessous ; or c'est ici qu'on vient LIRE une
            facture, et un aperçu de 176 points ne laisse pas déchiffrer un
            montant. Vide, en revanche, elle reste le raccourci évident vers le
            choix d'une image : c'est alors la seule chose qu'elle puisse
            vouloir dire. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(document ? 'factures.form.document_zoom' : 'factures.form.document_label')}
          onPress={() => (document ? setVisionneuse(true) : choisir('library'))}
          className="mb-3 h-44 items-center justify-center overflow-hidden rounded-xl bg-sand"
        >
          {aperçu ? (
            // `contain` et non `cover` : on doit voir la facture ENTIÈRE, pas
            // un cadrage esthétique qui en coupe le montant.
            <Image source={aperçu} style={{ width: '100%', height: '100%' }} contentFit="contain" />
          ) : (
            <Text className="px-4 text-center text-label text-ink-soft">{t('factures.form.document_empty')}</Text>
          )}
        </Pressable>

        <ButtonRow>
          <Button label={t('factures.form.take_photo')} variant="ghost" onPress={() => choisir('camera')} />
          <Button label={t('factures.form.choose_file')} variant="ghost" onPress={() => choisir('library')} />
        </ButtonRow>

        <View className="mt-4">
          <TextField label={t('factures.form.vendor_label')} value={vendor} onChangeText={setVendor} />
          <TextField
            label={t('factures.form.amount_label')}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
          />
          <TextField
            label={t('factures.form.purchase_label')}
            value={purchase}
            onChangeText={(v) => setPurchase(formatDateInput(v))}
            placeholder={datePlaceholder(order)}
            keyboardType="number-pad"
            error={isDateIncomplete(purchase, order) ? t('factures.form.date_invalid') : undefined}
          />
          <TextField
            label={t('factures.form.warranty_label')}
            value={warranty}
            onChangeText={(v) => setWarranty(formatDateInput(v))}
            placeholder={datePlaceholder(order)}
            keyboardType="number-pad"
            error={isDateIncomplete(warranty, order) ? t('factures.form.date_invalid') : undefined}
          />
        </View>

        <FormActions
          cancelLabel={t('common.cancel')}
          onCancel={onClose}
          confirmLabel={t('common.save')}
          onConfirm={valider}
          loading={loading}
          // LE DOCUMENT EST LA SEULE CHOSE OBLIGATOIRE. Sans lui il n'y a pas de
          // facture — les quatre champs, eux, se remplissent plus tard ou
          // jamais. Une date en cours de frappe bloque aussi : l'enregistrer
          // reviendrait à perdre en silence ce que la personne était en train
          // d'écrire.
          disabled={!document || dateInvalide}
        />
      </BottomSheetModal>

      {/* VOISINE DE LA FEUILLE, PAS ENFANT. Deux modales imbriquées se
          disputent la présentation sur iOS ; côte à côte, la seconde s'affiche
          par-dessus la première, qui reste ouverte dessous. C'est le montage
          déjà employé par l'ajout d'un ami et son scanner de QR. */}
      <PhotoViewerModal visible={visionneuse} uri={document} onClose={() => setVisionneuse(false)} />
    </>
  );
}

/**
 * Le montant tel que la base l'attend.
 *
 * LA VIRGULE EST ACCEPTÉE, et il le faut : un clavier décimal français en
 * pose une, et `Number('12,50')` vaut NaN. Sans cette ligne, un montant sur
 * deux serait silencieusement perdu.
 */
function normaliserMontant(saisi: string): number | null {
  const nettoye = saisi.replace(',', '.').trim();
  if (!nettoye) return null;
  const valeur = Number(nettoye);
  return Number.isFinite(valeur) && valeur >= 0 ? valeur : null;
}
