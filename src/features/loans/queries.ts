import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase/client';
import { cancelLoanReminder } from '../notifications/loanReminders';
import { useSession } from '../auth/SessionProvider';

// Prêts et emprunts d'objets.
//
// L'objet ne bouge PAS quand il est prêté : il garde son emplacement (voir la
// migration 20260826110000). Un prêt est donc une couche posée sur l'objet,
// jamais un déplacement — ce qui permet de savoir où le ranger au retour.

export type PretDirection = 'pret' | 'emprunt';

export type PretEntry = {
  id: string;
  objetId: string;
  objetName: string;
  objetPhotoUrl: string | null;
  direction: PretDirection;
  /** Nom à jour si c'est un ami accepté, sinon l'instantané stocké au prêt. */
  counterpartLabel: string;
  counterpartUserId: string | null;
  counterpartAvatarUrl: string | null;
  startedAt: string;
  dueAt: string | null;
  returnedAt: string | null;
  note: string | null;
};

type PretRow = {
  id: string;
  objet_id: string;
  objet_name: string;
  objet_photo_url: string | null;
  direction: string;
  counterpart_label: string;
  counterpart_user_id: string | null;
  counterpart_avatar_url: string | null;
  started_at: string;
  due_at: string | null;
  returned_at: string | null;
  note: string | null;
};

const mapRow = (row: PretRow): PretEntry => ({
  id: row.id,
  objetId: row.objet_id,
  objetName: row.objet_name,
  objetPhotoUrl: row.objet_photo_url,
  direction: row.direction as PretDirection,
  counterpartLabel: row.counterpart_label,
  counterpartUserId: row.counterpart_user_id,
  counterpartAvatarUrl: row.counterpart_avatar_url,
  startedAt: row.started_at,
  dueAt: row.due_at,
  returnedAt: row.returned_at,
  note: row.note,
});

/**
 * Date de retour à partir d'un nombre de jours.
 *
 * Jumelle de `expiryInDays` (sharing/queries) et recopiée pour la même raison
 * qu'elle : `Date.now()` n'a rien à faire dans le corps d'un composant, une
 * valeur qui change à chaque rendu n'y étant pas pure. Trois lignes recopiées
 * valent mieux qu'un import croisé entre deux domaines pour si peu.
 */
export function dueInDays(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

/** Vrai quand l'échéance est passée. Un prêt sans échéance n'est jamais en retard. */
export function isOverdue(entry: PretEntry): boolean {
  return entry.returnedAt === null && entry.dueAt !== null && new Date(entry.dueAt).getTime() < Date.now();
}

// UNE SEULE LECTURE POUR TOUTE L'APP. L'écran « Prêts » et le bandeau posé sur
// la fiche d'un objet lisent la même liste : le second y cherche sa ligne
// plutôt que de lancer sa propre requête. Un prêt fermé ici se reflète donc
// immédiatement là-bas, sans invalidation croisée à penser.
export function usePrets(includeClosed = false) {
  const { session } = useSession();
  return useQuery({
    queryKey: ['prets', includeClosed],
    enabled: !!session,
    queryFn: async (): Promise<PretEntry[]> => {
      const { data, error } = await supabase.rpc('list_objet_prets', { p_include_closed: includeClosed });
      if (error) throw error;
      return ((data ?? []) as PretRow[]).map(mapRow);
    },
  });
}

/** Le prêt en cours d'un objet, s'il y en a un. */
export function useObjetPret(objetId: string | undefined) {
  const { data, isLoading } = usePrets(false);
  return {
    pret: objetId ? (data?.find((entry) => entry.objetId === objetId) ?? null) : null,
    isLoading,
  };
}

function invalidatePrets(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['prets'] });
}

export type NewPret = {
  objetId: string;
  direction: PretDirection;
  counterpartLabel: string;
  /** Renseigné uniquement pour un ami accepté — le serveur refuse tout autre lien. */
  counterpartUserId: string | null;
  dueAt: string | null;
  note: string | null;
};

export function useCreatePret() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewPret) => {
      const { data, error } = await supabase
        .from('objet_prets')
        .insert({
          objet_id: input.objetId,
          direction: input.direction,
          counterpart_label: input.counterpartLabel.trim(),
          counterpart_user_id: input.counterpartUserId,
          due_at: input.dueAt,
          note: input.note,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidatePrets(queryClient),
  });
}

// Rendre, ce n'est pas supprimer : la ligne porte une date de retour et
// bascule dans l'historique. « Je lui ai déjà prêté trois fois » est une
// information qui ne coûte rien à garder.
export function useClosePret() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (pretId: string) => {
      const { error } = await supabase
        .from('objet_prets')
        .update({ returned_at: new Date().toISOString() })
        .eq('id', pretId);
      if (error) throw error;
      return pretId;
    },
    // Le rappel est retiré ICI et non dans l'écran : on clôt un prêt aussi
    // bien depuis la fiche de l'objet que depuis la liste, et le téléphone ne
    // doit pas annoncer le retour d'un objet déjà revenu.
    onSuccess: (pretId) => {
      void cancelLoanReminder(pretId);
      invalidatePrets(queryClient);
    },
  });
}

/** Pour une saisie erronée. Rendre un objet passe par useClosePret, pas par ici. */
export function useDeletePret() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (pretId: string) => {
      const { error } = await supabase.from('objet_prets').delete().eq('id', pretId);
      if (error) throw error;
      return pretId;
    },
    onSuccess: (pretId) => {
      void cancelLoanReminder(pretId);
      invalidatePrets(queryClient);
    },
  });
}
