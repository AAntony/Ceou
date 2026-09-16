import { useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useSession } from '../auth/SessionProvider';
import { PDF_MIME } from '../../lib/files/document';
import { isLocalUri } from '../../lib/images/media';
import { supabase } from '../../lib/supabase/client';
import type { Facture } from '../../types/database';
import { newId } from '../../lib/uuid';
import { deleteOp, insertOp, updateOp, uploadOp, useLocalFirstWrite, type WriteOp } from '../../lib/writeQueue';
import { deposerOp } from '../corbeille/queries';
import { cancelWarrantyReminder, scheduleWarrantyReminder } from '../notifications/warrantyReminders';
import type { SearchIndexEntry } from '../search/queries';
import type { ExportRow } from './exportTree';

// LES FACTURES S'ÉCRIVENT COMME LE RESTE : par la file, jamais en direct.
//
// Ajouter une facture est exactement le geste qu'on fait dans un magasin, un
// garage ou une cave — c'est-à-dire souvent sans réseau. Une écriture qui
// exigerait la connexion perdrait le document au moment précis où on vient de
// le photographier.
//
// ═══ EN-TÊTE ET LIGNES ═══
//
// Le TICKET porte le document, le vendeur et la date d'achat. Chaque CHOSE
// ACHETÉE porte son montant et sa fin de garantie. Un ticket de caisse avec un
// frigo à 800 € et un grille-pain à 40 € : un seul document, deux lignes.
//
// Toutes les écritures d'ici manipulent donc les deux tables ensemble, et dans
// le même lot — la liaison référence la facture, les séparer laisserait la
// seconde partir avant que la première ne soit acceptée.

/**
 * Ce qu'un objet a coûté sur une facture, et jusqu'à quand il est couvert.
 *
 * `id` est celui de la LIAISON et non de l'objet : c'est lui qu'on modifie,
 * et c'est lui qui nomme le rappel de garantie.
 */
export type FactureLigne = {
  id: string;
  objetId: string;
  name: string;
  /** De quoi reconnaitre l'objet d'un coup d'oeil, et pointer vers sa fiche. */
  photoUrl: string | null;
  amount: number | null;
  warrantyUntil: string | null;
};

/**
 * De quoi est fait le document d'une facture.
 *
 * `image` : une photo du ticket, redimensionnée et ré-encodée à l'envoi.
 * `pdf`   : un fichier reçu par courriel, envoyé tel quel — le ré-encoder le
 *           détruirait, et il peut compter plusieurs pages.
 */
export type DocumentKind = 'image' | 'pdf';

/** L'extension du fichier stocké. Elle suit le type, sinon le PDF s'appelle .jpg. */
function extensionDe(kind: DocumentKind): string {
  return kind === 'pdf' ? 'pdf' : 'jpg';
}

/** Le type MIME à poser sur l'envoi, ou `undefined` pour laisser passer une image. */
function contentTypeDe(kind: DocumentKind): string | undefined {
  return kind === 'pdf' ? PDF_MIME : undefined;
}

/** Une facture telle que la fiche d'un objet la connaît. */
export type FactureDObjet = {
  id: string;
  document_url: string | null;
  document_kind: string;
  vendor: string | null;
  purchase_date: string | null;
  /** Total du ticket, facultatif : il sert quand aucune ligne n'est chiffrée. */
  facture_amount: number | null;
  created_at: string;
  /** Ce que CET objet a coûté. */
  amount: number | null;
  /** Jusqu'à quand CET objet est couvert. */
  warranty_until: string | null;
  lignes: FactureLigne[];
};

/** Une facture telle que le dossier d'un logement la connaît. */
export type FactureDuDossier = {
  id: string;
  document_url: string | null;
  document_kind: string;
  /** Somme des lignes de ce logement, à défaut le total du ticket. */
  amount: number | null;
  /** Le total du ticket tel qu'il a été saisi : c'est lui que le formulaire rééditera. */
  facture_amount: number | null;
  purchase_date: string | null;
  vendor: string | null;
  created_at: string;
  lignes: FactureLigne[];
};

/**
 * Une facture proposée au rattachement.
 *
 * ELLE PORTE SES LIGNES, et c'est la seule raison pour laquelle la fonction
 * SQL les rend : sans elles, rattacher un objet ne pourrait rien afficher
 * avant la réponse du serveur — donc rien du tout hors ligne. Voir
 * `useAttachFactureToObjet`, et la migration qui les a ajoutées.
 */
export type FactureARattacher = {
  id: string;
  document_url: string | null;
  document_kind: string;
  vendor: string | null;
  purchase_date: string | null;
  /** La somme des lignes, à défaut le total du ticket. C'est ce qui s'affiche. */
  amount: number | null;
  /** Le total du ticket tel qu'il a été saisi : c'est lui que le formulaire rééditera. */
  facture_amount: number | null;
  created_at: string;
  lignes: FactureLigne[];
};

