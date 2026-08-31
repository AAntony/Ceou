import type { QueryClient, QueryKey } from '@tanstack/react-query';
import type { WriteOp } from './writeQueue';

// CE QUE L'ÉCRAN MONTRE AVANT QUE LE SERVEUR NE L'AIT VU.
//
// Sans réseau, une écriture part en file et n'aboutira que plus tard. Si le
// cache n'est pas touché entre-temps, l'écran continue d'afficher l'ancienne
// valeur : on renomme un objet, rien ne bouge, on recommence. Il faut donc
// appliquer la modification au cache tout de suite.
//
// LA MÊME PHILOSOPHIE QUE L'INVALIDATION GLOBALE de queryClient, et pour la
// même raison. L'app compte 46 requêtes ; tenir à la main la liste de celles
// qu'une écriture donnée touche, c'est la garantie d'en oublier une — et une
// case oubliée est un écran qui ment. On balaie donc TOUT le cache et on
// applique la modification partout où la ligne concernée apparaît, quelle que
// soit la requête qui la contient.
//
// C'est volontairement grossier, et c'est tenable : le balayage porte sur des
// dizaines d'entrées en mémoire, pas sur le réseau, et il ne se produit qu'au
// moment d'une écriture.

/**
 * Une création n'est PAS déductible du cache : rien ne dit dans quelle liste
 * la nouvelle ligne doit apparaître. Le hook, lui, le sait — c'est la même clé
 * qu'il invalide déjà après coup.
 */
export type AppendTarget = { key: QueryKey; row: Record<string, unknown> };

type Row = Record<string, unknown>;

function isRow(value: unknown): value is Row {
  return typeof value === 'object' && value !== null && 'id' in value;
}

/** Applique une transformation à toute ligne portant cet identifiant, où qu'elle soit. */
function mapCachedRows(client: QueryClient, id: string, transform: (row: Row) => Row | null): void {
  client.setQueriesData({}, (data: unknown) => {
    if (Array.isArray(data)) {
      let touched = false;
      const next: unknown[] = [];
      for (const item of data) {
        if (isRow(item) && item.id === id) {
          touched = true;
          const replacement = transform(item);
          if (replacement !== null) next.push(replacement);
        } else {
          next.push(item);
        }
      }
      // On rend l'objet D'ORIGINE quand rien n'a changé : rendre une nouvelle
      // liste identique ferait tout de même re-rendre chaque écran qui la lit.
      return touched ? next : data;
    }

    // Une fiche seule (`['objet', id]`) et non une liste.
    if (isRow(data) && data.id === id) return transform(data);

    return data;
  });
}

/**
 * Reporte immédiatement dans le cache ce que la file d'écriture fera plus tard.
 *
 * Les créations passent par `appends` ; les modifications et suppressions sont
 * déduites des opérations elles-mêmes, puisqu'elles portent un identifiant.
 *
 * `deleteWhere` n'est PAS traité : ces suppressions visent des tables
 * d'existence (favoris) dont les lignes n'ont pas d'identifiant connu ici. Les
 * hooks concernés font leur propre mise à jour optimiste.
 */
export function applyOpsToCache(
  client: QueryClient,
  ops: WriteOp[],
  appends: AppendTarget[] = [],
  patches: { id: string; patch: Row }[] = [],
): void {
  for (const op of ops) {
    if (op.kind === 'update') {
      mapCachedRows(client, op.id, (row) => ({ ...row, ...op.patch }));
    } else if (op.kind === 'delete') {
      mapCachedRows(client, op.id, () => null);
    }
  }

  // Ce que les opérations ne disent pas d'elles-mêmes : un `rpc` ne déclare
  // aucune ligne, c'est l'appelant qui sait ce qu'il change.
  for (const { id, patch } of patches) {
    mapCachedRows(client, id, (row) => ({ ...row, ...patch }));
  }

  for (const { key, row } of appends) {
    client.setQueryData(key, (data: unknown) => (Array.isArray(data) ? [...data, row] : data));
  }
}
