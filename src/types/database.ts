import type { Database } from './supabase';

export type { Database };

type Tables = Database['public']['Tables'];

export type Profile = Tables['profiles']['Row'];
export type Habitation = Tables['habitations']['Row'];
export type Piece = Tables['pieces']['Row'];
export type Emplacement = Tables['emplacements']['Row'];
export type Conteneur = Tables['conteneurs']['Row'];
export type Objet = Tables['objets']['Row'];
export type ObjetDeplacement = Tables['objet_deplacements']['Row'];
export type Plan = Tables['plans']['Row'];
export type PlanForme = Tables['plan_formes']['Row'];
export type PlanPin = Tables['plan_pins']['Row'];
export type ClientErrorInsert = Tables['client_errors']['Insert'];
// `Friendship` et `HabitationShare` (les Row brutes de friendships /
// habitation_shares) vivaient ici, retirés à l'audit du 2026-08-19 : aucun
// consommateur. Le partage et l'amitié ne s'exposent jamais en ligne brute
// côté app, toujours via les types remodelés de sharing/queries.ts
// (`FriendshipEntry`, `HabitationShareEntry`) qui résolvent en plus le
// nom/avatar de l'autre partie. Une ligne à réécrire si le besoin revient.
export type ShareInvite = Tables['share_invites']['Row'];
export type HabitationFavorite = Tables['habitation_favorites']['Row'];

export type LocationType = 'emplacement' | 'conteneur';
export type HabitationPermission = 'consultation' | 'modification' | 'proprietaire';
export type EffectiveHabitationPermission = 'owner' | HabitationPermission;
