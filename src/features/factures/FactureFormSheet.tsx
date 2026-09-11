import { Image } from 'expo-image';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, Text, View } from 'react-native';
import { BottomSheetModal } from '../../components/BottomSheetModal';
import { Button } from '../../components/Button';
import { ButtonRow } from '../../components/ButtonRow';
import { FormActions } from '../../components/FormActions';
import { Icon } from '../../components/Icon';
import { PhotoViewerModal } from '../../components/PhotoViewerModal';
import { TextField } from '../../components/TextField';
import { TextLink } from '../../components/TextLink';
import { logClientError } from '../../lib/errorLogging';
import { useMediaSource } from '../../lib/images/media';
import { pickImage, takePhoto } from '../../lib/images/pickAndUploadImage';
import { useThemeColors } from '../../lib/theme';
import { dateOrderFor, datePlaceholder, formatDateInput, fromIsoDate, isDateIncomplete, toIsoDate } from './dateField';
import { ObjetPickerModal } from './ObjetPickerModal';
import { lignesDe, type FactureLigne, type LigneSaisie } from './queries';

// AJOUTER UNE FACTURE DOIT PRENDRE DIX SECONDES.
//
// C'est un geste qu'on fait debout, dans un magasin ou un garage, souvent
// sans réseau. Deux choses en découlent :
//
//  - LE DOCUMENT D'ABORD. On photographie, et le formulaire s'ouvre déjà
//    rempli de ce qui compte le plus. Demander le montant avant la photo
//    inverserait l'ordre du geste réel.
//  - TOUS LES CHAMPS SONT FACULTATIFS, sauf le document. Une facture
//    photographiée sans rien saisir vaut infiniment mieux qu'une facture
//    qu'on renonce à ajouter parce que le formulaire est long.
//
// ═══ CE QUI EST PARTAGÉ, CE QUI NE L'EST PAS ═══
//
// Un ticket, c'est UN magasin et UN jour : le vendeur et la date d'achat sont
// donc en haut, une fois. Le MONTANT, lui, est propre à chaque chose achetée —
// c'est tout le défaut qu'on corrige : un frigo à 800 € et un grille-pain à
// 40 € sur le même ticket ne peuvent pas partager un chiffre.
//
// LA GARANTIE EST ENTRE LES DEUX, et c'est pour ça qu'elle bascule. Deux ans
// pour le frigo, un an pour le grille-pain : elle DOIT pouvoir différer. Mais
// dans l'immense majorité des cas elle est la même pour tout le ticket, et la
// ressaisir ligne après ligne serait une corvée sans objet. Un seul champ donc,
// et un lien pour les séparer — la feuille s'ouvre déjà séparée quand les
// données le sont.

/** Ce que la feuille lit d'une facture, et rien de plus. */
export type FactureEnEdition = {
  document_url: string | null;
  vendor: string | null;
  purchase_date: string | null;
  facture_amount: number | null;
  lignes: FactureLigne[];
};

export type ValeursFacture = {
  document: string;
  vendor: string | null;
  purchaseDate: string | null;
  factureAmount: number | null;
  lignes: LigneSaisie[];
  /** Les liaisons retirées pendant la modification, par leur identifiant. */
  lignesSupprimees: string[];
};

/** Une ligne pendant la saisie : les montants et dates y sont du TEXTE. */
type LigneEtat = { id?: string; objetId: string; name: string; montant: string; garantie: string };

type FactureFormSheetProps = {
  visible: boolean;
  /** Absente en création, présente en modification. */
  facture?: FactureEnEdition;
  /** L'objet d'où l'on vient, en création : la première ligne est déjà là. */
  objetInitial?: { objetId: string; name: string };
  onClose: () => void;
  onSubmit: (valeurs: ValeursFacture) => void;
  loading?: boolean;
  /** Sortir CETTE facture en PDF, depuis le coin de la feuille. */
  onExport?: () => void;
};

