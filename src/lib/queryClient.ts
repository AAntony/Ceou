import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { defaultShouldDehydrateQuery, hashKey, MutationCache, QueryClient } from '@tanstack/react-query';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';
import { errorMessage, logClientError } from './errorLogging';
import { recordSyncFailure, SYNC_FAILURES_KEY } from './syncFailures';
import { WRITE_MUTATION_KEY, type WriteBatch } from './writeQueue';

/**
 * La clé du cliché hors-ligne, déclarée ICI et non dans le module qui s'en
 * sert : ce fichier ne dépend de rien, alors que `offlineSnapshot` dépend de
 * `SessionProvider`, qui dépend de ce fichier. L'importer dans l'autre sens
 * fermerait le cycle.
 */
export const INVENTORY_SNAPSHOT_KEY = 'inventorySnapshot';

/**
 * La clé des adresses signées du stockage.
 *
 * Déclarée ici pour la même raison que celle du dessus : ce fichier ne dépend
 * de rien, et les deux exclusions plus bas ont besoin de la reconnaître. Une
 * signature n'est pas une donnée comme les autres — elle échappe à deux
 * règles générales du cache, chacune commentée à son endroit.
 */
export const MEDIA_SIGNATURE_KEY = 'media-signature';

// `skipGlobalRefresh` : la seule échappatoire à la règle ci-dessous, pour
// les mutations à haute fréquence (un glissé de forme sur un plan en émet
// une par relâché) qui invalident déjà exactement ce qu'elles touchent.
declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: { skipGlobalRefresh?: boolean };
  }
}

