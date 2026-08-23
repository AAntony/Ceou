import { MutationCache, QueryClient } from '@tanstack/react-query';

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
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 1,
    },
  },
  mutationCache: new MutationCache({
    onSettled: (_data, _error, _variables, _context, mutation) => {
      if (mutation.meta?.skipGlobalRefresh) return;
      queryClient.invalidateQueries();
    },
  }),
});