/**
 * Les lignes telles que le SQL les rend, re-typées.
 *
 * `jsonb` arrive en `Json` : une valeur dont TypeScript ne sait rien. On la
 * ramène à la forme attendue en un seul endroit plutôt qu'à chaque lecture —
 * et on se protège d'un `null` (une facture sans ligne n'existe pas, mais
 * `jsonb_agg` d'un ensemble vide rend `null`, pas `[]`).
 */
function lignesDepuisJson(valeur: unknown): FactureLigne[] {
  return Array.isArray(valeur) ? (valeur as FactureLigne[]) : [];
}

/**
 * Les lignes d'une facture, MÊME RELUE D'UN CACHE ÉCRIT AVANT ELLES.
 *
 * À utiliser partout plutôt que `facture.lignes` directement. Le type promet
 * un tableau, le disque ne le promet pas : le cache est persisté sur sept
 * jours, et une facture écrite par la version d'avant l'en-tête/lignes n'a pas
 * ce champ. Le rendu y lisait `.length` et s'arrêtait avant d'afficher quoi
 * que ce soit — c'est le défaut qui a fait planter chaque fiche d'objet.
 *
 * Le jeton de version du cache (voir queryClient) jette ces lignes-là au
 * démarrage suivant ; ce garde-fou couvre l'instant d'avant, et le prochain
 * changement de forme qu'on oubliera de lui signaler.
 */
export function lignesDe(facture: { lignes?: FactureLigne[] }): FactureLigne[] {
  return Array.isArray(facture.lignes) ? facture.lignes : [];
}

/** Les lignes encore sous garantie à cet instant. */
export function sousGarantie(lignes: FactureLigne[] | undefined): boolean {
  const maintenant = Date.now();
  return (lignes ?? []).some((ligne) => ligne.warrantyUntil && new Date(ligne.warrantyUntil).getTime() > maintenant);
}

/** Les noms des objets couverts, dans l'ordre où la fonction SQL les rend. */
export function nomsDesObjets(lignes: FactureLigne[] | undefined): string[] {
  return (lignes ?? []).map((ligne) => ligne.name);
}

/**
 * Les factures qui prouvent l'achat d'un objet.
 *
 * Un objet peut en avoir plusieurs : l'achat, puis la réparation, puis
 * l'extension de garantie. Chaque facture arrive avec la ligne DE CET OBJET
 * — c'est elle qui s'affiche sur sa fiche — et avec toutes ses autres lignes,
 * pour pouvoir l'ouvrir entière en modification.
 */
export function useFacturesForObjet(objetId: string) {
  return useQuery({
    queryKey: ['facturesForObjet', objetId],
    queryFn: async (): Promise<FactureDObjet[]> => {
      const { data, error } = await supabase.rpc('factures_for_objet', { p_objet_id: objetId });
      if (error) throw error;
      return (data ?? []).map((row) => ({ ...row, lignes: lignesDepuisJson(row.lignes) }) as FactureDObjet);
    },
    enabled: Boolean(objetId),
  });
}

/** Le dossier d'un logement : tout ce qui y est prouvé. */
export function useFacturesForHabitation(habitationId: string | undefined) {
  return useQuery({
    queryKey: ['facturesForHabitation', habitationId],
    queryFn: async (): Promise<FactureDuDossier[]> => {
      const { data, error } = await supabase.rpc('factures_for_habitation', { p_habitation_id: habitationId! });
      if (error) throw error;
      return (data ?? []).map((row) => ({ ...row, lignes: lignesDepuisJson(row.lignes) }) as FactureDuDossier);
    },
    enabled: Boolean(habitationId),
  });
}

/**
 * Ce qui MANQUE au dossier : les objets de ce logement qu'aucune facture ne
 * couvre.
 *
 * L'envers de `useFacturesForHabitation`, et la moitié utile un mardi
 * ordinaire : la liste des factures dit ce qu'on a fait, celle-ci dit ce qu'il
 * reste à faire. Personne ne se souvient de ce qu'il n'a PAS photographié.
 *
 * RÉSERVÉE AU PROPRIÉTAIRE, et pas par pudeur : les liaisons facture/objet ne
 * sont visibles que de lui (RLS), donc pour quelqu'un d'autre la fonction
 * rendrait TOUT l'inventaire comme « sans facture ». Ce serait faux et
 * inquiétant.
 */
export function useObjetsSansFacture(habitationId: string | undefined) {
  return useQuery({
    queryKey: ['objetsSansFacture', habitationId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('objets_sans_facture', { p_habitation_id: habitationId! });
      if (error) throw error;
      return data ?? [];
    },
    enabled: Boolean(habitationId),
  });
}

/**
 * Tout ce qu'il faut pour l'écran d'export : l'arbre ET les factures.
 *
 * UNE SEULE REQUÊTE POUR TOUS LES LOGEMENTS, et pas une par habitation. La
 * sélection se promène d'un logement à l'autre — on peut vouloir tout le
 * dossier d'assurance d'un coup — et la découper obligerait à recharger à
 * chaque dépliage, c'est-à-dire à attendre au milieu d'un geste de sélection.
 * Le volume est celui des factures saisies à la main : quelques dizaines.
 *
 * `enabled` plutôt qu'un identifiant optionnel : cette requête ne dépend de
 * rien, c'est l'écran qui dit quand elle a lieu d'être.
 */
