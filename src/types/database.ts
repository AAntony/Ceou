import type { Database } from './supabase';

export type { Database };
export type Profile = Database['public']['Tables']['profiles']['Row'];
