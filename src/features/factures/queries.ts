import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useSession } from '../auth/SessionProvider';
import { isLocalUri } from '../../lib/images/media';
import { supabase } from '../../lib/supabase/client';
import type { Facture } from '../../types/database';
import { newId } from '../../lib/uuid';
import { deleteOp, deleteWhereOp, insertOp, updateOp, uploadOp, useLocalFirstWrite } from '../../lib/writeQueue';
import { cancelWarrantyReminder, scheduleWarrantyReminder } from '../notifications/warrantyReminders';
import type { ExportRow } from './exportTree';

// LES FACTURES S'ÉCRIVENT COMME LE RESTE : par la file, jamais en direct.
//
// Ajouter une facture est exactement le geste qu'on fait dans un magasin, un
// garage ou une cave — c'est-à-dire souvent sans réseau. Une écriture qui
// exigerait la connexion perdrait le document au moment précis où on vient de
// le photographier.

/** Ce qu'un écran connaît d'une facture, plus les objets qu'elle couvre. */
export type FactureWithObjets = Facture & {
  objets: { id: string; name: string }[];
};

/**
 * Les factures qui prouvent l'achat d'un objet.
 *
 * Un objet peut en avoir plusieurs : l'achat, puis la réparation, puis
 * l'extension de garantie.
 */
export function useFacturesForObjet(objetId: string) {
  return useQuery({
    queryKey: ['facturesForObjet', objetId],
    queryFn: async (): Promise<FactureWithObjets[]> => {
      // `!inner` sur la liaison : sans lui, PostgREST rendrait aussi les
      // factures sans lien avec cet objet, avec un tableau vide à côté.
      const { data, error } = await supabase
        .from('factures')
        .select('*, facture_objets!inner(objet_id), objets:facture_objets(objets(id, name))')
        .eq('facture_objets.objet_id', objetId)
        .order('purchase_date', { ascending: false, nullsFirst: false });
      if (error) throw error;

      return (data ?? []).map((row) => {
        const { facture_objets: _lien, objets, ...facture } = row as typeof row & {
          objets: { objets: { id: string; name: string } | null }[];
        };
        return {
          ...(facture as Facture),
          objets: objets.map((entry) => entry.objets).filter((o): o is { id: string; name: string } => o !== null),
        };
      });
    },
    enabled: Boolean(objetId),
  });
}

