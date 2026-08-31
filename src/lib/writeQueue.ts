import { useMutation, type QueryClient } from '@tanstack/react-query';
import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from './supabase/client';
import type { Database } from '../types/supabase';

/**
 * Les tables réellement existantes, et pas `string`.
 *
 * C'est le seul typage que cette file puisse offrir, mais c'est celui qui
 * compte : une faute de frappe sur un nom de table ne se verrait qu'au moment
 * du rejeu, c'est-à-dire potentiellement des heures plus tard, sur une
 * modification qu'on croyait envoyée.
 */
export type WriteTable = keyof Database['public']['Tables'];

// LA FILE D'ÉCRITURE HORS-LIGNE.
//
// Une modification faite sans réseau ne doit ni échouer ni disparaître : elle
// attend, survit à la fermeture de l'application, et part dès que la connexion
// revient. TanStack Query sait déjà faire tout cela — une mutation lancée
// hors-ligne est mise EN PAUSE plutôt qu'exécutée, et reprise au retour du
// réseau. Il ne manquait que deux choses : qu'elle survive au redémarrage, et
// qu'elle soit rejouable une fois relue du disque.
//
// UNE SEULE MUTATION GÉNÉRIQUE, ET C'EST LE CHOIX STRUCTURANT DE CE FICHIER.
//
// Pour rejouer une mutation relue du disque, TanStack doit retrouver la
// FONCTION qui l'exécute — or une fonction ne se sérialise pas. Elle est donc
// retrouvée par sa clé, via `setMutationDefaults`. La voie évidente était
// d'enregistrer les vingt mutations d'inventaire une par une ; celle retenue
// n'en enregistre qu'UNE, qui prend en argument une LISTE D'OPÉRATIONS
// décrivant ce qu'il faut écrire.
//
// Ce que ça achète :
//   - un seul point d'enregistrement, donc aucune mutation qui puisse être
//     oubliée et se perdre silencieusement au redémarrage ;
//   - des variables sérialisables PAR CONSTRUCTION. C'était le vrai piège :
//     plusieurs `mutationFn` capturaient dans leur fermeture la session ou
//     l'identifiant du parent (`useCreatePiece(habitationId)`). Une fermeture
//     ne survit pas au disque — au réveil, la mutation aurait écrit avec des
//     valeurs manquantes ;
//   - les créations en cascade dans une seule et même mutation : créer une
//     Habitation « studio » pose aussi sa Pièce par défaut, et les deux
//     partent ou échouent ensemble.
//
// Ce que ça coûte : on perd le typage fin par table. Le compromis est
// acceptable parce que ces opérations ne sont JAMAIS écrites à la main dans un
// écran — elles sont construites par les hooks de features/inventory, qui
// gardent, eux, leurs signatures typées.

/** Une écriture élémentaire. Tout doit être sérialisable en JSON. */
export type WriteOp =
  | { kind: 'insert'; table: WriteTable; rows: Record<string, unknown>[] }
  | { kind: 'update'; table: WriteTable; id: string; patch: Record<string, unknown> }
  | { kind: 'delete'; table: WriteTable; id: string }
  // Suppression par correspondance et non par identifiant : les tables
  // d'existence (favoris, membres d'une catégorie) n'ont pas d'id qu'on
  // connaisse au moment de retirer la ligne.
  | { kind: 'deleteWhere'; table: WriteTable; match: Record<string, string> };

export type WriteBatch = {
  ops: WriteOp[];
};

/**
 * LA CLÉ SOUS LAQUELLE LA FONCTION EST RETROUVÉE APRÈS UN REDÉMARRAGE.
 *
 * Elle est écrite dans le cache persisté à côté des variables. La changer
 * rendrait irrejouables les mutations déjà en attente sur les téléphones —
 * elles seraient relues, ne trouveraient aucune fonction, et resteraient en
 * attente pour toujours. À ne pas toucher sans vider le cache (voir le jeton
 * de version dans queryClient).
 */
export const WRITE_MUTATION_KEY = ['ceou', 'write'] as const;