export function FactureFormSheet({
  visible,
  facture,
  objetInitial,
  onClose,
  onSubmit,
  loading,
  onExport,
}: FactureFormSheetProps) {
  const { t, i18n } = useTranslation();
  const colors = useThemeColors();
  const order = dateOrderFor(i18n.language);

  // L'ETAT SE CONSTRUIT UNE FOIS, IL NE SE REMET PAS A JOUR PAR EFFET.
  //
  // La feuille est remontee a chaque ouverture (voir la cle rendue par
  // useFeuilleFacture) : ces valeurs initiales sont donc relues a chaque
  // fois, sans le rendu en cascade qu'un effet de reinitialisation provoque.
  const [document, setDocument] = useState<string | null>(facture?.document_url ?? null);
  const [vendor, setVendor] = useState(facture?.vendor ?? '');
  const [purchase, setPurchase] = useState(() => fromIsoDate(facture?.purchase_date ?? null, order));
  const [total, setTotal] = useState(facture?.facture_amount != null ? String(facture.facture_amount) : '');
  const [lignes, setLignes] = useState<LigneEtat[]>(() => lignesInitiales(facture, objetInitial, order));
  const [supprimees, setSupprimees] = useState<string[]>([]);
  const [visionneuse, setVisionneuse] = useState(false);
  const [choixObjets, setChoixObjets] = useState(false);

  // Séparée dès l'ouverture si les données le sont déjà : quelqu'un qui a
  // saisi deux garanties différentes ne doit pas les voir fusionner sous ses
  // yeux à la réouverture.
  const [garantiePartagee, setGarantiePartagee] = useState(() => garantiesIdentiques(lignes));
  const [garantieCommune, setGarantieCommune] = useState(() => lignes[0]?.garantie ?? '');

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

  const modifierLigne = (index: number, patch: Partial<LigneEtat>) => {
    setLignes((actuelles) => actuelles.map((ligne, i) => (i === index ? { ...ligne, ...patch } : ligne)));
  };

  const retirerLigne = (index: number) => {
    setLignes((actuelles) => {
      const partante = actuelles[index];
      // ON NE RETIENT QUE CELLES QUE LA BASE CONNAÎT. Une ligne ajoutée puis
      // retirée sans avoir été enregistrée n'a jamais existé pour elle.
      if (partante?.id) setSupprimees((deja) => [...deja, partante.id!]);
      return actuelles.filter((_, i) => i !== index);
    });
  };

  const ajouterObjets = (objets: { objetId: string; name: string }[]) => {
    setChoixObjets(false);
    setLignes((actuelles) => [
      ...actuelles,
      // LA NOUVELLE LIGNE HÉRITE DE LA GARANTIE COMMUNE quand elle est
      // partagée : c'est ce qui rend le geste « j'ajoute les trois autres
      // chaises » gratuit, au lieu de trois dates à ressaisir.
      ...objets.map((objet) => ({ ...objet, montant: '', garantie: garantiePartagee ? garantieCommune : '' })),
    ]);
  };

  const garantieInvalide = garantiePartagee
    ? isDateIncomplete(garantieCommune, order)
    : lignes.some((ligne) => isDateIncomplete(ligne.garantie, order));
  const dateInvalide = isDateIncomplete(purchase, order) || garantieInvalide;

  const valider = () => {
    if (!document || lignes.length === 0) return;
    onSubmit({
      document,
      vendor: vendor.trim() || null,
      purchaseDate: toIsoDate(purchase, order),
      // LE TOTAL DU TICKET N'A DE SENS QU'À PLUSIEURS. Avec un seul objet il
      // ferait double emploi avec son montant, et deux chiffres à tenir
      // d'accord sont deux chiffres qui finissent par se contredire.
      factureAmount: lignes.length > 1 ? normaliserMontant(total) : null,
      lignes: lignes.map((ligne) => ({
        id: ligne.id,
        objetId: ligne.objetId,
        name: ligne.name,
        amount: normaliserMontant(ligne.montant),
        warrantyUntil: toIsoDate(garantiePartagee ? garantieCommune : ligne.garantie, order),
      })),
      lignesSupprimees: supprimees,
    });
  };

  const plusieurs = lignes.length > 1;

  return (
    <>
      <BottomSheetModal
        visible={visible}
        onClose={onClose}
        sheetClassName="rounded-t-3xl bg-surface px-6 pb-8 pt-6"
        scrollable
      >
        {/* LE TITRE ET L'EXPORT SUR LA MÊME LIGNE, l'action dans le coin haut
            droit. C'est la place qu'occupe une action secondaire dans toutes
            les feuilles du système : elle ne dispute rien au contenu, et on
            la trouve sans la chercher. */}
        <View className="mb-4 flex-row items-center gap-3">
          <Text className="flex-1 text-subheading font-bold text-ink">
            {t(facture ? 'factures.form.edit_title' : 'factures.form.add_title')}
          </Text>
          {onExport ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('factures.export.one')}
              onPress={onExport}
              hitSlop={10}
              className="rounded-full border border-ink/10 p-2 active:opacity-60"
            >
              <Icon name="export" size={20} color={colors.accentDark} />
            </Pressable>
          ) : null}
        </View>

        {/* APPUYER SUR LE DOCUMENT L'OUVRE EN GRAND — tant qu'il y en a un.
            Cette zone ouvrait la galerie, ce qui doublait inutilement les deux
            boutons posés juste en dessous ; or c'est ici qu'on vient LIRE une
            facture, et un aperçu de 176 points ne laisse pas déchiffrer un
            montant. Vide, en revanche, elle reste le raccourci évident vers le
            choix d'une image. */}
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
            label={t('factures.form.purchase_label')}
            value={purchase}
            onChangeText={(v) => setPurchase(formatDateInput(v))}
            placeholder={datePlaceholder(order)}
            keyboardType="number-pad"
            error={isDateIncomplete(purchase, order) ? t('factures.form.date_invalid') : undefined}
          />
          {garantiePartagee ? (
            <TextField
              label={t('factures.form.warranty_label')}
              value={garantieCommune}
              onChangeText={(v) => setGarantieCommune(formatDateInput(v))}
              placeholder={datePlaceholder(order)}
              keyboardType="number-pad"
              error={isDateIncomplete(garantieCommune, order) ? t('factures.form.date_invalid') : undefined}
            />
          ) : null}
        </View>

        {/* ═══ LES OBJETS COUVERTS ═══ */}
        <Text className="mb-2 mt-2 text-label font-medium text-ink-soft">
          {t('factures.form.objets_title', { count: lignes.length })}
        </Text>

        {lignes.map((ligne, index) => (
          <View key={ligne.objetId} className="mb-3 rounded-2xl border border-ink/10 bg-sand p-3">
            <View className="mb-1 flex-row items-center gap-2">
              <Icon name="objet" size={16} color={colors.inkFaint} />
              <Text numberOfLines={1} className="flex-1 text-body font-semibold text-ink">
                {ligne.name}
              </Text>
              {/* LE RETRAIT N'APPARAÎT QU'À PARTIR DE DEUX : une facture sans
                  aucun objet n'existe pas — la base la supprimerait aussitôt
                  (voir purge_facture_sans_objet). Pour n'en garder aucune, on
                  supprime la facture, et c'est un autre bouton. */}
              {plusieurs ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('factures.form.remove_objet', { name: ligne.name })}
                  onPress={() => retirerLigne(index)}
                  hitSlop={10}
                  className="p-1 active:opacity-60"
                >
                  <Icon name="close" size={16} color={colors.inkSoft} />
                </Pressable>
              ) : null}
            </View>

            <TextField
              label={t('factures.form.amount_label')}
              value={ligne.montant}
              onChangeText={(v) => modifierLigne(index, { montant: v })}
              keyboardType="decimal-pad"
            />
            {garantiePartagee ? null : (
              <TextField
                label={t('factures.form.warranty_label')}
                value={ligne.garantie}
                onChangeText={(v) => modifierLigne(index, { garantie: formatDateInput(v) })}
                placeholder={datePlaceholder(order)}
                keyboardType="number-pad"
                error={isDateIncomplete(ligne.garantie, order) ? t('factures.form.date_invalid') : undefined}
              />
            )}
          </View>
        ))}

        {plusieurs ? (
          <View className="mb-2 flex-row justify-end">
            <TextLink
              label={t(garantiePartagee ? 'factures.form.warranty_split' : 'factures.form.warranty_share')}
              onPress={() => {
                // EN REGROUPANT, LA PREMIÈRE GAGNE. Il faut bien qu'une date
                // l'emporte, et c'est celle qu'on a sous les yeux en haut de
                // la liste. En séparant, chacune part de la commune.
                if (garantiePartagee) {
                  setLignes((actuelles) => actuelles.map((ligne) => ({ ...ligne, garantie: garantieCommune })));
                } else {
                  setGarantieCommune(lignes[0]?.garantie ?? '');
                }
                setGarantiePartagee((partagee) => !partagee);
              }}
            />
          </View>
        ) : null}

        <Button
          label={t('factures.form.add_objet')}
          variant="ghost"
          onPress={() => setChoixObjets(true)}
        />

        {plusieurs ? (
          <View className="mt-4">
            <TextField
              label={t('factures.form.total_label')}
              value={total}
              onChangeText={setTotal}
              keyboardType="decimal-pad"
            />
            <Text className="-mt-2 mb-2 text-caption text-ink-soft">{t('factures.form.total_hint')}</Text>
          </View>
        ) : null}

        <FormActions
          cancelLabel={t('common.cancel')}
          onCancel={onClose}
          confirmLabel={t('common.save')}
          onConfirm={valider}
          loading={loading}
          // LE DOCUMENT ET AU MOINS UN OBJET : sans l'un il n'y a pas de
          // facture, sans l'autre elle n'appartiendrait à aucun dossier et
          // serait supprimée aussitôt. Une date en cours de frappe bloque
          // aussi : l'enregistrer reviendrait à perdre en silence ce que la
          // personne était en train d'écrire.
          disabled={!document || lignes.length === 0 || dateInvalide}
        />
      </BottomSheetModal>

      {/* VOISINES DE LA FEUILLE, PAS ENFANTS. Deux modales imbriquées se
          disputent la présentation sur iOS ; côte à côte, la seconde s'affiche
          par-dessus la première, qui reste ouverte dessous. C'est le montage
          déjà employé par l'ajout d'un ami et son scanner de QR. */}
      <PhotoViewerModal visible={visionneuse} uri={document} onClose={() => setVisionneuse(false)} />
      <ObjetPickerModal
        visible={choixObjets}
        dejaChoisis={lignes.map((ligne) => ligne.objetId)}
        onClose={() => setChoixObjets(false)}
        onValider={ajouterObjets}
      />
    </>
  );
}

/** L'état de départ des lignes : celles de la facture, ou l'objet d'où l'on vient. */
function lignesInitiales(
  facture: FactureEnEdition | undefined,
  objetInitial: { objetId: string; name: string } | undefined,
  order: ReturnType<typeof dateOrderFor>,
): LigneEtat[] {
  if (facture) {
    return lignesDe(facture).map((ligne) => ({
      id: ligne.id,
      objetId: ligne.objetId,
      name: ligne.name,
      // Le point décimal à l'affichage : la virgule reviendra à la saisie sur
      // un clavier français, et normaliserMontant la reprend.
      montant: ligne.amount != null ? String(ligne.amount) : '',
      garantie: fromIsoDate(ligne.warrantyUntil, order),
    }));
  }
  if (objetInitial) return [{ ...objetInitial, montant: '', garantie: '' }];
  return [];
}

/** Vrai quand toutes les lignes portent la même garantie — y compris aucune. */
function garantiesIdentiques(lignes: LigneEtat[]): boolean {
  if (lignes.length <= 1) return true;
  return lignes.every((ligne) => ligne.garantie === lignes[0].garantie);
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