export function useFacturesExportRows(enabled: boolean) {
  return useQuery({
    queryKey: ['facturesExportRows'],
    queryFn: async (): Promise<ExportRow[]> => {
      const { data, error } = await supabase.rpc('factures_export_rows');
      if (error) throw error;
      return (data ?? []) as ExportRow[];
    },
    enabled,
  });
}

// ═══════════════════════════════════════════════════════════════════════
// LES ÉCRITURES
// ═══════════════════════════════════════════════════════════════════════

/** Une ligne telle que le formulaire la rend : sans identifiant si elle est neuve. */
export type LigneSaisie = {
  /** Absent pour une ligne qu'on vient d'ajouter. */
  id?: string;
  objetId: string;
  name: string;
  /** Connue quand la ligne vient du formulaire ; relue du serveur sinon. */
  photoUrl?: string | null;
  amount: number | null;
  warrantyUntil: string | null;
};

type NouvelleFacture = {
  /**
   * Le logement où se trouvent ces objets, quand l'écran appelant le connaît.
   *
   * IL NE SERT QU'AU CACHE ET AUX RAPPELS, jamais à l'écriture — une facture
   * n'appartient à aucun logement, elle en hérite par ses objets (voir la
   * migration). Mais les DEUX listes du dossier changent au moment où on en
   * ajoute une : la facture entre dans l'une, les objets sortent de l'autre.
   * Hors ligne, rien ne se rechargera pour le dire.
   */
  habitationId?: string;
  /** Chemin local du document choisi, ou adresse déjà connue. */
  document: string;
  /** Une photo du ticket, ou un PDF reçu par courriel. */
  documentKind: DocumentKind;
  vendor: string | null;
  purchaseDate: string | null;
  /** Total du ticket, facultatif. */
  factureAmount: number | null;
  lignes: LigneSaisie[];
};

export function useCreateFacture() {
  const { session } = useSession();
  const client = useQueryClient();
  const { t, i18n } = useTranslation();

  return useLocalFirstWrite((input: NouvelleFacture) => {
    const id = newId();
    const userId = session!.user.id;
    const local = isLocalUri(input.document);
    const habitationId = input.habitationId ?? null;

    // Les identifiants sont tirés ICI et non par la base : ils servent aussi
    // de clé aux rappels de garantie et aux mises à jour optimistes, qui ont
    // lieu avant que le serveur n'ait vu quoi que ce soit.
    const lignes: FactureLigne[] = input.lignes.map((ligne) => ({
      id: ligne.id ?? newId(),
      objetId: ligne.objetId,
      name: ligne.name,
      photoUrl: ligne.photoUrl ?? null,
      amount: ligne.amount,
      warrantyUntil: ligne.warrantyUntil,
    }));

    // LE RAPPEL DE GARANTIE SE POSE ICI, PAS DEPUIS L'ÉCRAN. Une facture
    // s'ajoute depuis la fiche d'un objet comme depuis le dossier d'un
    // logement : le poser dans chaque écran, c'est l'oublier dans le
    // prochain. Un par LIGNE, puisque deux objets du même ticket n'ont pas la
    // même durée de garantie.
    for (const ligne of lignes) {
      void scheduleWarrantyReminder(
        { id: ligne.id, objet: ligne.name, warrantyUntil: ligne.warrantyUntil, habitationId },
        t,
        i18n.language,
      );
    }

    const facture: Facture = {
      id,
      user_id: userId,
      // NUL TANT QUE LE FICHIER N'EST PAS PARTI, et c'est voulu : c'est
      // l'opération d'envoi qui écrira l'adresse. Y poser le chemin local
      // laisserait un `file://` en base si le lot échouait — une adresse
      // qu'aucun autre appareil ne saurait ouvrir. Même règle que les photos.
      document_url: local ? null : input.document,
      document_kind: input.documentKind,
      amount: input.factureAmount,
      purchase_date: input.purchaseDate,
      vendor: input.vendor,
      created_at: new Date().toISOString(),
    };

    return {
      describe: { kind: 'create' as const, name: input.vendor ?? '' },
      ops: [
        insertOp('factures', [facture]),
        // LES INSERTIONS DANS LE MÊME LOT, dans cet ordre. Les liaisons
        // référencent la facture : séparées, les secondes pourraient partir
        // avant que la première ne soit acceptée — c'est exactement la course
        // qui faisait refuser un déplacement au retour du réseau.
        insertOp('facture_objets', lignes.map(enLigneDeBase(id))),
        ...(local
          ? [
              uploadOp({
                uri: input.document,
                bucket: 'factures',
                // Le dossier porte l'identifiant de la personne : c'est ce
                // préfixe, et lui seul, qui autorise la lecture du fichier
                // (voir can_read_media). Une facture n'est donc lisible que
                // par son propriétaire, par construction.
                path: `${userId}/${id}.${extensionDe(input.documentKind)}`,
                // Absent pour une image : elle doit passer par le
                // redimensionnement. Présent pour un PDF : il part tel quel.
                contentType: contentTypeDe(input.documentKind),
                then: { table: 'factures', id, column: 'document_url' },
              }),
            ]
          : []),
      ],
      // ELLE DOIT APPARAITRE TOUT DE SUITE, sur la fiche de CHAQUE objet
      // qu'elle couvre. Sans ça, la facture n'existe que côté serveur : hors
      // ligne la liste ne se recharge jamais, et on vient de photographier un
      // document qui n'apparaît nulle part.
      //
      // Le document montré est le fichier LOCAL, déjà sur l'appareil : il n'y
      // a aucune raison d'attendre l'envoi pour l'afficher.
      appends: [
        ...lignes.map((ligne) => ({
          key: ['facturesForObjet', ligne.objetId],
          row: {
            ...facture,
            document_url: input.document,
            facture_amount: input.factureAmount,
            amount: ligne.amount,
            warranty_until: ligne.warrantyUntil,
            lignes,
          },
        })),
        // ET DANS LE DOSSIER DU LOGEMENT, quand l'écran a dit lequel. La forme
        // est celle que rend `factures_for_habitation`. L'écran retrie la
        // liste lui-même, sinon la nouvelle venue s'ajouterait en queue au
        // lieu de sa place chronologique.
        ...(habitationId
          ? [
              {
                key: ['facturesForHabitation', habitationId],
                row: {
                  ...facture,
                  document_url: input.document,
                  amount: totalDesLignes(lignes) ?? input.factureAmount,
                  lignes,
                },
              },
            ]
          : []),
      ],
      // LES OBJETS QUITTENT LA LISTE DES ORPHELINS, tout de suite. C'est la
      // moitié du geste : on vient de rayer des lignes d'une liste qu'on
      // cherche à vider, et les voir rester donnerait le sentiment que rien
      // n'a marché.
      sets: retirerDesOrphelins(client, habitationId, lignes.map((ligne) => ligne.objetId)),
      result: facture,
    };
  });
}

