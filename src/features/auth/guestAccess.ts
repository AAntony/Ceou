import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase/client';

// Entrée d'un visiteur par code d'invitation.
//
// Un visiteur n'a pas de compte et ne doit pas avoir à en créer un : on lui
// ouvre une SESSION ANONYME Supabase, qui lui donne un vrai auth.uid() sans
// e-mail ni mot de passe. C'est cet uid qui est enregistré dans
// share_invite_redemptions, et c'est de là que découle son accès en
// consultation (voir habitation_share_permission dans la migration
// 20260820120000).
//
// Il n'a rien à perdre en désinstallant l'app : la RLS lui interdit de créer
// quoi que ce soit (habitations_insert exige `not is_anonymous()`), il ne
// fait que consulter. C'est pourquoi on ne cherche pas à préserver cette
// session — décision explicite prise avec l'utilisateur.

export type GuestEntryResult = {
  habitationIds: string[];
  /** true si ce code avait déjà été utilisé par CETTE personne. */
  already: boolean;
};

type RedeemResponse =
  | { type: 'guest'; granted: boolean; already: boolean; habitation_ids: string[] }
  | { type: 'friend'; friendship_id: string };

/**
 * Consomme un code d'invitation, en ouvrant si besoin une session anonyme.
 *
 * Réutilise la session existante si l'utilisateur est DÉJÀ connecté avec un
 * vrai compte : quelqu'un qui a un compte et scanne le QR d'un ami ne doit
 * pas se retrouver basculé en visiteur anonyme et perdre l'accès à ses
 * propres habitations.
 */
export async function redeemInviteAsGuest(code: string): Promise<GuestEntryResult> {
  const { data: existing } = await supabase.auth.getSession();
  const createdAnonymousSession = !existing.session;

  if (createdAnonymousSession) {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
  }

  try {
    const { data, error } = await supabase.rpc('redeem_share_invite', { p_code: code.trim() });
    if (error) throw error;

    const response = data as RedeemResponse;
    if (response.type !== 'guest') {
      // Un code d'AMI exige une approbation de l'autre personne et n'a donc
      // aucun sens pour une session anonyme : elle ne pourra jamais consulter
      // ses demandes ni être reconnue. Traité comme un refus.
      throw new Error('invite_is_friend_type');
    }

    return { habitationIds: response.habitation_ids ?? [], already: response.already };
  } catch (error) {
    // Sans ce rattrapage, un code périmé laisserait le visiteur connecté en
    // fantôme : une session anonyme valide, mais aucun accès à quoi que ce
    // soit — donc une app vide, sans écran de connexion pour en sortir.
    if (createdAnonymousSession) await supabase.auth.signOut({ scope: 'local' });
    throw error;
  }
}

export type GuestAccessStatus = {
  /**
   * - `active`   : au moins un code encore valable.
   * - `expired`  : tous les codes utilisés ont dépassé leur date.
   * - `revoked`  : plus aucune trace d'utilisation — l'hôte a supprimé le code.
   * - `none`     : pas un visiteur (compte normal n'ayant jamais utilisé de code).
   */
  status: 'active' | 'expired' | 'revoked' | 'none';
  /** Date à laquelle l'accès s'est éteint, quand `status` vaut `expired`. */
  expiresAt: string | null;
};

/**
 * Pourquoi le visiteur ne voit plus rien.
 *
 * À n'appeler que pour une session anonyme (`enabled`) : pour tout le monde
 * d'autre la réponse est toujours `none`, autant ne pas faire l'aller-retour.
 */
export function useGuestAccessStatus(enabled: boolean) {
  return useQuery({
    queryKey: ['guestAccessStatus'],
    enabled,
    queryFn: async (): Promise<GuestAccessStatus> => {
      const { data, error } = await supabase.rpc('my_guest_access_status');
      if (error) throw error;
      const row = data as { status: GuestAccessStatus['status']; expires_at: string | null };
      return { status: row.status, expiresAt: row.expires_at };
    },
  });
}