// TOUTE ÉCRITURE RÉUSSIE RAFRAÎCHIT TOUT CE QUI EST AFFICHÉ.
//
// Pourquoi une règle globale plutôt qu'une liste de clés par mutation :
// l'app compte 44 mutations pour 85 requêtes, et c'est le CROISEMENT des
// deux qu'il faudrait tenir à jour à la main. Chaque case oubliée est un
// écran qui ment jusqu'au prochain rechargement — exactement le défaut
// constaté sur le compteur d'habitations partagées, dont personne n'avait
// pensé à invalider la clé en changeant un droit. Une nouvelle requête
// branchée demain est couverte sans que quiconque ait à y penser.
//
// `onSettled` et pas `onSuccess` : après un échec aussi il faut resynchroniser,
// c'est ce qui remet d'aplomb un affichage optimiste qui a parlé trop vite.
//
// Le coût est modeste : `invalidateQueries()` ne relance en réseau que les
// requêtes réellement MONTÉES ; les autres sont juste marquées périmées et
// se rechargeront à leur prochain affichage.
// SEPT JOURS DE DURÉE DE VIE, ET C'EST LA PERSISTANCE QUI L'EXIGE.
//
// `gcTime` dit combien de temps une requête SANS observateur survit en
// mémoire. Sa valeur par défaut est de cinq minutes — et une donnée relue du
// disque au démarrage n'a, pendant un instant, aucun observateur. Laissée à
// cinq minutes, la moitié du cache restauré serait balayée avant d'avoir
// servi : on aurait écrit sur le disque pour rien.
//
// Sept jours, c'est le pari raisonnable sur « je rouvre l'app sans réseau » :
// au-delà, une donnée d'inventaire vieille d'une semaine mérite de toute
// façon d'être rechargée plutôt que montrée.
const CACHE_LIFETIME = 7 * 24 * 60 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 1,
      gcTime: CACHE_LIFETIME,
    },
  },
  mutationCache: new MutationCache({
    onSettled: (_data, _error, _variables, _context, mutation) => {
      if (mutation.meta?.skipGlobalRefresh) return;
      // LE CLICHÉ HORS-LIGNE EST EXCLU DE CE BALAYAGE, et c'est indispensable.
      // C'est une dizaine de requêtes qui descendent tout l'arbre ; le
      // remettre en cause à chaque écriture le relancerait en entier à chaque
      // renommage d'objet. Il se garnit au démarrage et au retour du réseau,
      // pas à chaque frappe.
      //
      // LA LISTE DES ÉCHECS D'ENVOI EST EXCLUE ELLE AUSSI, pour une autre
      // raison : ce n'est pas une donnée serveur, personne ne peut la
      // « recharger ». La marquer périmée déclencherait une relecture vide
      // de sens après chaque écriture.
      //
      // LES ADRESSES SIGNÉES SONT EXCLUES ELLES AUSSI, pour une troisième
      // raison : une signature ne devient pas fausse parce qu'un objet a été
      // renommé. Elle ne dépend que du fichier et de l'heure. La balayer à
      // chaque écriture ferait re-signer toutes les photos affichées à chaque
      // frappe enregistrée, pour rendre exactement les mêmes images.
      queryClient.invalidateQueries({
        predicate: (query) =>
          query.queryKey[0] !== INVENTORY_SNAPSHOT_KEY &&
          query.queryKey[0] !== MEDIA_SIGNATURE_KEY &&
          query.queryHash !== hashKey(SYNC_FAILURES_KEY),
      });
    },
    // UNE ÉCRITURE DIFFÉRÉE QUI ÉCHOUE NE DOIT PAS DISPARAÎTRE EN SILENCE.
    //
    // Le cas est nouveau depuis la file hors-ligne, et il est vicieux : une
    // modification part en attente, la personne voit son écran changer et
    // passe à autre chose, puis le rejeu se solde par un refus — un accès
    // partagé retiré entre-temps, par exemple. L'invalidation qui suit efface
    // alors l'affichage optimiste, et la modification s'évapore sans que
    // personne ne l'ait vue échouer.
    //
    // ELLE EST DÉSORMAIS RETENUE ET MONTRÉE. Le journal reste — c'est lui
    // qui porte la pile d'appels — mais il ne prévenait personne : on ne lit
    // pas les journaux de son téléphone. L'échec rejoint une liste persistée
    // qu'une bande rouge annonce jusqu'à ce qu'on la traite (voir
    // lib/syncFailures), avec le choix de rejouer ou d'abandonner.
    //
    // SEULES LES ÉCRITURES DE LA FILE y entrent, et c'est ce que teste la
    // comparaison de clé ci-dessous. Les autres mutations — favoris, amis,
    // profil — parlent au serveur sur le champ, sous les yeux de la personne
    // qui vient d'appuyer : leur échec se constate à l'écran, immédiatement.
    // Les inscrire ici afficherait une alerte différée pour un refus déjà vu.
    onError: (error, variables, _context, mutation) => {
      logClientError(error, { source: 'mutation', mutationKey: JSON.stringify(mutation.options.mutationKey ?? null) });

      const key = mutation.options.mutationKey;
      if (key === undefined || hashKey(key) !== hashKey(WRITE_MUTATION_KEY)) return;

      const batch = variables as WriteBatch | undefined;
      if (!batch) return;

      recordSyncFailure(queryClient, {
        // L'HORODATAGE FAIT PARTIE DE L'IDENTIFIANT, et il le faut : le
        // compteur de `mutationId` repart de zéro à chaque lancement de
        // l'application. Un échec survenu après un redémarrage aurait donc
        // pu porter le même numéro qu'un échec plus ancien encore en
        // liste — et « Abandonner » en aurait effacé deux d'un coup.
        id: `${Date.now()}-${mutation.mutationId}`,
        // LA DESCRIPTION PEUT MANQUER, et seulement dans un cas : une
        // écriture déjà en file AVANT cette version, relue du disque après
        // la mise à jour. `describe` est obligatoire à la compilation, mais
        // le compilateur n'a rien à dire sur ce qu'un ancien binaire a
        // écrit. Plutôt que d'afficher une ligne cassée — ou pire, de se
        // taire, ce que ce fichier existe justement pour éviter — on annonce
        // ce qu'on sait : une modification n'est pas passée.
        describe: batch.describe ?? { kind: 'update', name: '' },
        // PAS `instanceof Error` : une erreur de supabase-js n'en est pas
        // une au runtime, et `String()` la rendait en « [object Object] » —
        // le champ censé expliquer le refus n'expliquait donc rien. Le piège
        // est documenté deux fois ailleurs dans ce dépôt (errorLogging,
        // rpcError) ; il ne manquait plus qu'ici.
        message: errorMessage(error),
        failedAt: new Date().toISOString(),
        ops: batch.ops,
      });
    },
  }),
});