/** La ligne telle que la base l'attend. */
function enLigneDeBase(factureId: string) {
  return (ligne: FactureLigne) => ({
    id: ligne.id,
    facture_id: factureId,
    objet_id: ligne.objetId,
    amount: ligne.amount,
    warranty_until: ligne.warrantyUntil,
  });
}

/** La somme des lignes chiffrées, ou `null` si aucune ne l'est. */
export function totalDesLignes(lignes: FactureLigne[] | undefined): number | null {
  const chiffrees = (lignes ?? []).filter((ligne) => ligne.amount != null);
  if (chiffrees.length === 0) return null;
  return chiffrees.reduce((somme, ligne) => somme + Number(ligne.amount), 0);
}

/** La liste des objets sans facture, privée de ceux qui viennent d'en recevoir une. */
function retirerDesOrphelins(
  client: ReturnType<typeof useQueryClient>,
  habitationId: string | null,
  objetIds: string[],
): { key: string[]; data: unknown }[] {
  if (!habitationId) return [];
  const key = ['objetsSansFacture', habitationId];
  const liste = client.getQueryData<{ id: string }[]>(key);
  if (!liste) return [];
  const linkedIds = new Set(objetIds);
  return [{ key, data: liste.filter((objet) => !linkedIds.has(objet.id)) }];
}

