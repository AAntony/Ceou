import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useSession } from '../auth/SessionProvider';
import { isLocalUri } from '../../lib/images/media';
import { supabase } from '../../lib/supabase/client';
import type { Facture } from '../../types/database';
import { newId } from '../../lib/uuid';
import { deleteOp, insertOp, updateOp, uploadOp, useLocalFirstWrite, type WriteOp } from '../../lib/writeQueue';
import { cancelWarrantyReminder, scheduleWarrantyReminder } from '../notifications/warrantyReminders';
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
      document_kind: 'image',
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
                path: `${userId}/${id}.jpg`,
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
  return [{ key, data: liste.filter((objet) => !objetIds.includes(objet.id)) }];
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
                path: `${userId}/${input.id}.jpg`,
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
  return useLocalFirstWrite((input: { id: string; vendor: string | null; ligneIds: string[] }) => {
    // Les rappels de garantie partent avec elle — un par ligne — et depuis la
    // mutation plutôt que depuis un écran : on supprime une facture aussi bien
    // depuis la fiche d'un objet que depuis le dossier.
    for (const ligneId of input.ligneIds) void cancelWarrantyReminder(ligneId);

    return {
      describe: { kind: 'delete' as const, name: input.vendor ?? '' },
      // Les liaisons partent en cascade côté base (`on delete cascade`) : rien
      // à supprimer ici. Le fichier du bucket, lui, reste — comme les photos
      // d'objets supprimés. Le ménage se fait à la suppression du compte.
      ops: [deleteOp('factures', input.id)],
      result: undefined,
    };
  });
}
