import type { QueryClient } from '@tanstack/react-query';
import type { WriteOp } from './writeQueue';

// CE QUI N'A PAS PU ÊTRE ENVOYÉ, ET QUI DOIT SE VOIR.
//
// LE TROU QUE CE FICHIER BOUCHE. Une modification faite hors-ligne part en
// file, s'affiche à l'écran, et la personne passe à autre chose. Si le rejeu
// est ensuite REFUSÉ — un accès partagé retiré entre-temps, une ligne déjà
// supprimée par quelqu'un d'autre — le rafraîchissement qui suit efface
// l'affichage optimiste et la modification s'évapore. Elle avait tout lieu de
// croire que c'était enregistré.
//
// C'était le dernier endroit du hors-ligne où l'on pouvait perdre quelque
// chose sans le savoir.
//
// ÇA DOIT SURVIVRE AU REDÉMARRAGE, et c'est ce qui interdit une alerte
// passagère : le rejeu se produit au retour du réseau, souvent alors que
// l'application est en arrière-plan ou fermée. Une bannière qu'on ne voit pas
// ne prévient personne. L'échec est donc CONSERVÉ jusqu'à ce qu'on le traite.
//
// RANGÉ DANS LE CACHE DE REQUÊTES, et c'est un usage un peu détourné assumé :
// ce n'est pas une donnée serveur, c'est de l'état d'application. Mais le
// cache est déjà persisté sur le disque et déjà réactif — le refaire à côté
// demanderait un magasin, sa persistance et ses abonnements, pour exactement
// le même résultat. Contrepartie : un changement de version du cache
// (CACHE_VERSION dans queryClient) efface aussi ces échecs.

/**
 * Ce qu'on montre à la personne. Un COUPLE type + nom plutôt qu'une phrase
 * toute faite : la phrase est traduite au moment de l'affichage, donc elle
 * suit la langue même si celle-ci a changé depuis l'échec.
 */
export type WriteDescription = {
  kind: 'create' | 'update' | 'delete' | 'move' | 'photo';
  /** Le nom de l'objet, de la pièce… tel qu'il était au moment du geste. */
  name: string;
};

export type SyncFailure = {
  id: string;
  describe: WriteDescription;
  /** Le message du serveur, affiché en second plan pour le diagnostic. */
  message: string;
  failedAt: string;
  /** De quoi rejouer la même écriture à l'identique. */
  ops: WriteOp[];
};

export const SYNC_FAILURES_KEY = ['ceou', 'syncFailures'] as const;

export function readSyncFailures(client: QueryClient): SyncFailure[] {
  return client.getQueryData<SyncFailure[]>(SYNC_FAILURES_KEY) ?? [];
}

function writeSyncFailures(client: QueryClient, failures: SyncFailure[]): void {
  client.setQueryData(SYNC_FAILURES_KEY, failures);
}

export function recordSyncFailure(client: QueryClient, failure: SyncFailure): void {
  // Empilées dans l'ordre où elles sont survenues, la plus récente en tête :
  // c'est celle dont on se souvient le mieux, donc celle qu'on peut décider
  // de rejouer ou d'abandonner en connaissance de cause.
  writeSyncFailures(client, [failure, ...readSyncFailures(client)]);
}

export function dismissSyncFailure(client: QueryClient, id: string): void {
  writeSyncFailures(
    client,
    readSyncFailures(client).filter((failure) => failure.id !== id),
  );
}

export function clearSyncFailures(client: QueryClient): void {
  writeSyncFailures(client, []);
}