export function useUpdateFacture() {
  const { session } = useSession();
  const { t, i18n } = useTranslation();

  return useLocalFirstWrite(
    (input: {
      id: string;
      vendor: string | null;
      purchaseDate: string | null;
      factureAmount: number | null;
      /**
       * Le document tel que la feuille le rend : l'adresse déjà connue si on
       * n'y a pas touché, un chemin local si on vient de le rephotographier.
       */
      document?: string;
      /** Ce qu'est le document ci-dessus. Ignoré quand il n'a pas changé. */
      documentKind: DocumentKind;
      /** L'état voulu des lignes. Celles sans `id` sont nouvelles. */
      lignes: LigneSaisie[];
      /** Les liaisons retirées, par leur identifiant. */
      lignesSupprimees?: string[];
      /** Ne part pas en base : il dit où renvoyer depuis un rappel. */
      habitationId?: string;
    }) => {
      const userId = session!.user.id;
      const habitationId = input.habitationId ?? null;

      const lignes: FactureLigne[] = input.lignes.map((ligne) => ({
        id: ligne.id ?? newId(),
        objetId: ligne.objetId,
        name: ligne.name,
        photoUrl: ligne.photoUrl ?? null,
        amount: ligne.amount,
        warrantyUntil: ligne.warrantyUntil,
      }));

      // Corriger une date de fin de garantie doit déplacer le rappel tout de
      // suite, et l'effacer doit le retirer — c'est `scheduleWarrantyReminder`
      // qui tranche entre les deux. Une ligne retirée perd le sien.
      for (const ligne of lignes) {
        void scheduleWarrantyReminder(
          { id: ligne.id, objet: ligne.name, warrantyUntil: ligne.warrantyUntil, habitationId },
          t,
          i18n.language,
        );
      }
      for (const ligneId of input.lignesSupprimees ?? []) void cancelWarrantyReminder(ligneId);

      // REMPLACER LE DOCUMENT, ET PAS SEULEMENT LES CHAMPS. La feuille montre
      // « Photographier » et « Choisir une image » en modification aussi :
      // sans cette branche, on reprenait en photo une facture floue, on
      // enregistrait, et rien ne changeait — en silence.
      //
      // C'est `isLocalUri` qui tranche, pas un drapeau posé par l'écran : une
      // adresse http est celle qui était déjà là, il n'y a rien à envoyer.
      const remplace = input.document != null && isLocalUri(input.document);

      const champs = {
        vendor: input.vendor,
        amount: input.factureAmount,
        purchase_date: input.purchaseDate,
        // ÉCRIT SEULEMENT QUAND LE DOCUMENT CHANGE. Le réécrire à chaque
        // modification de vendeur ferait passer pour une image un PDF envoyé
        // depuis une version qui ne savait pas encore les distinguer.
        ...(remplace ? { document_kind: input.documentKind } : {}),
      };

      // LES LIGNES DÉJÀ CONNUES SE MODIFIENT, LES NEUVES S'INSÈRENT. La
      // distinction tient au seul `id` rendu par le formulaire : il vient de
      // la base pour les premières, il n'existe pas pour les secondes.
      const connues = new Set(input.lignes.filter((ligne) => ligne.id).map((ligne) => ligne.id));
      const aInserer = lignes.filter((ligne) => !connues.has(ligne.id));

      const ops: WriteOp[] = [
        updateOp('factures', input.id, champs),
        ...lignes
          .filter((ligne) => connues.has(ligne.id))
          .map((ligne) => updateOp('facture_objets', ligne.id, {
            amount: ligne.amount,
            warranty_until: ligne.warrantyUntil,
          })),
        ...(aInserer.length > 0 ? [insertOp('facture_objets', aInserer.map(enLigneDeBase(input.id)))] : []),
        ...(input.lignesSupprimees ?? []).map((ligneId) => deleteOp('facture_objets', ligneId)),
        ...(remplace
          ? [
              uploadOp({
                uri: input.document!,
                bucket: 'factures',
                // LE MÊME CHEMIN QU'À LA CRÉATION, donc l'ancien fichier est
                // écrasé (`upsert`). L'adresse rendue porte un horodatage,
                // qui sert de clé de cache : sans lui, expo-image continuerait
                // d'afficher l'ancienne image.
                path: `${userId}/${input.id}.${extensionDe(input.documentKind)}`,
                contentType: contentTypeDe(input.documentKind),
                then: { table: 'factures', id: input.id, column: 'document_url' },
              }),
            ]
          : []),
      ];

      return {
        describe: { kind: 'update' as const, name: input.vendor ?? '' },
        ops,
        // Le fichier local s'affiche tout de suite : il est déjà sur
        // l'appareil, il n'y a aucune raison d'attendre l'envoi.
        //
        // Les lignes sont écrasées en bloc plutôt que rapiécées : leur nombre
        // a pu changer, et la règle générale du cache ne sait déduire que ce
        // qui porte un identifiant qu'elle reconnaît.
        patches: [
          {
            id: input.id,
            patch: {
              ...champs,
              lignes,
              ...(remplace ? { document_url: input.document } : {}),
            },
          },
        ],
        result: undefined,
      };
    },
  );
}

export function useDeleteFacture() {
  const client = useQueryClient();

  return useLocalFirstWrite(
    (input: {
      id: string;
      vendor: string | null;
      /** Les lignes qui partent avec elle : elles nomment les rappels ET les objets à libérer. */
      lignes: FactureLigne[];
      /** Ne part pas en base : il dit quelles listes du dossier corriger. */
      habitationId?: string;
    }) => {
      // Les rappels de garantie partent avec elle — un par ligne — et depuis la
      // mutation plutôt que depuis un écran : on supprime une facture aussi bien
      // depuis la fiche d'un objet que depuis le dossier.
      for (const ligne of input.lignes) void cancelWarrantyReminder(ligne.id);

      return {
        describe: { kind: 'delete' as const, name: input.vendor ?? '' },
        // Les liaisons partent en cascade côté base (`on delete cascade`) : rien
        // à supprimer ici. Le fichier du bucket, lui, reste — comme les photos
        // d'objets supprimés. Le ménage se fait à la suppression du compte.
        //
        // La règle générale du cache fait sortir la facture de toutes les listes
        // où elle apparaît : son identifiant est celui d'une ligne de premier
        // niveau. Ce qu'elle ne sait pas, c'est que ses objets redeviennent des
        // orphelins — même geste que le détachement, pour la même raison.
        //
        // L'INSTANTANÉ D'ABORD : le document et ses lignes partent ensemble,
        // et la corbeille est le seul endroit où on pourra les retrouver.
        ops: [deposerOp('facture', input.id), deleteOp('factures', input.id)],
        sets: remettreDansLesOrphelins(client, input.habitationId ?? null, input.lignes),
        result: undefined,
      };
    },
  );
}

