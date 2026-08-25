import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { RefreshControl } from 'react-native';

// Le « tirer pour rafraîchir », prêt à poser sur n'importe quelle liste.
//
// UN SEUL ENDROIT POUR TOUS LES ÉCRANS, parce qu'un geste appris doit marcher
// partout : proposé sur deux écrans et absent du troisième, il devient un
// piège plutôt qu'un raccourci.
//
// RECHARGE LES REQUÊTES « ACTIVES », c'est-à-dire celles réellement montées à
// l'instant où l'on tire — donc exactement ce que l'écran affiche, sans avoir
// à énumérer ses clés. Un écran qui gagne une requête plus tard est couvert
// sans qu'on ait à y repenser, ce qu'une liste de clés écrite à la main ne
// garantit jamais bien longtemps.
//
// Contrepartie assumée : les onglets restant montés, tirer quelque part
// recharge aussi leurs données. C'est un geste volontaire et rare, et il
// correspond à ce que la personne demande — « resynchronise l'application »,
// pas « resynchronise cette liste-ci ».

const ACCENT = '#1591EA';

/**
 * @param progressViewOffset Ou faire apparaitre le rouleau, en partant du
 * haut de la liste. Utile aux ecrans dont un calque recouvre ce haut-la :
 * sans decalage, le rouleau tourne DERRIERE l'en-tete et le geste parait
 * sans effet.
 */
export function usePullToRefresh(progressViewOffset?: number) {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await queryClient.refetchQueries({ type: 'active' });
    } finally {
      // `finally` et non la fin du `try` : une requête qui échoue doit quand
      // même faire disparaître l'indicateur, sinon il tourne indéfiniment et
      // l'écran paraît bloqué.
      setRefreshing(false);
    }
  }, [queryClient]);

  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      colors={[ACCENT]}
      tintColor={ACCENT}
      progressViewOffset={progressViewOffset}
    />
  );
}
