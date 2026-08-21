import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '../auth/SessionProvider';
import { supabase } from '../../lib/supabase/client';
import type { FriendshipEntry } from './queries';

// Catégories d'amis — un rangement personnel, sans effet sur les partages.
//
// Tout est scopé à `owner_id = auth.uid()` côté RLS : ces lignes n'existent
// que pour leur propriétaire, un ami ne peut pas savoir dans quelle
// catégorie on l'a rangé.

export type FriendCategory = {
  id: string;
  name: string;
  position: number;
};

const CATEGORIES_KEY = ['friendCategories'];
const MEMBERS_KEY = ['friendCategoryMembers'];
const COUNTS_KEY = ['friendSharedHabitationCounts'];

export function useFriendCategories() {
  const { session } = useSession();
  return useQuery({
    queryKey: CATEGORIES_KEY,
    enabled: !!session,
    queryFn: async (): Promise<FriendCategory[]> => {
      const { data, error } = await supabase
        .from('friend_categories')
        .select('id, name, position')
        // `position` d'abord, `name` pour départager deux catégories créées
        // à la suite (même position par défaut) — sans ce second critère,
        // leur ordre changerait d'un chargement à l'autre.
        .order('position', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** `friend_user_id -> category_id`, pour ranger chaque ami en une passe. */
export function useFriendCategoryMembers() {
  const { session } = useSession();
  return useQuery({
    queryKey: MEMBERS_KEY,
    enabled: !!session,
    queryFn: async (): Promise<Map<string, string>> => {
      const { data, error } = await supabase.from('friend_category_members').select('friend_user_id, category_id');
      if (error) throw error;
      return new Map((data ?? []).map((row) => [row.friend_user_id, row.category_id]));
    },
  });
}

/** Nombre d'habitations partagées avec chaque ami, dans les deux sens. */
export function useFriendSharedHabitationCounts() {
  const { session } = useSession();
  return useQuery({
    queryKey: COUNTS_KEY,
    enabled: !!session,
    queryFn: async (): Promise<Map<string, number>> => {
      const { data, error } = await supabase.rpc('friend_shared_habitation_counts');
      if (error) throw error;
      return new Map((data ?? []).map((row) => [row.friend_user_id, Number(row.habitation_count)]));
    },
  });
}

export function useCreateFriendCategory() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string): Promise<FriendCategory> => {
      // Nouvelle catégorie en fin de liste : elle se range où on l'attend,
      // et non en tête là où elle bousculerait l'ordre déjà choisi.
      const { data: existing, error: countError } = await supabase
        .from('friend_categories')
        .select('position')
        .order('position', { ascending: false })
        .limit(1);
      if (countError) throw countError;

      const position = (existing?.[0]?.position ?? -1) + 1;
      const { data, error } = await supabase
        .from('friend_categories')
        .insert({ owner_id: session!.user.id, name, position })
        .select('id, name, position')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CATEGORIES_KEY }),
  });
}

export function useRenameFriendCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; name: string }) => {
      const { error } = await supabase.from('friend_categories').update({ name: input.name }).eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CATEGORIES_KEY }),
  });
}

export function useDeleteFriendCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('friend_categories').delete().eq('id', id);
      if (error) throw error;
    },
    // Les affectations partent avec la catégorie (on delete cascade), donc
    // la liste des membres est perimée elle aussi.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATEGORIES_KEY });
      queryClient.invalidateQueries({ queryKey: MEMBERS_KEY });
    },
  });
}

/**
 * Range un ami dans une catégorie, ou l'en sort (`categoryId: null`).
 *
 * Un `upsert` sur la clé primaire (owner_id, friend_user_id) plutôt qu'un
 * delete suivi d'un insert : c'est la base qui garantit qu'un ami n'est
 * jamais dans deux catégories, y compris si deux appareils écrivent en même
 * temps.
 */
export function useMoveFriendToCategory() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { friendUserId: string; categoryId: string | null }) => {
      const ownerId = session!.user.id;

      if (input.categoryId === null) {
        const { error } = await supabase
          .from('friend_category_members')
          .delete()
          .eq('owner_id', ownerId)
          .eq('friend_user_id', input.friendUserId);
        if (error) throw error;
        return;
      }

      const { error } = await supabase.from('friend_category_members').upsert(
        { owner_id: ownerId, friend_user_id: input.friendUserId, category_id: input.categoryId },
        { onConflict: 'owner_id,friend_user_id' },
      );
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MEMBERS_KEY }),
  });
}

export type FriendSection = {
  /** `null` pour la section « Sans catégorie », qui n'est pas une catégorie. */
  category: FriendCategory | null;
  friends: FriendshipEntry[];
};

/**
 * Répartit les amis acceptés en sections, dans l'ordre des catégories.
 *
 * Les catégories VIDES restent affichées : elles viennent d'être créées, et
 * les faire disparaître ferait croire que la création a échoué. « Sans
 * catégorie », elle, ne s'affiche que si elle contient quelqu'un — c'est
 * l'absence de rangement, pas un rangement.
 */
export function buildFriendSections(
  friends: FriendshipEntry[],
  categories: FriendCategory[],
  membership: Map<string, string>,
): FriendSection[] {
  const byName = (a: FriendshipEntry, b: FriendshipEntry) =>
    (a.otherDisplayName || a.otherFriendCode).localeCompare(b.otherDisplayName || b.otherFriendCode);

  const sections: FriendSection[] = categories.map((category) => ({
    category,
    friends: friends.filter((f) => membership.get(f.otherUserId) === category.id).sort(byName),
  }));

  // Un ami dont la catégorie n'existe plus (supprimée sur un autre appareil,
  // cache pas encore rafraîchi) retombe ici plutôt que de disparaître.
  const known = new Set(categories.map((c) => c.id));
  const unfiled = friends
    .filter((f) => {
      const categoryId = membership.get(f.otherUserId);
      return !categoryId || !known.has(categoryId);
    })
    .sort(byName);

  if (unfiled.length > 0) sections.push({ category: null, friends: unfiled });

  return sections;
}