/**
 * LA FORME MINIMALE DU CONSTRUCTEUR DE REQUÊTES, décrite à la main.
 *
 * Les types générés par Supabase associent à chaque table la forme exacte de
 * ses lignes et de ses colonnes. C'est précieux partout ailleurs, et
 * inapplicable ici : la table n'est connue qu'à l'exécution, donc le
 * constructeur s'effondre sur `never` et même `.eq('id', …)` est refusé.
 *
 * Plutôt qu'un `any` qui n'apprendrait rien à personne, on décrit les quatre
 * appels que cette file utilise réellement. Le typage perdu est celui des
 * COLONNES ; celui du nom de table, lui, est conservé (voir WriteTable).
 */
type Filterable = PromiseLike<{ error: PostgrestError | null }> & {
  eq: (column: string, value: string) => Filterable;
};
type UntypedTable = {
  insert: (rows: unknown) => PromiseLike<{ error: PostgrestError | null }>;
  update: (patch: unknown) => Filterable;
  delete: () => Filterable;
};

async function runBatch({ ops }: WriteBatch): Promise<void> {
  // DANS L'ORDRE, ET EN S'ARRÊTANT AU PREMIER ÉCHEC. Les opérations d'un même
  // lot se référencent (l'Habitation puis sa Pièce) : poursuivre après un
  // échec écrirait un enfant orphelin. L'erreur remonte, la mutation est
  // marquée en échec, et le lot entier sera à rejouer.
  for (const op of ops) {
    const table = supabase.from(op.table) as unknown as UntypedTable;

    if (op.kind === 'insert') {
      const { error } = await table.insert(op.rows);
      if (error) throw error;
    } else if (op.kind === 'update') {
      const { error } = await table.update(op.patch).eq('id', op.id);
      if (error) throw error;
    } else if (op.kind === 'delete') {
      const { error } = await table.delete().eq('id', op.id);
      if (error) throw error;
    } else {
      let query = table.delete();
      for (const [column, value] of Object.entries(op.match)) query = query.eq(column, value);
      const { error } = await query;
      if (error) throw error;
    }
  }
}

/**
 * À appeler UNE FOIS au démarrage, avant tout rendu.
 *
 * Sans cet enregistrement, une mutation relue du disque n'a aucune fonction à
 * exécuter : `resumePausedMutations` la reprendrait et ne saurait qu'en faire.
 */
export function registerWriteMutation(client: QueryClient): void {
  client.setMutationDefaults(WRITE_MUTATION_KEY, { mutationFn: runBatch });
}

/**
 * Le point d'entrée des hooks d'écriture.
 *
 * Pas de `mutationFn` ici : elle vient des défauts posés ci-dessus, et c'est
 * précisément ce qui rend la mutation rejouable après un redémarrage. Lui en
 * passer une la rendrait fonctionnelle en ligne et muette au réveil — le genre
 * de panne qui ne se voit qu'une fois les données perdues.
 */
export function useWrite() {
  return useMutation<void, Error, WriteBatch>({ mutationKey: WRITE_MUTATION_KEY });
}

// LES CONSTRUCTEURS TYPÉS, et ils rattrapent exactement ce que la file
// générique fait perdre.
//
// Une opération est un sac de clés/valeurs : rien n'y empêche d'écrire
// `preset_ky` au lieu de `preset_key`. La faute ne se verrait qu'au REJEU,
// c'est-à-dire potentiellement des heures plus tard, sur une modification
// qu'on croyait envoyée — le pire moment pour l'apprendre.
//
// Les types générés par Supabase sont réintroduits ici, au moment de la
// CONSTRUCTION, là où le nom de la table est une constante littérale et où le
// compilateur peut donc en déduire la forme des lignes. La file, elle, reste
// générique : c'est ce qui lui permet de n'avoir qu'un seul point
// d'enregistrement.
//
// Passer par ces fonctions plutôt que d'écrire l'objet à la main n'est donc
// pas une coquetterie de style : c'est la seule vérification qui existe.
type Tables = Database['public']['Tables'];

export function insertOp<T extends WriteTable>(table: T, rows: Tables[T]['Insert'][]): WriteOp {
  return { kind: 'insert', table, rows: rows as Record<string, unknown>[] };
}

export function updateOp<T extends WriteTable>(table: T, id: string, patch: Tables[T]['Update']): WriteOp {
  return { kind: 'update', table, id, patch: patch as Record<string, unknown> };
}

export function deleteOp<T extends WriteTable>(table: T, id: string): WriteOp {
  return { kind: 'delete', table, id };
}

export function deleteWhereOp<T extends WriteTable>(table: T, match: Record<string, string>): WriteOp {
  return { kind: 'deleteWhere', table, match };
}
