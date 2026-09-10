import { useMutation, useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query';
import type { PostgrestError } from '@supabase/supabase-js';
import { uploadImage } from './images/pickAndUploadImage';
import { supabase } from './supabase/client';
import type { Database } from '../types/supabase';
import { applyOpsToCache, type AppendTarget } from './optimisticCache';
import type { WriteDescription } from './syncFailures';

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
  | { kind: 'deleteWhere'; table: WriteTable; match: Record<string, string> }
  // Déplacer un objet n'est pas une écriture de table mais une fonction SQL :
  // elle met à jour le parent ET journalise le déplacement, en une
  // transaction. La refaire en deux opérations côté client perdrait cette
  // garantie — et c'est exactement l'action qu'on fait le plus souvent sans
  // réseau, une caisse à la main devant une étagère.
  | { kind: 'rpc'; fn: keyof Database['public']['Functions']; args: Record<string, unknown> }
  // TÉLÉVERSER UNE PHOTO, PUIS ÉCRIRE SON ADRESSE. Une photo n'est pas une
  // ligne de base : c'est un fichier à envoyer au stockage, dont on ne connaît
  // l'adresse définitive qu'après l'envoi. Les deux temps tiennent donc dans
  // UNE opération, sans quoi le rejeu pourrait écrire l'adresse d'un fichier
  // jamais arrivé.
  //
  // Ce qui voyage sur le disque, c'est le CHEMIN LOCAL du fichier choisi. Il
  // vit dans le cache de l'application : il survit très bien à un redémarrage,
  // mais Android peut le supprimer sous pression de stockage. Une copie
  // durable demanderait `expo-file-system`, donc un module natif, donc un
  // nouvel APK pour tout le monde — PAS FAIT, et signalé.
  | {
      kind: 'upload';
      uri: string;
      bucket: string;
      path: string;
      then: { table: WriteTable; id: string; column: string };
    };

export type WriteBatch = {
  ops: WriteOp[];
  /**
   * DE QUOI EN PARLER À LA PERSONNE SI ÇA ÉCHOUE — et c'est pour cela que ce
   * champ est OBLIGATOIRE. Une opération générique ne se raconte pas :
   * « update objets » ne dit rien à personne. Seul le hook qui construit le
   * lot sait qu'il s'agit du déplacement de « Agathe ».
   *
   * Elle voyage sur le disque avec le reste du lot : l'échec peut survenir des
   * heures plus tard, après un redémarrage, alors que plus rien du contexte
   * d'origine n'existe en mémoire.
   */
  describe: WriteDescription;
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
  upsert: (rows: unknown) => PromiseLike<{ error: PostgrestError | null }>;
  update: (patch: unknown) => Filterable;
  delete: () => Filterable;
};

async function runBatch({ ops }: WriteBatch): Promise<void> {
  // DANS L'ORDRE, ET EN S'ARRÊTANT AU PREMIER ÉCHEC. Les opérations d'un même
  // lot se référencent (l'Habitation puis sa Pièce) : poursuivre après un
  // échec écrirait un enfant orphelin. L'erreur remonte, la mutation est
  // marquée en échec, et le lot entier sera à rejouer.
  for (const op of ops) {
    if (op.kind === 'rpc') {
      const { error } = await supabase.rpc(op.fn, op.args as never);
      if (error) throw error;
      continue;
    }

    if (op.kind === 'upload') {
      const url = await uploadImage(op.uri, { bucket: op.bucket, path: op.path });
      const target = supabase.from(op.then.table) as unknown as UntypedTable;
      const { error } = await target.update({ [op.then.column]: url }).eq('id', op.then.id);
      if (error) throw error;
      continue;
    }

    const table = supabase.from(op.table) as unknown as UntypedTable;

    if (op.kind === 'insert') {
      // UPSERT ET NON INSERT, POUR QUE REJOUER UN LOT SOIT SANS DANGER.
      //
      // Un lot n'est PAS une transaction : ses opérations partent une par
      // une, et rien ne défait les premières si la dernière échoue. Une
      // création accompagnée d'une photo, par exemple, insère la ligne puis
      // envoie le fichier — si l'envoi échoue, la ligne est déjà là. Le
      // « Réessayer » de la liste des échecs rejouerait alors l'insertion
      // sur une clé qui existe, et la seconde tentative échouerait pour une
      // raison n'ayant plus rien à voir avec la première.
      //
      // L'identifiant vient de `newId` (un UUID tiré localement) : écraser
      // une ligne portant ce même identifiant, c'est écraser LA NÔTRE, avec
      // un contenu identique. Il n'y a personne d'autre à écraser.
      const { error } = await table.upsert(op.rows);
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
  client.setMutationDefaults(WRITE_MUTATION_KEY, {
    mutationFn: runBatch,
    // ═══ UNE FILE, DONC UNE À LA FOIS ═══
    //
    // `resumePausedMutations` reprend TOUT en même temps — un `Promise.all`
    // sur les mutations en pause (query-core/mutationCache). Sans portée
    // commune, les écritures mises de côté hors ligne repartent donc
    // ensemble, dans le désordre.
    //
    // LE DÉFAUT QUE ÇA CORRIGE, signalé à l'usage : créer un objet hors
    // ligne puis le déplacer, et au retour du réseau « le serveur a refusé
    // ta modification ». Le déplacement atteignait le serveur avant que
    // l'insertion n'ait été validée, et `move_objet` levait « objet not
    // found » — sur un objet qui existait pourtant, une seconde plus tard.
    //
    // Une portée partagée fait exécuter en SÉRIE toutes les mutations qui la
    // portent, dans leur ordre d'arrivée. C'est le sens même d'une file :
    // les gestes se rejouent comme ils ont été faits, parce qu'ils dépendent
    // les uns des autres.
    //
    // Déclarée ICI et non dans `useWrite` : c'est cet enregistrement, et lui
    // seul, que retrouve une mutation relue du disque après un redémarrage —
    // or ce sont exactement celles-là qui se bousculent au retour du réseau.
    scope: { id: 'ceou-write-queue' },
  });
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

export function uploadOp(input: {
  uri: string;
  bucket: string;
  path: string;
  then: { table: WriteTable; id: string; column: string };
}): WriteOp {
  return { kind: 'upload', ...input };
}

export function rpcOp(fn: keyof Database['public']['Functions'], args: Record<string, unknown>): WriteOp {
  return { kind: 'rpc', fn, args };
}

export function deleteWhereOp<T extends WriteTable>(table: T, match: Record<string, string>): WriteOp {
  return { kind: 'deleteWhere', table, match };
}

// L'ÉCRITURE VUE PAR UN ÉCRAN : locale d'abord, réseau ensuite.
//
// LE PIÈGE QUE CE HOOK ÉVITE. Hors-ligne, la mutation de la file est mise en
// PAUSE — sa promesse ne se résout donc jamais tant que le réseau n'est pas
// revenu. Or les écrans font `await createObjet.mutateAsync(...)` puis
// naviguent vers l'objet créé. Branchés directement sur la file, ils
// resteraient bloqués indéfiniment sur un bouton qui tourne : le hors-ligne
// aurait remplacé un échec franc par une attente sans fin, ce qui est pire.
//
// D'où deux mutations superposées, et c'est le point à comprendre avant de
// toucher à ce fichier :
//
//   - CELLE-CI se résout TOUT DE SUITE. Elle construit la ligne localement
//     (l'identifiant est déjà connu, voir lib/uuid), l'applique au cache, et
//     rend le résultat. L'écran continue son chemin comme si c'était fait.
//   - CELLE DE LA FILE est lancée sans être attendue. C'est elle qui porte
//     l'attente, la persistance et le rejeu.
//
// `skipGlobalRefresh` sur celle-ci, et c'est indispensable : la règle globale
// de queryClient rafraîchit tout à la fin de CHAQUE mutation. Appliquée ici,
// elle rechargerait depuis le serveur dans la seconde qui suit — effaçant
// l'affichage optimiste par des données qui ne portent pas encore la
// modification. Le rafraîchissement doit venir de la mutation de la FILE,
// c'est-à-dire quand l'écriture a réellement abouti.
export type LocalFirstWrite<TResult> = {
  ops: WriteOp[];
  describe: WriteDescription;
  appends?: AppendTarget[];
  /**
   * Modifications a reporter dans le cache que les operations ne permettent
   * PAS de deduire — le cas d'un ` + '`rpc`' + `, qui ne dit pas quelles lignes il
   * touche. Un deplacement d'objet passe par la.
   */
  patches?: { id: string; patch: Record<string, unknown> }[];
  /**
   * Ecrasement d une cle entiere, pour ce qu aucune regle generale ne sait
   * deduire : un fil d Ariane recalcule, une liste dont un element a change
   * de parent. L appelant lit le cache et pose la valeur juste.
   */
  sets?: { key: QueryKey; data: unknown }[];
  result: TResult;
};

export function useLocalFirstWrite<TInput, TResult>(build: (input: TInput) => LocalFirstWrite<TResult>) {
  const write = useWrite();
  const client = useQueryClient();

  return useMutation<TResult, Error, TInput>({
    // ═══ `always` EST CE QUI FAIT MARCHER TOUTE L'ÉCRITURE HORS-LIGNE ═══
    //
    // Sans lui, cette mutation-ci prend le mode par défaut, `online` — et se
    // met donc en PAUSE elle aussi quand il n'y a pas de réseau. Son
    // `mutationFn` ne s'exécute jamais : ni l'affichage optimiste, ni la mise
    // en file, et `mutateAsync` ne résout pas. Les écrans qui l'attendent
    // restent bloqués indéfiniment.
    //
    // C'est le défaut signalé à l'usage sur « Choisir cet emplacement » : la
    // modale ne se fermait pas, l'objet ne bougeait pas. Il touchait en
    // réalité TOUTE écriture hors-ligne — créer, renommer, déplacer,
    // supprimer — la file d'attente n'était jamais atteinte.
    //
    // `always` est ici le mode JUSTE, pas un contournement : cette mutation ne
    // touche pas le réseau. Elle construit une ligne, l'écrit dans le cache et
    // passe le relais. C'est la mutation de la FILE qui parle au serveur, et
    // elle garde `online` — c'est elle qui doit attendre.
    networkMode: 'always',
    meta: { skipGlobalRefresh: true },
    mutationFn: async (input) => {
      const { ops, appends, patches, sets, describe, result } = build(input);
      applyOpsToCache(client, ops, appends, patches, sets);
      // VOLONTAIREMENT PAS ATTENDU. Voir le commentaire ci-dessus : hors-ligne
      // cette promesse ne se résoudrait jamais.
      write.mutate({ ops, describe });
      return result;
    },
  });
}
