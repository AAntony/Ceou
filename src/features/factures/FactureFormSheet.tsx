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
import { SegmentedTabs } from '../../components/SegmentedTabs';
import { TextField } from '../../components/TextField';
import { logClientError } from '../../lib/errorLogging';
import { useMediaSource } from '../../lib/images/media';
import { pickImage, takePhoto } from '../../lib/images/pickAndUploadImage';
import { useScaled } from '../../lib/textScale';
import { useThemeColors } from '../../lib/theme';
import { PLACEHOLDER_IMAGES } from '../inventory/placeholders';
import { dateOrderFor, datePlaceholder, formatDateInput, fromIsoDate, isDateIncomplete, toIsoDate } from './dateField';
import { ObjetPickerModal } from './ObjetPickerModal';
import { lignesDe, type FactureLigne, type LigneSaisie } from './queries';

// AJOUTER UNE FACTURE DOIT PRENDRE DIX SECONDES.
//
// C'est un geste qu'on fait debout, dans un magasin ou un garage, souvent sans
// réseau. Le document d'abord, tout le reste facultatif : une facture
// photographiée sans rien saisir vaut infiniment mieux qu'une facture qu'on
// renonce à ajouter parce que le formulaire est long.
//
// ═══ DEUX NIVEAUX DE LECTURE, DEUX MODES ═══
//
// C'est le défaut signalé à l'usage, et il venait de leur confusion.
//
// DEPUIS LA FICHE D'UN OBJET (`ligne`), on parle de CET objet. On y voit ce
// qu'il a coûté et jusqu'à quand il est couvert — pas la liste de ses voisins
// de ticket, qui n'apprend rien et fait douter de ce qu'on est en train de
// modifier. Le ticket lui-même (vendeur, date) reste visible : c'est le même
// papier, et le corriger depuis là est légitime.
//
// DEPUIS LE DOSSIER (`complete`), on parle du TICKET. C'est là, et seulement
// là, qu'on voit tous les objets qu'il couvre, qu'on en ajoute et qu'on en
// retire. Un ticket de caisse est une chose du dossier, pas une chose d'un
// objet.
//
// ═══ CE QUI EST PARTAGÉ, CE QUI NE L'EST PAS ═══
//
// Un ticket, c'est UN magasin et UN jour : vendeur et date d'achat sont donc
// dans la section « Le ticket », une fois. Le MONTANT est propre à chaque
// chose achetée. La garantie est entre les deux : elle DOIT pouvoir différer
// (deux ans pour un frigo, un an pour un grille-pain) mais elle est presque
// toujours la même — d'où un sélecteur à deux positions, et un seul champ tant
// qu'on n'y touche pas.

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
type LigneEtat = {
  id?: string;
  objetId: string;
  name: string;
  photoUrl: string | null;
  montant: string;
  garantie: string;
};

type FactureFormSheetProps = {
  visible: boolean;
  /** Absente en création, présente en modification. */
  facture?: FactureEnEdition;
  /** L'objet d'où l'on vient, en création : la première ligne est déjà là. */
  objetInitial?: { objetId: string; name: string; photoUrl?: string | null };
  /**
   * `ligne` : la facture vue depuis un objet, réduite à ce qui le concerne.
   * `complete` : le ticket entier, avec tous ses objets.
   */
  mode?: 'ligne' | 'complete';
  /** En mode `ligne`, l'objet dont on édite la part. */
  objetId?: string;
  onClose: () => void;
  onSubmit: (valeurs: ValeursFacture) => void;
  /**
   * Le geste destructeur, absent en création : il n'y a rien à supprimer.
   *
   * Ce qu'il fait DÉPEND DE L'ÉCRAN : depuis le dossier il supprime le
   * document, depuis la fiche d'un objet il en retire seulement cet objet.
   * D'où le libellé passé par l'appelant plutôt que décidé ici.
   */
  onDelete?: () => void;
  deleteLabel?: string;
  loading?: boolean;
  /** Sortir CETTE facture en PDF, depuis le coin de la feuille. */
  onExport?: () => void;
};

