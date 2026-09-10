import { useQuery } from '@tanstack/react-query';
import { useSession } from '../auth/SessionProvider';
import { isLocalUri } from '../../lib/images/media';
import { supabase } from '../../lib/supabase/client';
import type { Facture } from '../../types/database';
import { newId } from '../../lib/uuid';
import { deleteOp, deleteWhereOp, insertOp, updateOp, uploadOp, useLocalFirstWrite } from '../../lib/writeQueue';

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

type NouvelleFacture = {
  /** L'objet depuis lequel on l'ajoute : une facture n'est jamais orpheline. */
  objetId: string;
  /** Chemin local du document choisi, ou adresse déjà connue. */
  document: string;
  amount: number | null;
  purchaseDate: string | null;
  warrantyUntil: string | null;
  vendor: string | null;
};

export function useCreateFacture() {
  const { session } = useSession();

  return useLocalFirstWrite((input: NouvelleFacture) => {
    const id = newId();
    const userId = session!.user.id;
    const local = isLocalUri(input.document);

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
      ],
      result: facture,
    };
  });
}

export function useUpdateFacture() {
  return useLocalFirstWrite(
    (input: {
      id: string;
      vendor: string | null;
      amount: number | null;
      purchaseDate: string | null;
      warrantyUntil: string | null;
    }) => ({
      describe: { kind: 'update' as const, name: input.vendor ?? '' },
      ops: [
        updateOp('factures', input.id, {
          vendor: input.vendor,
          amount: input.amount,
          purchase_date: input.purchaseDate,
          warranty_until: input.warrantyUntil,
        }),
      ],
      patches: [
        {
          id: input.id,
          patch: {
            vendor: input.vendor,
            amount: input.amount,
            purchase_date: input.purchaseDate,
            warranty_until: input.warrantyUntil,
          },
        },
      ],
      result: undefined,
    }),
  );
}

export function useDeleteFacture() {
  return useLocalFirstWrite((input: { id: string; vendor: string | null }) => ({
    describe: { kind: 'delete' as const, name: input.vendor ?? '' },
    // La liaison part en cascade côté base (`on delete cascade`) : rien à
    // supprimer ici. Le fichier du bucket, lui, reste — comme les photos
    // d'objets supprimés. Le ménage se fait à la suppression du compte.
    ops: [deleteOp('factures', input.id)],
    result: undefined,
  }));
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