/** Le dossier d'un logement : tout ce qui y est prouvé. */
export function useFacturesForHabitation(habitationId: string | undefined) {
  return useQuery({
    queryKey: ['facturesForHabitation', habitationId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('factures_for_habitation', { p_habitation_id: habitationId! });
      if (error) throw error;
      return data ?? [];
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

type NouvelleFacture = {
  /** L'objet depuis lequel on l'ajoute : une facture n'est jamais orpheline. */
  objetId: string;
  /**
   * Le logement où se trouve cet objet, quand l'écran appelant le connaît.
   *
   * IL NE SERT QU'AU CACHE, jamais à l'écriture — une facture n'appartient à
   * aucun logement, elle en hérite par ses objets (voir la migration). Mais
   * les DEUX listes du dossier changent au moment où on en ajoute une : la
   * facture entre dans l'une, l'objet sort de l'autre. Hors ligne, rien ne se
   * rechargera pour le dire.
   */
  habitationId?: string;
  /** Chemin local du document choisi, ou adresse déjà connue. */
  document: string;
  amount: number | null;
  purchaseDate: string | null;
  warrantyUntil: string | null;
  vendor: string | null;
};

export function useCreateFacture() {
  const { session } = useSession();
  const client = useQueryClient();
  const { t, i18n } = useTranslation();

  return useLocalFirstWrite((input: NouvelleFacture) => {
    const id = newId();
    const userId = session!.user.id;
    const local = isLocalUri(input.document);

    // LE RAPPEL DE GARANTIE SE POSE ICI, PAS DEPUIS L'ÉCRAN. Une facture
    // s'ajoute depuis la fiche d'un objet comme depuis le dossier d'un
    // logement : le poser dans chaque écran, c'est l'oublier dans le
    // prochain. Programmé sur l'appareil, il ne dépend ni du réseau ni du
    // serveur — voir warrantyReminders.
    void scheduleWarrantyReminder(
      {
        id,
        objets: [nomObjetEnCache(client, input.objetId)].filter(Boolean),
        warrantyUntil: input.warrantyUntil,
        habitationId: input.habitationId ?? null,
      },
      t,
      i18n.language,
    );

    const facture: Facture = {
      id,
      user_id: userId,
      // NUL TANT QUE LE FICHIER N'EST PAS PARTI, et c'est voulu : c'est
      // l'opération d'envoi qui écrira l'adresse. Y poser le chemin local
      // laisserait un `file://` en base si le lot échouait — une adresse
      // qu'aucun autre appareil ne saurait ouvrir. Même règle que les photos.
      document_url: local ? null : input.document,
      document_kind: 'image',
      amount: input.amount,
      purchase_date: input.purchaseDate,
      warranty_until: input.warrantyUntil,
      vendor: input.vendor,
      created_at: new Date().toISOString(),
    };

    return {
      describe: { kind: 'create' as const, name: input.vendor ?? '' },
      ops: [
        insertOp('factures', [facture]),
        // LES DEUX INSERTIONS DANS LE MÊME LOT, dans cet ordre. La liaison
        // référence la facture : séparées, la seconde pourrait partir avant
        // que la première ne soit acceptée — c'est exactement la course qui
        // faisait refuser un déplacement au retour du réseau.
        insertOp('facture_objets', [{ facture_id: id, objet_id: input.objetId }]),
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
      // ELLE DOIT APPARAITRE DANS LA LISTE DE L'OBJET TOUT DE SUITE.
      //
      // Sans cet ajout, la facture n'existe que cote serveur : hors ligne la
      // liste ne se recharge jamais, et on vient de photographier un document
      // qui n'apparait nulle part. C'est le defaut corrige la semaine derniere
      // sur les objets, dans sa version facture.
      //
      // Le document montre est le fichier LOCAL, deja sur l'appareil : il n'y
      // a aucune raison d'attendre l'envoi pour l'afficher.
      appends: [
        {
          key: ['facturesForObjet', input.objetId],
          row: { ...facture, document_url: input.document, objets: [] },
        },
        // ET DANS LE DOSSIER DU LOGEMENT, quand l'écran a dit lequel. La forme
        // est celle que rend `factures_for_habitation` : un objet couvert, le
        // nom de celui-là. L'écran retrie la liste lui-même, sinon la nouvelle
        // venue s'ajouterait en queue au lieu de sa place chronologique.
        ...(input.habitationId
          ? [
              {
                key: ['facturesForHabitation', input.habitationId],
                row: {
                  ...facture,
                  document_url: input.document,
                  objet_count: 1,
                  objet_names: [nomObjetEnCache(client, input.objetId)].filter(Boolean),
                },
              },
            ]
          : []),
      ],
      // L'OBJET QUITTE LA LISTE DES ORPHELINS, tout de suite. C'est la moitié
      // du geste : on vient de rayer une ligne d'une liste qu'on cherche à
      // vider, et la voir rester donnerait le sentiment que rien n'a marché.
      sets: retirerDesOrphelins(client, input.habitationId, input.objetId),
      result: facture,
    };
  });
}

/**
 * Le nom d'un objet tel que le cache le connaît déjà.
 *
 * Il sert à nommer l'objet couvert dans la carte du dossier. Pris dans le
 * cache et non demandé au réseau : ce geste doit marcher hors ligne, et
 * l'écran qui l'a déclenché affichait le nom une seconde plus tôt.
 */
function nomObjetEnCache(client: ReturnType<typeof useQueryClient>, objetId: string): string {
  const fiche = client.getQueryData<{ name?: string }>(['objet', objetId]);
  if (fiche?.name) return fiche.name;

  // Rien en cache si la facture est ajoutée depuis le dossier sans être
  // jamais passé par la fiche : la liste des orphelins, elle, porte le nom.
  const orphelins = client.getQueriesData<{ id: string; name: string }[]>({ queryKey: ['objetsSansFacture'] });
  for (const [, liste] of orphelins) {
    const trouve = liste?.find((objet) => objet.id === objetId);
    if (trouve) return trouve.name;
  }
  return '';
}

/** La liste des objets sans facture, privée de celui qui vient d'en recevoir une. */
function retirerDesOrphelins(
  client: ReturnType<typeof useQueryClient>,
  habitationId: string | undefined,
  objetId: string,
): { key: string[]; data: unknown }[] {
  if (!habitationId) return [];
  const key = ['objetsSansFacture', habitationId];
  const liste = client.getQueryData<{ id: string }[]>(key);
  if (!liste) return [];
  return [{ key, data: liste.filter((objet) => objet.id !== objetId) }];
}

export function useUpdateFacture() {
  const { session } = useSession();
  const { t, i18n } = useTranslation();

  return useLocalFirstWrite(
    (input: {
      id: string;
      vendor: string | null;
      amount: number | null;
      purchaseDate: string | null;
      warrantyUntil: string | null;
      /**
       * Le document tel que la feuille le rend : l'adresse déjà connue si on
       * n'y a pas touché, un chemin local si on vient de le rephotographier.
       */
      document?: string;
      /**
       * Les deux seuls champs qui ne partent PAS en base : de quoi réécrire le
       * rappel de garantie, qui doit nommer l'objet et savoir où renvoyer.
       *
       * Corriger une date de fin de garantie doit déplacer le rappel tout de
       * suite — et l'effacer doit le retirer. Sans ça, le téléphone
       * continuerait d'annoncer une échéance que la facture ne porte plus.
       */
      objets?: string[];
      habitationId?: string;
    }) => {
      const userId = session!.user.id;

      void scheduleWarrantyReminder(
        {
          id: input.id,
          objets: input.objets ?? [],
          warrantyUntil: input.warrantyUntil,
          habitationId: input.habitationId ?? null,
        },
        t,
        i18n.language,
      );
      // REMPLACER LE DOCUMENT, ET PAS SEULEMENT LES QUATRE CHAMPS. La feuille
      // montre « Photographier » et « Choisir une image » en modification
      // aussi : sans cette branche, on reprenait en photo une facture floue,
      // on enregistrait, et rien ne changeait — en silence.
      //
      // C'est `isLocalUri` qui tranche, pas un drapeau posé par l'écran : une
      // adresse http est celle qui était déjà là, il n'y a rien à envoyer.
      const remplace = input.document != null && isLocalUri(input.document);

      const champs = {
        vendor: input.vendor,
        amount: input.amount,
        purchase_date: input.purchaseDate,
        warranty_until: input.warrantyUntil,
      };

      return {
        describe: { kind: 'update' as const, name: input.vendor ?? '' },
        ops: [
          updateOp('factures', input.id, champs),
          ...(remplace
            ? [
                uploadOp({
                  uri: input.document!,
                  bucket: 'factures',
                  // LE MÊME CHEMIN QU'À LA CRÉATION, donc l'ancien fichier est
                  // écrasé (`upsert`). L'adresse rendue porte un horodatage,
                  // qui sert de clé de cache : sans lui, expo-image
                  // continuerait d'afficher l'ancienne image.
                  path: `${userId}/${input.id}.jpg`,
                  then: { table: 'factures', id: input.id, column: 'document_url' },
                }),
              ]
            : []),
        ],
        // Le fichier local s'affiche tout de suite : il est déjà sur
        // l'appareil, il n'y a aucune raison d'attendre l'envoi.
        patches: [{ id: input.id, patch: remplace ? { ...champs, document_url: input.document } : champs }],
        result: undefined,
      };
    },
  );
}

export function useDeleteFacture() {
  return useLocalFirstWrite((input: { id: string; vendor: string | null }) => {
    // Le rappel de garantie part avec elle, et depuis la mutation plutôt que
    // depuis un écran : on supprime une facture aussi bien depuis la fiche
    // d'un objet que depuis le dossier.
    void cancelWarrantyReminder(input.id);

    return {
      describe: { kind: 'delete' as const, name: input.vendor ?? '' },
      // La liaison part en cascade côté base (`on delete cascade`) : rien à
      // supprimer ici. Le fichier du bucket, lui, reste — comme les photos
      // d'objets supprimés. Le ménage se fait à la suppression du compte.
      ops: [deleteOp('factures', input.id)],
      result: undefined,
    };
  });
}

/** Rattacher la même facture à un autre objet qu'elle couvre. */
export function useAttachFactureToObjet() {
  return useLocalFirstWrite((input: { factureId: string; objetId: string; vendor: string | null }) => ({
    describe: { kind: 'update' as const, name: input.vendor ?? '' },
    ops: [insertOp('facture_objets', [{ facture_id: input.factureId, objet_id: input.objetId }])],
    result: undefined,
  }));
}

/** Détacher un objet d'une facture, sans supprimer la facture. */
export function useDetachFactureFromObjet() {
  return useLocalFirstWrite((input: { factureId: string; objetId: string; vendor: string | null }) => ({
    describe: { kind: 'update' as const, name: input.vendor ?? '' },
    // `deleteWhereOp` et non `deleteOp` : la clé de cette table est composite,
    // il n'y a pas d'`id` à viser.
    ops: [deleteWhereOp('facture_objets', { facture_id: input.factureId, objet_id: input.objetId })],
    result: undefined,
  }));
}