export function FactureFormSheet({
  visible,
  facture,
  objetInitial,
  mode = 'complete',
  objetId,
  onClose,
  onSubmit,
  onDelete,
  deleteLabel,
  loading,
  onExport,
}: FactureFormSheetProps) {
  const { t, i18n } = useTranslation();
  const colors = useThemeColors();
  const order = dateOrderFor(i18n.language);

  // L'ETAT SE CONSTRUIT UNE FOIS, IL NE SE REMET PAS A JOUR PAR EFFET. La
  // feuille est remontee a chaque ouverture (voir la cle rendue par
  // useFeuilleFacture) : ces valeurs initiales sont donc relues a chaque fois,
  // sans le rendu en cascade qu'un effet de reinitialisation provoque.
  const [document, setDocument] = useState<string | null>(facture?.document_url ?? null);
  const [vendor, setVendor] = useState(facture?.vendor ?? '');
  const [purchase, setPurchase] = useState(() => fromIsoDate(facture?.purchase_date ?? null, order));
  const [total, setTotal] = useState(facture?.facture_amount != null ? String(facture.facture_amount) : '');
  const [lignes, setLignes] = useState<LigneEtat[]>(() => lignesInitiales(facture, objetInitial, order));
  const [supprimees, setSupprimees] = useState<string[]>([]);
  const [visionneuse, setVisionneuse] = useState(false);
  const [choixObjets, setChoixObjets] = useState(false);

  // TOUTES LES LIGNES SONT EN ETAT, MEME EN MODE `ligne`. On n'en affiche
  // qu'une, mais l'enregistrement les reecrit toutes : les oublier ici
  // reviendrait a detacher en silence les autres objets du ticket.
  const visible0 = mode === 'ligne' ? Math.max(0, lignes.findIndex((ligne) => ligne.objetId === objetId)) : 0;

  // En mode `ligne`, chaque garantie reste la sienne : un champ commun
  // modifierait celle des objets qu'on ne voit pas.
  const [garantiePartagee, setGarantiePartagee] = useState(
    () => mode === 'complete' && garantiesIdentiques(lignes),
  );
  const [garantieCommune, setGarantieCommune] = useState(() => lignes[0]?.garantie ?? '');

  const aperçu = useMediaSource(document);

  const choisir = async (source: 'camera' | 'library') => {
    try {
      // PAS DE RECADRAGE IMPOSÉ, contrairement aux photos d'objets. Une
      // facture est un document : rogner au format d'une vignette couperait le
      // montant ou l'en-tête, c'est-à-dire ce qu'on garde le document pour lire.
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

  const ajouterObjets = (objets: { objetId: string; name: string; photoUrl: string | null }[]) => {
    setChoixObjets(false);
    setLignes((actuelles) => [
      ...actuelles,
      // LA NOUVELLE LIGNE HÉRITE DE LA GARANTIE COMMUNE quand elle est
      // partagée : c'est ce qui rend « j'ajoute les trois autres chaises »
      // gratuit, au lieu de trois dates à ressaisir.
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
  const ligneVisible = lignes[visible0];

  return (
    <>
      <BottomSheetModal
        visible={visible}
        onClose={onClose}
        sheetClassName="rounded-t-3xl bg-surface px-6 pb-8 pt-6"
        scrollable
      >
        {/* LE TITRE ET L'EXPORT SUR LA MÊME LIGNE, l'action dans le coin haut
            droit : la place d'une action secondaire, qu'on trouve sans la
            chercher et qui ne dispute rien au contenu. */}
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
            C'est ici qu'on vient LIRE une facture, et un aperçu de 176 points
            ne laisse pas déchiffrer un montant. Vide, la zone reste le
            raccourci évident vers le choix d'une image. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(document ? 'factures.form.document_zoom' : 'factures.form.document_label')}
          onPress={() => (document ? setVisionneuse(true) : choisir('library'))}
          className="mb-3 h-44 items-center justify-center overflow-hidden rounded-2xl border border-ink/10 bg-sand"
        >
          {aperçu ? (
            // `contain` et non `cover` : on doit voir la facture ENTIÈRE, pas
            // un cadrage esthétique qui en coupe le montant.
            <Image source={aperçu} style={{ width: '100%', height: '100%' }} contentFit="contain" />
          ) : (
            <View className="items-center px-6">
              <Icon name="facture" size={28} color={colors.inkFaint} />
              <Text className="mt-2 text-center text-label text-ink-soft">{t('factures.form.document_empty')}</Text>
            </View>
          )}
        </Pressable>

        <ButtonRow>
          <Button label={t('factures.form.take_photo')} variant="ghost" onPress={() => choisir('camera')} />
          <Button label={t('factures.form.choose_file')} variant="ghost" onPress={() => choisir('library')} />
        </ButtonRow>

        {/* ═══ LE TICKET : ce qui vaut pour tout ce qu'il y a dessus ═══ */}
        <Section titre={t('factures.form.section_ticket')} />

        <TextField label={t('factures.form.vendor_label')} value={vendor} onChangeText={setVendor} />
        <TextField
          label={t('factures.form.purchase_label')}
          value={purchase}
          onChangeText={(v) => setPurchase(formatDateInput(v))}
          placeholder={datePlaceholder(order)}
          keyboardType="number-pad"
          error={isDateIncomplete(purchase, order) ? t('factures.form.date_invalid') : undefined}
        />
        {mode === 'complete' && plusieurs ? (
          <>
            <TextField
              label={t('factures.form.total_label')}
              value={total}
              onChangeText={setTotal}
              keyboardType="decimal-pad"
            />
            <Text className="-mt-2 mb-3 text-caption leading-4 text-ink-soft">{t('factures.form.total_hint')}</Text>
          </>
        ) : null}

        {mode === 'ligne' ? (
          <>
            {/* ═══ CET OBJET, ET LUI SEUL ═══ */}
            <Section titre={t('factures.form.section_objet')} />
            {ligneVisible ? (
              <>
                <TextField
                  label={t('factures.form.amount_label')}
                  value={ligneVisible.montant}
                  onChangeText={(v) => modifierLigne(visible0, { montant: v })}
                  keyboardType="decimal-pad"
                />
                <TextField
                  label={t('factures.form.warranty_label')}
                  value={ligneVisible.garantie}
                  onChangeText={(v) => modifierLigne(visible0, { garantie: formatDateInput(v) })}
                  placeholder={datePlaceholder(order)}
                  keyboardType="number-pad"
                  error={isDateIncomplete(ligneVisible.garantie, order) ? t('factures.form.date_invalid') : undefined}
                />
              </>
            ) : null}
            {/* LE NOMBRE, PAS LES NOMS. Lister les voisins de ticket prête à
                confusion — on ne les gère pas d'ici. Mais supprimer le
                document les touche tous, et ça doit se savoir. */}
            {plusieurs ? (
              <Text className="-mt-1 mb-1 text-caption text-ink-soft">
                {t('factures.form.shared_note', { count: lignes.length - 1 })}
              </Text>
            ) : null}
          </>
        ) : (
          <>
            {/* ═══ LES OBJETS COUVERTS ═══ */}
            <Section titre={t('factures.form.objets_title', { count: lignes.length })} />

            {plusieurs ? (
              <SegmentedTabs
                options={[
                  { value: 'partagee', label: t('factures.form.warranty_share') },
                  { value: 'separee', label: t('factures.form.warranty_split') },
                ]}
                value={garantiePartagee ? 'partagee' : 'separee'}
                onChange={(choix) => {
                  // EN REGROUPANT, LA PREMIÈRE GAGNE : il faut bien qu'une date
                  // l'emporte, et c'est celle qu'on a sous les yeux en haut de
                  // la liste. En séparant, chacune part de la commune.
                  if (choix === 'partagee') {
                    setGarantieCommune(lignes[0]?.garantie ?? '');
                    setLignes((actuelles) => actuelles.map((ligne) => ({ ...ligne, garantie: lignes[0]?.garantie ?? '' })));
                  } else {
                    setLignes((actuelles) => actuelles.map((ligne) => ({ ...ligne, garantie: garantieCommune })));
                  }
                  setGarantiePartagee(choix === 'partagee');
                }}
              />
            ) : null}

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

            {lignes.map((ligne, index) => (
              <CarteObjet
                key={ligne.objetId}
                ligne={ligne}
                order={order}
                garantiePartagee={garantiePartagee}
                retirable={plusieurs}
                onChange={(patch) => modifierLigne(index, patch)}
                onRetirer={() => retirerLigne(index)}
              />
            ))}

            {/* AUSSI VISIBLE QUE CE QU'IL COMMANDE. En `ghost` il se confondait
                avec le texte de la feuille : c'est pourtant le geste qui fait
                exister « une facture, plusieurs objets ». */}
            <Button label={t('factures.form.add_objet')} variant="outline" onPress={() => setChoixObjets(true)} />
          </>
        )}

        <View className="mt-6">
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
        </View>

        {/* LA SUPPRESSION EST ICI, pas cachée derrière une icône de la liste.
            C'est la feuille qu'on ouvre pour regarder une facture, donc celle
            où l'on décide de s'en défaire. Isolée en bas et en rouge, comme
            partout ailleurs dans l'app. */}
        {onDelete ? (
          <View className="mt-8 items-center border-t border-ink/10 pt-6">
            <Button label={deleteLabel ?? t('factures.delete.action')} variant="danger" onPress={onDelete} />
          </View>
        ) : null}
      </BottomSheetModal>

      {/* VOISINES DE LA FEUILLE, PAS ENFANTS. Deux modales imbriquées se
          disputent la présentation sur iOS ; côte à côte, la seconde s'affiche
          par-dessus la première, qui reste ouverte dessous. */}
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

/**
 * Un intitulé de section : le mot, puis un filet jusqu'au bord.
 *
 * La feuille dit maintenant DEUX choses de deux niveaux — ce qui vaut pour le
 * ticket, ce qui vaut pour chaque objet. Sans séparation visible, les champs
 * s'enchaînaient et on ne savait plus ce qu'on modifiait pour qui.
 */
function Section({ titre }: { titre: string }) {
  return (
    <View className="mb-3 mt-6 flex-row items-center gap-3">
      <Text className="text-caption font-semibold uppercase tracking-wider text-ink-soft">{titre}</Text>
      <View className="h-px flex-1 bg-ink/10" />
    </View>
  );
}

/** Un objet couvert par le ticket : sa photo, son nom, sa part. */
function CarteObjet({
  ligne,
  order,
  garantiePartagee,
  retirable,
  onChange,
  onRetirer,
}: {
  ligne: LigneEtat;
  order: ReturnType<typeof dateOrderFor>;
  garantiePartagee: boolean;
  retirable: boolean;
  onChange: (patch: Partial<LigneEtat>) => void;
  onRetirer: () => void;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const photo = useMediaSource(ligne.photoUrl);
  const largeur = useScaled(44);
  const hauteur = useScaled(33);

  return (
    <View className="mb-3 rounded-2xl border border-ink/10 bg-sand p-3">
      <View className="mb-2 flex-row items-center gap-3">
        {/* LA PHOTO PLUTÔT QUE LE NOM SEUL : « Chaise Ana » ne dit rien, la
            photo de la chaise, si. 4:3, le ratio des illustrations. */}
        <View style={{ width: largeur, height: hauteur }} className="overflow-hidden rounded-lg bg-surface">
          <Image
            source={photo ?? PLACEHOLDER_IMAGES.objet}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
          />
        </View>
        <Text numberOfLines={1} className="flex-1 text-body font-semibold text-ink">
          {ligne.name}
        </Text>
        {/* LE RETRAIT N'APPARAÎT QU'À PARTIR DE DEUX : une facture sans aucun
            objet n'existe pas — la base la supprimerait aussitôt (voir
            purge_facture_sans_objet). Pour n'en garder aucune, on supprime la
            facture, et c'est un autre bouton. */}
        {retirable ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('factures.form.remove_objet', { name: ligne.name })}
            onPress={onRetirer}
            hitSlop={10}
            className="rounded-full border border-ink/10 bg-surface p-1.5 active:opacity-60"
          >
            <Icon name="close" size={14} color={colors.inkSoft} />
          </Pressable>
        ) : null}
      </View>

      <TextField
        label={t('factures.form.amount_label')}
        value={ligne.montant}
        onChangeText={(v) => onChange({ montant: v })}
        keyboardType="decimal-pad"
      />
      {garantiePartagee ? null : (
        <TextField
          label={t('factures.form.warranty_label')}
          value={ligne.garantie}
          onChangeText={(v) => onChange({ garantie: formatDateInput(v) })}
          placeholder={datePlaceholder(order)}
          keyboardType="number-pad"
          error={isDateIncomplete(ligne.garantie, order) ? t('factures.form.date_invalid') : undefined}
        />
      )}
    </View>
  );
}

/** L'état de départ des lignes : celles de la facture, ou l'objet d'où l'on vient. */
function lignesInitiales(
  facture: FactureEnEdition | undefined,
  objetInitial: { objetId: string; name: string; photoUrl?: string | null } | undefined,
  order: ReturnType<typeof dateOrderFor>,
): LigneEtat[] {
  if (facture) {
    return lignesDe(facture).map((ligne) => ({
      id: ligne.id,
      objetId: ligne.objetId,
      name: ligne.name,
      photoUrl: ligne.photoUrl,
      // Le point décimal à l'affichage : la virgule reviendra à la saisie sur
      // un clavier français, et normaliserMontant la reprend.
      montant: ligne.amount != null ? String(ligne.amount) : '',
      garantie: fromIsoDate(ligne.warrantyUntil, order),
    }));
  }
  if (objetInitial) {
    return [{ ...objetInitial, photoUrl: objetInitial.photoUrl ?? null, montant: '', garantie: '' }];
  }
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
 * LA VIRGULE EST ACCEPTÉE, et il le faut : un clavier décimal français en pose
 * une, et `Number('12,50')` vaut NaN. Sans cette ligne, un montant sur deux
 * serait silencieusement perdu.
 */
function normaliserMontant(saisi: string): number | null {
  const nettoye = saisi.replace(',', '.').trim();
  if (!nettoye) return null;
  const valeur = Number(nettoye);
  return Number.isFinite(valeur) && valeur >= 0 ? valeur : null;
}
