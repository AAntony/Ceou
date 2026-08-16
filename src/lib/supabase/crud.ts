import type { Database } from '../../types/database';
import { supabase } from './client';

type TableName = keyof Database['public']['Tables'];

// Trois formes de requête (lire une ligne par id, lister par une colonne de
// filtre optionnelle avec tri optionnel, supprimer par id) couvrent la quasi-
// totalité des hooks CRUD de l'inventaire et des plans (Habitation, Pièce,
// Emplacement, Conteneur, Objet, Plan, PlanForme, PlanPin) — factorisées ici
// pour ne pas répéter le même bloc "supabase.from(...)... / if (error) throw
// error" dans chaque queries.ts. Les mutations d'insert/update restent, elles,
// écrites à la main dans chaque fichier : leurs champs varient trop d'une
// entité à l'autre pour qu'une généricité y apporte quoi que ce soit.

export async function selectOne<T>(table: TableName, id: string): Promise<T> {
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

export async function deleteRow(table: TableName, id: string): Promise<void> {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw error;
}