/**
 * Les factures déjà enregistrées auxquelles on peut rattacher cet objet.
 *
 * LES PLUS RÉCENTES D'ABORD, et celles déjà rattachées écartées. Un
 * rattachement suit presque toujours une saisie de la minute précédente : on
 * sort du magasin avec quatre chaises et un seul ticket.
 */
export function useFacturesARattacher(objetId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['facturesARattacher', objetId],
    queryFn: async (): Promise<FactureARattacher[]> => {
      const { data, error } = await supabase.rpc('factures_a_rattacher', { p_objet_id: objetId });
      if (error) throw error;
      // `lignes` arrive en `Json`, que TypeScript ne sait pas relire : on la
      // ramène à sa forme ici, comme les deux autres lectures de facture.
      return (data ?? []).map((row) => ({ ...row, lignes: lignesDepuisJson(row.lignes) }) as FactureARattacher);
    },
    enabled: enabled && Boolean(objetId),
  });
}

/**
 * Rattacher CET objet à une facture déjà enregistrée.
 *
 * Le geste du ticket de caisse, vu depuis l'objet : « celui-ci était sur le
 * même ticket ». La ligne naît sans montant ni garantie — on les renseigne
 * ensuite en ouvrant la facture, où l'on voit les autres lignes en face.
 */
export function useAttachFactureToObjet() {
  const client = useQueryClient();

  return useLocalFirstWrite(
    (input: {
      /**
       * LA FACTURE ENTIÈRE, et pas seulement son identifiant.
       *
       * C'est ce qui permet de la poser dans le cache tout de suite. Elle
       * vient telle quelle de la liste de rattachement — qui la rend avec ses
       * lignes précisément pour ça.
       */
      facture: FactureARattacher;
      objetId: string;
      /** Le nom et la photo de l'objet : c'est la nouvelle ligne qui les porte. */
      objetName: string;
      objetPhotoUrl: string | null;
      /** Ne part pas en base : il dit quelles listes du dossier corriger. */
      habitationId?: string;
    }) => {
      // L'identifiant est tiré ICI : il nomme la liaison en base, et sert de
      // clé à la mise à jour du cache qui a lieu avant toute réponse.
      const ligne: FactureLigne = {
        id: newId(),
        objetId: input.objetId,
        name: input.objetName,
        photoUrl: input.objetPhotoUrl,
        // SANS MONTANT NI GARANTIE, et c'est voulu : on les renseigne ensuite
        // en ouvrant la facture, où l'on voit les autres lignes en face.
        amount: null,
        warrantyUntil: null,
      };
      const lignes = [...input.facture.lignes, ligne];
      const habitationId = input.habitationId ?? null;

      // GARDE-FOU : une facture dont on ne connaît aucune ligne n'est pas
      // affichable d'avance.
      //
      // Le cas n'existe pas côté base — un déclencheur purge les factures sans
      // objet — mais il existe dans le TEMPS : un appareil qui reçoit la mise à
      // jour JavaScript avant que la migration ne soit appliquée interroge
      // encore l'ancienne fonction, qui ne rend pas les lignes. Poser alors la
      // facture dans le cache avec sa seule ligne neuve ferait effacer les
      // autres objets du ticket à la première modification (voir la migration).
      // On préfère le rattachement muet d'avant, qui se rattrape au
      // rechargement.
      const affichable = input.facture.lignes.length > 0;

      return {
        describe: { kind: 'update' as const, name: input.facture.vendor ?? '' },
        ops: [
          insertOp('facture_objets', [
            {
              id: ligne.id,
              facture_id: input.facture.id,
              objet_id: input.objetId,
              amount: null,
              warranty_until: null,
            },
          ]),
        ],
        // ELLE DOIT APPARAÎTRE TOUT DE SUITE sur la fiche de l'objet. La forme
        // est celle que rend `factures_for_objet` : la fiche la relira sans
        // savoir qu'elle n'est pas encore passée par le serveur.
        appends: affichable
          ? [
              {
                key: ['facturesForObjet', input.objetId],
                row: {
                  id: input.facture.id,
                  document_url: input.facture.document_url,
                  document_kind: input.facture.document_kind,
                  vendor: input.facture.vendor,
                  purchase_date: input.facture.purchase_date,
                  facture_amount: input.facture.facture_amount,
                  created_at: input.facture.created_at,
                  // La ligne de CET objet, celle qu'on vient de créer.
                  amount: null,
                  warranty_until: null,
                  lignes,
                } satisfies FactureDObjet,
              },
            ]
          : [],
        sets: [
          ...(affichable ? reporterLaLigne(client, input.facture.id, ligne, habitationId) : []),
          // L'OBJET QUITTE LA LISTE DES ORPHELINS : c'est la moitié du geste
          // quand il part de l'onglet « Sans facture ».
          ...retirerDesOrphelins(client, habitationId, [input.objetId]),
          // ET LA FACTURE QUITTE LES CANDIDATES : la reproposer permettrait de
          // la rattacher deux fois hors ligne, et la seconde liaison serait
          // refusée des heures plus tard par la contrainte d'unicité.
          ...retirerDesCandidates(client, input.objetId, input.facture.id),
        ],
        result: undefined,
      };
    },
  );
}