// LE CACHE SUR LE DISQUE.
//
// C'est ce qui fait qu'une application ouverte sans réseau montre l'inventaire
// au lieu d'un écran d'erreur. Le cache mémoire de TanStack meurt avec le
// processus ; celui-ci est réécrit sur AsyncStorage et relu au démarrage.
//
// AsyncStorage et non SQLite : la base est déjà là (session, thème, taille du
// texte) et le volume en jeu est petit — quelques centaines d'objets avec
// leur nom et leur emplacement pèsent des dizaines de kilo-octets. À NOTER
// quand même : côté Android, AsyncStorage plafonne par défaut à 6 Mo, et le
// dépassement se solde par une écriture qui échoue, pas par un plantage. Un
// inventaire qui atteindrait ce volume demanderait de relever la limite au
// niveau natif, ou de filtrer ce qu'on persiste.
// ═══ UN `Map` NE SURVIT PAS À JSON, ET ÇA A FAIT PLANTER L'APPLICATION ═══
//
// `JSON.stringify(new Map([['a', 1]]))` rend `{}`. Sans réviseur, une requête
// qui rend un `Map` était donc relue comme un objet NU, et le premier `.get()`
// levait « membership.get is not a function ». L'ErrorBoundary prenait le
// relais et affichait « Une erreur est survenue » : l'application entière
// devenait inutilisable, et le rester après redémarrage puisque le cache
// fautif était sur le disque.
//
// Ça n'atteignait que DEUX écrans, et c'est ce qui rendait le défaut si
// déroutant : seuls Habitations (compteurs d'objets) et Amis (catégories,
// partages) consomment des requêtes à `Map`. Tout le reste marchait.
//
// La correction est ici plutôt que dans les quatre requêtes concernées : un
// `Map` est la bonne structure pour ces données, et convertir chacune en objet
// nu déplacerait le problème sur la prochaine qu'on écrira sans y penser. Le
// `Set` est traité aussi, alors qu'aucune requête n'en rend aujourd'hui —
// c'est exactement le même piège, et il ne coûte rien de le fermer.
const MAP_TAG = '__ceouMap';
const SET_TAG = '__ceouSet';

function serializeCache(client: unknown): string {
  return JSON.stringify(client, (_key, value) => {
    if (value instanceof Map) return { [MAP_TAG]: Array.from(value.entries()) };
    if (value instanceof Set) return { [SET_TAG]: Array.from(value.values()) };
    return value;
  });
}

function deserializeCache(cached: string) {
  // Le réviseur remonte des feuilles vers la racine : un `Map` imbriqué dans
  // une liste, ou dans un autre `Map`, est donc reconstruit avant son parent.
  return JSON.parse(cached, (_key, value) => {
    if (value && typeof value === 'object') {
      if (Array.isArray((value as Record<string, unknown>)[MAP_TAG])) {
        return new Map((value as Record<string, [unknown, unknown][]>)[MAP_TAG]);
      }
      if (Array.isArray((value as Record<string, unknown>)[SET_TAG])) {
        return new Set((value as Record<string, unknown[]>)[SET_TAG]);
      }
    }
    return value;
  });
}

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'ceou.query-cache',
  // Le cache est réécrit à chaque changement : sans étranglement, une simple
  // navigation dans l'inventaire déclencherait des dizaines de sérialisations
  // complètes par seconde.
  throttleTime: 2000,
  serialize: serializeCache,
  deserialize: deserializeCache,
});

