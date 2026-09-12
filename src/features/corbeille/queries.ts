import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase/client';
import { rpcOp, type WriteOp } from '../../lib/writeQueue';

// LA CORBEILLE.
//
// CE QU'ELLE CORRIGE : les clés étrangères de l'inventaire cascadent toutes.
// Supprimer une pièce emportait ses rangements, ses boîtes et tous les objets
// dedans — des mois de saisie en un appui, sans retour possible. Voir la
// migration pour le détail, et surtout pour la raison du choix d'un
// INSTANTANÉ plutôt que d'une suppression douce : aucune lecture de l'app ne
// change, donc aucune ne risque d'oublier d'écarter ce qui est supprimé.

export type CorbeilleKind = 'habitation' | 'piece' | 'emplacement' | 'conteneur' | 'objet' | 'facture';

export type CorbeilleEntree = {
  id: string;
  kind: CorbeilleKind;
  /** Le nom que portait la chose supprimée. Vide pour une facture sans vendeur. */
  label: string;
  /** Ce qui est parti avec elle, en nombres. L'écran en fait une phrase. */
  resume: { pieces?: number; emplacements?: number; conteneurs?: number; objets?: number; factures?: number };
  deleted_at: string;
};

export function useCorbeille() {
  return useQuery({
    queryKey: ['corbeille'],
    queryFn: async (): Promise<CorbeilleEntree[]> => {
      const { data, error } = await supabase.rpc('corbeille_lister');
      if (error) throw error;
      // `kind` et `resume` arrivent en `string` et en `Json` : le type est
      // resserre ici, en un seul endroit, plutot qu'a chaque lecture.
      return (data ?? []) as unknown as CorbeilleEntree[];
    },
  });
}

/**
 * L'instantané, à poser DANS LE MÊME LOT que la suppression et AVANT elle.
 *
 * La file exécute ses opérations dans l'ordre : l'instantané part donc en
 * premier, même quand tout a été fait hors ligne des heures plus tôt. Et si
 * l'instantané échoue, le lot entier échoue — on préfère une suppression qui
 * n'a pas eu lieu à une suppression sans filet.
 *
 * ⚠️ CETTE OPÉRATION EXIGE LA MIGRATION. Publiée avant elle, la fonction
 * n'existe pas côté serveur et plus aucune suppression n'aboutit.
 */
export function deposerOp(kind: CorbeilleKind, id: string): WriteOp {
  return rpcOp('corbeille_deposer', { p_kind: kind, p_id: id });
}

/**
 * Remettre en place.
 *
 * PAS PAR LA FILE D'ÉCRITURE, contrairement au reste de l'app : restaurer
 * n'a de sens qu'en ligne — la fonction relit un instantané qui vit sur le
 * serveur, et l'app n'en a jamais eu de copie. Un geste hors ligne qui
 * n'aboutirait qu'au retour du réseau, sans rien afficher entre-temps,
 * mentirait plus qu'il n'aiderait.
 */
export function useRestaurer() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<string> => {
      const { data, error } = await supabase.rpc('corbeille_restaurer', { p_id: id });
      if (error) throw error;
      return data ?? 'ok';
    },
    onSuccess: () => {
      // TOUT EST À RELIRE : une habitation restaurée reparaît sur l'accueil,
      // dans la recherche, dans les dossiers de factures. Chercher quelles
      // clés exactement, c'est la garantie d'en oublier une.
      void client.invalidateQueries();
    },
  });
}

export function useViderCorbeille() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('corbeille_vider');
      if (error) throw error;
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['corbeille'] });
    },
  });
}