/**
 * La nouvelle ligne, reportée dans toutes les copies de cette facture déjà en
 * cache — la fiche des autres objets du ticket, et le dossier du logement.
 *
 * Écrit clé par clé plutôt qu'en `patches` : un patch s'applique partout où
 * l'identifiant apparaît, et il faudrait alors lui donner une liste de lignes
 * unique, alors qu'elle diffère d'une vue à l'autre. Le dossier d'un logement
 * ne rend QUE les lignes qui s'y trouvent (voir factures_for_habitation) —
 * d'où le logement écarté ci-dessous, et la liste rallongée à partir de celle
 * que chaque copie porte déjà.
 */
function reporterLaLigne(
  client: ReturnType<typeof useQueryClient>,
  factureId: string,
  ligne: FactureLigne,
  habitationId: string | null,
): { key: QueryKey; data: unknown }[] {
  const sets: { key: QueryKey; data: unknown }[] = [];

  for (const [key, data] of client.getQueriesData({})) {
    if (!Array.isArray(data)) continue;
    const nom = key[0];
    if (nom !== 'facturesForObjet' && nom !== 'facturesForHabitation') continue;
    // Le dossier d'un AUTRE logement ne doit pas voir cette ligne : il ne
    // parle que des objets qui s'y trouvent.
    if (nom === 'facturesForHabitation' && key[1] !== habitationId) continue;

    let touchee = false;
    const suite = data.map((rangee) => {
      if (!rangee || typeof rangee !== 'object') return rangee;
      const facture = rangee as { id?: string; lignes?: FactureLigne[] };
      if (facture.id !== factureId) return rangee;
      const deja = lignesDe(facture);
      // Le même rattachement rejoué (une relecture du cache, un double appui)
      // ne doit pas dédoubler la ligne.
      if (deja.some((autre) => autre.id === ligne.id)) return rangee;
      touchee = true;
      return { ...facture, lignes: [...deja, ligne] };
    });

    if (touchee) sets.push({ key, data: suite });
  }

  return sets;
}

/** La liste des factures rattachables, privée de celle qu'on vient de rattacher. */
function retirerDesCandidates(
  client: ReturnType<typeof useQueryClient>,
  objetId: string,
  factureId: string,
): { key: QueryKey; data: unknown }[] {
  const key = ['facturesARattacher', objetId];
  const liste = client.getQueryData<FactureARattacher[]>(key);
  if (!liste) return [];
  return [{ key, data: liste.filter((facture) => facture.id !== factureId) }];
}

/**
 * Retirer un objet d'une facture, sans toucher aux autres.
 *
 * C'EST LE GESTE DE LA FICHE D'UN OBJET, et il ne doit surtout pas être
 * confondu avec la suppression du document. Un ticket de caisse couvre
 * plusieurs choses : se débarrasser de l'une ne doit pas priver les autres de
 * leur preuve d'achat.
 *
 * ATTENTION : retirer le DERNIER objet supprime la facture, côté base
 * (déclencheur purge_facture_sans_objet). L'écran doit donc proposer la
 * suppression, et le dire, quand il ne reste qu'une ligne.
 */
export function useDetachFactureFromObjet() {
  const client = useQueryClient();

  return useLocalFirstWrite(
    (input: {
      /** La facture telle que la fiche la connaît : elle porte toutes ses lignes. */
      facture: FactureDObjet;
      /** La ligne qui part. Elle porte l'objet, son nom et sa photo — de quoi le remettre dans la liste des orphelins. */
      ligne: FactureLigne;
      /** Ne part pas en base : il dit quelles listes du dossier corriger. */
      habitationId?: string;
    }) => {
      void cancelWarrantyReminder(input.ligne.id);
      const habitationId = input.habitationId ?? null;

      return {
        describe: { kind: 'update' as const, name: input.facture.vendor ?? '' },
        ops: [deleteOp('facture_objets', input.ligne.id)],
        // LA SUPPRESSION NE SE DÉDUIT PAS TOUTE SEULE, contrairement aux
        // autres. La règle générale du cache retire les lignes dont
        // l'IDENTIFIANT DE PREMIER NIVEAU correspond ; or celle-ci vit à
        // l'intérieur du tableau `lignes` d'une facture, et son départ change
        // en plus l'appartenance de l'objet. Rien de tout cela ne se lit dans
        // l'opération.
        sets: [
          ...reporterLeDetachement(client, input.facture.id, input.ligne),
          // L'OBJET REDEVIENT UN ORPHELIN, tout de suite. C'est le miroir exact
          // du rattachement : sans ça, la liste qu'on cherche à vider ne se
          // remplit à nouveau qu'au rechargement — donc jamais, hors ligne.
          ...remettreDansLesOrphelins(client, habitationId, [input.ligne]),
        ],
        result: undefined,
      };
    },
  );
}

