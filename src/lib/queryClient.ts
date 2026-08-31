import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { MutationCache, QueryClient } from '@tanstack/react-query';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';

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
      queryClient.invalidateQueries();
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
const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'ceou.query-cache',
  // Le cache est réécrit à chaque changement : sans étranglement, une simple
  // navigation dans l'inventaire déclencherait des dizaines de sérialisations
  // complètes par seconde.
  throttleTime: 2000,
});

// À BUMPER QUAND LA FORME D'UNE DONNÉE EN CACHE CHANGE — pas à chaque version
// de l'app. Un cache relu dans une forme que le code ne reconnaît plus
// afficherait des écrans faux plutôt qu'une erreur franche ; changer cette
// chaîne le fait jeter d'un coup.
//
// Délibérément PAS le hash de commit : il changerait à chaque mise à jour
// OTA, et jetterait donc le cache précisément le jour où quelqu'un ouvre
// l'app sans réseau après une mise à jour.
const CACHE_VERSION = 'v1';

export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister,
  maxAge: CACHE_LIFETIME,
  buster: CACHE_VERSION,
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
