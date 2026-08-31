import { onlineManager } from '@tanstack/react-query';
import * as Network from 'expo-network';
import { useEffect, useState } from 'react';

// L'ÉTAT DU RÉSEAU, ET LE SEUL ENDROIT QUI LE DÉCIDE.
//
// TanStack Query porte déjà toute la mécanique du hors-ligne : une requête ne
// part pas quand il se sait déconnecté, une mutation est mise en attente
// plutôt que d'échouer, et tout repart au retour du réseau. Mais il ne SAIT
// pas, par lui-même, ce qu'un téléphone fait de sa connexion — sur le web il
// écoute `window.online`, qui n'existe pas ici. Sans ce branchement, il se
// croit connecté en permanence et le hors-ligne ne s'enclenche jamais.
//
// `expo-network` plutôt que @react-native-community/netinfo : c'est un module
// du SDK, donc versionné avec lui, et il expose exactement les deux choses
// nécessaires — l'état courant et un écouteur de changement.
//
// C'EST UN MODULE NATIF. Il n'arrive donc PAS par une mise à jour OTA : tant
// qu'un appareil n'a pas réinstallé l'application, ce fichier ne peut pas
// fonctionner chez lui. D'où les gardes ci-dessous, qui laissent l'app se
// comporter comme avant plutôt que de planter.

/**
 * `isInternetReachable` vaut `undefined` le temps qu'Android tranche, et
 * suit simplement `isConnected` sur iOS (limite documentée du module). On ne
 * déclare donc hors-ligne que sur un `false` FRANC : traiter l'indécision
 * comme une coupure ferait clignoter le bandeau à chaque changement de
 * réseau, et suspendrait des requêtes qui seraient passées.
 */
function isOnline(state: Network.NetworkState): boolean {
  return state.isConnected === true && state.isInternetReachable !== false;
}

/**
 * À appeler UNE FOIS au démarrage, avant le premier rendu.
 *
 * `setEventListener` remplace l'écouteur par défaut de TanStack (celui du
 * navigateur) : la fonction reçoit un `setOnline` et rend de quoi se
 * désabonner. L'abonnement vit aussi longtemps que l'application, il n'y a
 * donc rien à défaire.
 */
export function installOnlineManager(): void {
  onlineManager.setEventListener((setOnline) => {
    // TOUT LE BLOC EST GARDÉ, et pas seulement l'appel asynchrone.
    //
    // C'était un vrai défaut de la première version : seul
    // `getNetworkStateAsync` était protégé, par un `.catch()` qui ne rattrape
    // que les promesses. `addNetworkStateListener`, lui, lève
    // SYNCHRONEMENT quand le module natif est absent — l'exception
    // traversait donc `setEventListener` et faisait tomber l'application au
    // démarrage.
    //
    // Le cas n'a rien de théorique : les appareils qui n'ont pas encore
    // réinstallé l'application n'embarquent pas expo-network, et une mise à
    // jour OTA leur arrive quand même. Ce fichier aurait planté chez eux.
    try {
      // L'état INITIAL, et il compte autant que les suivants : l'écouteur ne
      // se déclenche qu'au prochain CHANGEMENT. Sans cette lecture, une app
      // ouverte en mode avion se croirait en ligne jusqu'à ce que le réseau
      // bouge — c'est-à-dire précisément quand on a le plus besoin qu'elle le
      // sache.
      Network.getNetworkStateAsync()
        .then((state) => setOnline(isOnline(state)))
        .catch(() => setOnline(true));

      const subscription = Network.addNetworkStateListener((state) => setOnline(isOnline(state)));
      return () => subscription.remove();
    } catch {
      // On reste sur l'hypothèse « en ligne », c'est-à-dire le comportement
      // d'avant ce fichier : l'app tente ses requêtes et échoue proprement.
      // Mieux que de se croire hors-ligne et de ne rien tenter — et
      // infiniment mieux que de ne pas démarrer.
      setOnline(true);
      return () => {};
    }
  });
}

/**
 * Vrai quand TanStack se sait déconnecté. Lit la MÊME source que celle qui
 * décide de suspendre les requêtes : le bandeau ne peut donc pas annoncer
 * autre chose que ce que l'application fait réellement.
 */
export function useIsOffline(): boolean {
  const [offline, setOffline] = useState(() => !onlineManager.isOnline());

  useEffect(() => onlineManager.subscribe((online) => setOffline(!online)), []);

  return offline;
}
