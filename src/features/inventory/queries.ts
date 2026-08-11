import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '../../features/auth/SessionProvider';
import { supabase } from '../../lib/supabase/client';
import type { Conteneur, Emplacement, Habitation, LocationType, Objet, ObjetDeplacement, Piece } from '../../types/database';
import { isSingleSpaceHabitation } from './constants';

// === Habitations =====================================================

export function useHabitations() {
  const { session } = useSession();
  return useQuery({
    queryKey: ['habitations'],
    enabled: !!session,
    queryFn: async (): Promise<Habitation[]> => {
      const { data, error } = await supabase.from('habitations').select('*').order('created_at');
      if (error) throw error;
      return data;
    },
  });
}

export function useHabitation(id: string) {
  return useQuery({
    queryKey: ['habitation', id],
    queryFn: async (): Promise<Habitation> => {
      const { data, error } = await supabase.from('habitations').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateHabitation() {
  const { session } = useSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { name: string; type: string; icon: string }): Promise<Habitation> => {
      const { data: habitation, error } = await supabase
        .from('habitations')
        .insert({ user_id: session!.user.id, name: input.name, type: input.type, icon: input.icon })
        .select()
        .single();
      if (error) throw error;

      if (isSingleSpaceHabitation(input.type)) {
        const { error: pieceError } = await supabase
          .from('pieces')
          .insert({ habitation_id: habitation.id, name: input.name, is_default: true });
        if (pieceError) throw pieceError;
      }

      return habitation;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['habitations'] }),
  });
}

export function useDeleteHabitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('habitations').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['habitations'] }),
  });
}

// === Pièces ===========================================================

export function usePieces(habitationId: string) {
  return useQuery({
    queryKey: ['pieces', habitationId],
    queryFn: async (): Promise<Piece[]> => {
      const { data, error } = await supabase
        .from('pieces')
        .select('*')
        .eq('habitation_id', habitationId)
        .order('created_at');
      if (error) throw error;
      return data;
    },
  });
}

export function usePiece(id: string) {
  return useQuery({
    queryKey: ['piece', id],
    queryFn: async (): Promise<Piece> => {
      const { data, error } = await supabase.from('pieces').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },
  });
}

export function useCreatePiece(habitationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string): Promise<Piece> => {
      const { data, error } = await supabase
        .from('pieces')
        .insert({ habitation_id: habitationId, name })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pieces', habitationId] }),
  });
}

export function useDeletePiece(habitationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('pieces').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pieces', habitationId] }),
  });
}

// === Emplacements ======================================================

export function useEmplacements(pieceId: string) {
  return useQuery({
    queryKey: ['emplacements', pieceId],
    enabled: !!pieceId,
    queryFn: async (): Promise<Emplacement[]> => {
      const { data, error } = await supabase.from('emplacements').select('*').eq('piece_id', pieceId).order('created_at');
      if (error) throw error;
      return data;
    },
  });
}

export function useEmplacement(id: string) {
  return useQuery({
    queryKey: ['emplacement', id],
    queryFn: async (): Promise<Emplacement> => {
      const { data, error } = await supabase.from('emplacements').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateEmplacement(pieceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; presetKey: string | null }): Promise<Emplacement> => {
      const { data, error } = await supabase
        .from('emplacements')
        .insert({ piece_id: pieceId, name: input.name, preset_key: input.presetKey })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['emplacements', pieceId] }),
  });
}

export function useDeleteEmplacement(pieceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('emplacements').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['emplacements', pieceId] }),
  });
}

// === Conteneurs + Objets (contenu d'un Emplacement ou d'un Conteneur) ===

const PARENT_COLUMN: Record<LocationType, 'parent_emplacement_id' | 'parent_conteneur_id'> = {
  emplacement: 'parent_emplacement_id',
  conteneur: 'parent_conteneur_id',
};

export function useContainerContents(parentType: LocationType, parentId: string) {
  const column = PARENT_COLUMN[parentType];

  const conteneursQuery = useQuery({
    queryKey: ['containerContents', 'conteneurs', parentType, parentId],
    enabled: !!parentId,
    queryFn: async (): Promise<Conteneur[]> => {
      const { data, error } = await supabase.from('conteneurs').select('*').eq(column, parentId).order('created_at');
      if (error) throw error;
      return data;
    },
  });

  const objetsQuery = useQuery({
    queryKey: ['containerContents', 'objets', parentType, parentId],
    enabled: !!parentId,
    queryFn: async (): Promise<Objet[]> => {
      const { data, error } = await supabase.from('objets').select('*').eq(column, parentId).order('created_at');
      if (error) throw error;
      return data;
    },
  });

  return {
    conteneurs: conteneursQuery.data ?? [],
    objets: objetsQuery.data ?? [],
    isLoading: conteneursQuery.isLoading || objetsQuery.isLoading,
  };
}

function invalidateContainerContents(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['containerContents'] });
}

export function useConteneur(id: string) {
  return useQuery({
    queryKey: ['conteneur', id],
    queryFn: async (): Promise<Conteneur> => {
      const { data, error } = await supabase.from('conteneurs').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateConteneur(parentType: LocationType, parentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string): Promise<Conteneur> => {
      const { data, error } = await supabase
        .from('conteneurs')
        .insert({
          name,
          parent_emplacement_id: parentType === 'emplacement' ? parentId : null,
          parent_conteneur_id: parentType === 'conteneur' ? parentId : null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidateContainerContents(queryClient),
  });
}

export function useDeleteConteneur() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('conteneurs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidateContainerContents(queryClient),
  });
}

// === Objets ============================================================

export function useObjet(id: string) {
  return useQuery({
    queryKey: ['objet', id],
    queryFn: async (): Promise<Objet> => {
      const { data, error } = await supabase.from('objets').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateObjet(parentType: LocationType, parentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { name: string; description: string | null; photoUrl: string | null }): Promise<Objet> => {
      const { data, error } = await supabase
        .from('objets')
        .insert({
          name: input.name,
          description: input.description,
          photo_url: input.photoUrl,
          parent_emplacement_id: parentType === 'emplacement' ? parentId : null,
          parent_conteneur_id: parentType === 'conteneur' ? parentId : null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidateContainerContents(queryClient),
  });
}

export function useUpdateObjet(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Pick<Objet, 'name' | 'description' | 'photo_url'>>) => {
      const { error } = await supabase.from('objets').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['objet', id] }),
  });
}

export function useDeleteObjet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('objets').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidateContainerContents(queryClient),
  });
}

export function useObjetHistory(objetId: string) {
  return useQuery({
    queryKey: ['objetHistory', objetId],
    queryFn: async (): Promise<ObjetDeplacement[]> => {
      const { data, error } = await supabase
        .from('objet_deplacements')
        .select('*')
        .eq('objet_id', objetId)
        .order('moved_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useMoveObjet(objetId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (destination: { type: LocationType; id: string }) => {
      const { error } = await supabase.rpc('move_objet', {
        p_objet_id: objetId,
        p_to_type: destination.type,
        p_to_id: destination.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objet', objetId] });
      queryClient.invalidateQueries({ queryKey: ['objetHistory', objetId] });
      invalidateContainerContents(queryClient);
    },
  });
}