// À BUMPER QUAND LA FORME D'UNE DONNÉE EN CACHE CHANGE — pas à chaque version
// de l'app. Un cache relu dans une forme que le code ne reconnaît plus
// afficherait des écrans faux plutôt qu'une erreur franche ; changer cette
// chaîne le fait jeter d'un coup.
//
// Délibérément PAS le hash de commit : il changerait à chaque mise à jour
// OTA, et jetterait donc le cache précisément le jour où quelqu'un ouvre
// l'app sans réseau après une mise à jour.
//
// v1 -> v2 : les caches déjà écrits contiennent des `{}` là où il devait y
// avoir des `Map` (voir le réviseur ci-dessus). Le nouveau code les relirait
// tels quels et replanterait — c'est exactement le cas que ce jeton existe
// pour traiter. Les appareils déjà touchés repartent donc d'un cache vide,
// qui se regarnit au premier démarrage avec du réseau.
// v2 -> v3 : les factures ont changé de forme en passant en en-tête/lignes.
// Les caches déjà écrits contiennent des lignes SANS `lignes` — le nouveau
// rendu y lit `facture.lignes.length` et plante avant même d'afficher l'objet.
// C'est le cas exact que ce jeton existe pour traiter, et il a été oublié : la
// mise à jour est partie sans lui et l'app s'est arrêtée sur chaque fiche
// d'objet. Les lectures de `lignes` sont depuis passées par un garde-fou, mais
// jeter le cache reste le bon geste — un cache dans une forme périmée
// afficherait des chiffres faux plutôt qu'une erreur franche.
const CACHE_VERSION = 'v3';

// LES MUTATIONS EN ATTENTE PARTENT SUR LE DISQUE ELLES AUSSI, et c'est ce qui
// fait qu'une modification saisie hors-ligne survit à la fermeture de
// l'application. Rien à déclarer pour ça : le filtre par défaut de TanStack
// (`shouldDehydrateMutation`) retient exactement les mutations EN PAUSE,
// c'est-à-dire celles qui attendent le réseau. Les autres n'ont rien à faire
// sur le disque — elles sont soit terminées, soit en cours.
//
// Elles ne sont rejouables qu'à une condition, posée ailleurs : que leur
// fonction soit retrouvable par leur clé au redémarrage. C'est tout l'objet de
// registerWriteMutation (voir lib/writeQueue).
export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister,
  maxAge: CACHE_LIFETIME,
  buster: CACHE_VERSION,
  dehydrateOptions: {
    // LE CLICHÉ BRUT NE PART PAS SUR LE DISQUE, et pour une raison de taille
    // au sens propre : il contient déjà tout l'inventaire, dont on a extrait
    // les entrées de chaque écran. Le persister aussi écrirait DEUX FOIS les
    // mêmes données — et c'est le plafond de 6 Mo d'AsyncStorage qu'on
    // atteindrait deux fois plus vite. Il est refait au démarrage suivant de
    // toute façon, dès qu'il y a du réseau.
    //
    // LES ADRESSES SIGNÉES NON PLUS, et cette fois c'est une affaire de
    // durée : une signature vaut une heure, ce cache-ci se garde sept jours.
    // Persistée, elle serait relue PÉRIMÉE au démarrage suivant — donc une
    // photo qui ne charge pas, alors que le fichier est là et que la personne
    // y a droit. Re-signer au démarrage coûte un appel groupé ; relire une
    // signature morte coûte une image absente.
    shouldDehydrateQuery: (query) =>
      defaultShouldDehydrateQuery(query) &&
      // Consent form availability must come from UMP, not yesterday's disk cache.
      query.meta?.persist !== false &&
      query.queryKey[0] !== INVENTORY_SNAPSHOT_KEY &&
      query.queryKey[0] !== MEDIA_SIGNATURE_KEY,
  },
};

/**
 * Vide le cache mémoire ET le cache disque.
 *
 * INDISPENSABLE À LA DÉCONNEXION : le cache persisté ignore à qui il
 * appartient. Sans ce ménage, la personne suivante à se connecter sur ce
 * téléphone verrait, le temps d'un rafraîchissement, l'inventaire du compte
 * précédent — et hors-ligne, elle le verrait tout court.
 */
export async function clearPersistedCache(): Promise<void> {
  queryClient.clear();
  await persister.removeClient();
}
