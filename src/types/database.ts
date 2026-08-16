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

export type LocationType = 'emplacement' | 'conteneur';
