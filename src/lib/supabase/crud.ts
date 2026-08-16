import type { Database } from '../../types/database';
import { supabase } from './client';

type Tables = Database['public']['Tables'];
type TableName = keyof Tables;
// selectOne/deleteRow supposent une clé primaire `id` (voir leur usage
// ci-dessous) — vrai pour toutes les tables SAUF ai_scan_rate_limit
// (clé primaire `user_id`, jamais touchée via ces helpers génériques de
// toute façon, uniquement par l'Edge Function detect-objects). Ce type
// conditionnel exclut automatiquement toute future table sans colonne `id`,
// plutôt qu'une liste d'exclusions à maintenir à la main.
type TableWithId = { [K in TableName]: 'id' extends keyof Tables[K]['Row'] ? K : never }[TableName];

// Trois formes de requête (lire une ligne par id, lister par une colonne de
// filtre optionnelle avec tri optionnel, supprimer par id) couvrent la quasi-
// totalité des hooks CRUD de l'inventaire et des plans (Habitation, Pièce,
// Emplacement, Conteneur, Objet, Plan, PlanForme, PlanPin) — factorisées ici
// pour ne pas répéter le même bloc "supabase.from(...)... / if (error) throw
// error" dans chaque queries.ts. Les mutations d'insert/update restent, elles,
// écrites à la main dans chaque fichier : leurs champs varient trop d'une
// entité à l'autre pour qu'une généricité y apporte quoi que ce soit.

export async function selectOne<T>(table: TableWithId, id: string): Promise<T> {
  const { data, error } = await supabase.from(table).select('*').eq('id', id).single();
  if (error) throw error;
  return data as T;
}

export async function selectMany<T>(table: TableName, filter?: { column: string; value: string }, orderBy?: string): Promise<T[]> {
  let query = supabase.from(table).select('*');
  if (filter) query = query.eq(filter.column, filter.value);
  if (orderBy) query = query.order(orderBy);
  const { data, error } = await query;
  if (error) throw error;
  return data as T[];
}

export async function deleteRow(table: TableWithId, id: string): Promise<void> {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw error;
}