/**
 * Le départ d'une ligne, reporté dans toutes les copies de sa facture.
 *
 * ⚠️ SUR LA FICHE DE SON OBJET, C'EST LA FACTURE ENTIÈRE QUI S'EN VA ; partout
 * ailleurs — la fiche des autres objets du ticket, le dossier du logement —
 * seule la ligne disparaît. Le même geste ne se lit pas pareil selon la liste,
 * et c'est ce qui interdit d'écrire ça en `patches`.
 */
function reporterLeDetachement(
  client: ReturnType<typeof useQueryClient>,
  factureId: string,
  ligne: FactureLigne,
): { key: QueryKey; data: unknown }[] {
  const sets: { key: QueryKey; data: unknown }[] = [];

  for (const [key, data] of client.getQueriesData({})) {
    if (!Array.isArray(data)) continue;
    const nom = key[0];
    if (nom !== 'facturesForObjet' && nom !== 'facturesForHabitation') continue;

    const saFiche = nom === 'facturesForObjet' && key[1] === ligne.objetId;
    let touchee = false;
    const suite: unknown[] = [];

    for (const rangee of data) {
      const facture = rangee as { id?: string; lignes?: FactureLigne[] } | null;
      if (!facture || typeof facture !== 'object' || facture.id !== factureId) {
        suite.push(rangee);
        continue;
      }
      if (saFiche) {
        touchee = true;
        continue;
      }
      const avant = lignesDe(facture);
      const restantes = avant.filter((autre) => autre.id !== ligne.id);
      if (restantes.length === avant.length) {
        suite.push(rangee);
        continue;
      }
      touchee = true;
      suite.push({ ...facture, lignes: restantes });
    }

    if (touchee) sets.push({ key, data: suite });
  }

  return sets;
}

/**
 * Les objets qui viennent de perdre leur preuve d'achat, remis dans la liste
 * de ce qui n'en a pas.
 *
 * OÙ ILS SONT POSÉS, C'EST L'INDEX DE RECHERCHE QUI LE SAIT — la ligne d'une
 * facture porte le nom et la photo de l'objet, pas sa pièce. Et cet index sert
 * de GARDE-FOU autant que de source : une facture peut être à cheval sur deux
 * logements, et l'objet d'un autre logement n'a rien à faire dans cette
 * liste-ci. Sans entrée dans l'index, on n'invente rien et le rechargement
 * tranchera.
 */
function remettreDansLesOrphelins(
  client: ReturnType<typeof useQueryClient>,
  habitationId: string | null,
  lignes: FactureLigne[],
): { key: QueryKey; data: unknown }[] {
  if (!habitationId || lignes.length === 0) return [];

  const key = ['objetsSansFacture', habitationId];
  const liste = client.getQueryData<ObjetSansFacture[]>(key);
  if (!liste) return [];

  const ajouts: ObjetSansFacture[] = [];
  for (const ligne of lignes) {
    if (liste.some((objet) => objet.id === ligne.objetId)) continue;
    const place = placeDeLObjet(client, ligne.objetId);
    if (!place || place.habitation_id !== habitationId) continue;
    ajouts.push({
      id: ligne.objetId,
      name: ligne.name,
      photo_url: ligne.photoUrl,
      piece_name: place.piece_name,
      parent_label: place.parent_label,
    });
  }
  if (ajouts.length === 0) return [];

  // PAR PIÈCE, PUIS PAR NOM — le même ordre que la fonction SQL. Ajouté en
  // queue, l'objet atterrirait dans la mauvaise pièce d'une liste qu'on
  // parcourt justement pièce par pièce.
  const suite = [...liste, ...ajouts].sort(
    (a, b) => a.piece_name.localeCompare(b.piece_name) || a.name.localeCompare(b.name),
  );
  return [{ key, data: suite }];
}

/** Un objet tel que `objets_sans_facture` le rend. */
type ObjetSansFacture = {
  id: string;
  name: string;
  photo_url: string | null;
  piece_name: string;
  parent_label: string | null;
};

/** Où un objet est posé, relu de l'index de recherche déjà en cache. */
function placeDeLObjet(
  client: ReturnType<typeof useQueryClient>,
  objetId: string,
): SearchIndexEntry | undefined {
  for (const [, data] of client.getQueriesData({ queryKey: ['searchIndex'] })) {
    if (!Array.isArray(data)) continue;
    const trouve = (data as SearchIndexEntry[]).find((entree) => entree.kind === 'objet' && entree.id === objetId);
    if (trouve) return trouve;
  }
  return undefined;
}
