import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase/client';
import type { Plan, PlanForme, PlanPin } from '../../types/database';
import { CANVAS_WIDTH, DEFAULT_SHAPE_SIZE, type PlanShapeType } from './constants';

export function usePlans(habitationId: string) {
  return useQuery({
    queryKey: ['plans', habitationId],
    queryFn: async (): Promise<Plan[]> => {
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('habitation_id', habitationId)
        .order('floor_order');
      if (error) throw error;
      return data;
    },
  });
}

export function usePlan(id: string) {
  return useQuery({
    queryKey: ['plan', id],
    queryFn: async (): Promise<Plan> => {
      const { data, error } = await supabase.from('plans').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },
  });
}

export function useCreatePlan(habitationId: string) {
  const queryClient = useQueryClient();
  const { data: existing } = usePlans(habitationId);

  return useMutation({
    mutationFn: async (name: string): Promise<Plan> => {
      const floorOrder = existing?.length ?? 0;
      const { data, error } = await supabase
        .from('plans')
        .insert({ habitation_id: habitationId, name, floor_order: floorOrder })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plans', habitationId] }),
  });
}

export function useUpdatePlan(habitationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; name: string }) => {
      const { error } = await supabase.from('plans').update({ name: input.name }).eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plans', habitationId] }),
  });
}

export function useDeletePlan(habitationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('plans').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plans', habitationId] }),
  });
}

export function usePlanFormes(planId: string) {
  return useQuery({
    queryKey: ['planFormes', planId],
    queryFn: async (): Promise<PlanForme[]> => {
      const { data, error } = await supabase.from('plan_formes').select('*').eq('plan_id', planId).order('created_at');
      if (error) throw error;
      return data;
    },
  });
}

export function useCreatePlanForme(planId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (shapeType: PlanShapeType): Promise<PlanForme> => {
      const { data, error } = await supabase
        .from('plan_formes')
        .insert({
          plan_id: planId,
          shape_type: shapeType,
          x: CANVAS_WIDTH / 2 - DEFAULT_SHAPE_SIZE / 2,
          y: 40,
          width: DEFAULT_SHAPE_SIZE,
          height: DEFAULT_SHAPE_SIZE,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['planFormes', planId] }),
  });
}

export function useUpdatePlanForme(planId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      pieceId?: string | null;
    }) => {
      const { id, ...patch } = input;
      const { error } = await supabase
        .from('plan_formes')
        .update({
          ...(patch.x !== undefined && { x: patch.x }),
          ...(patch.y !== undefined && { y: patch.y }),
          ...(patch.width !== undefined && { width: patch.width }),
          ...(patch.height !== undefined && { height: patch.height }),
          ...(patch.pieceId !== undefined && { piece_id: patch.pieceId }),
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: ['planFormes', planId] });
      // pieceId change affects whether the objet page's "Voir sur le plan"
      // link exists at all — bust broadly rather than tracking which piece
      // lost/gained the association (both the old and new one could change).
      if (input.pieceId !== undefined) queryClient.invalidateQueries({ queryKey: ['pieceLocationOnPlan'] });
    },
  });
}

export type PieceLocationOnPlan = { planId: string; formeId: string };

// Utilisé depuis la fiche Objet ("Voir sur le plan") pour savoir si la pièce
// de l'objet a déjà été placée sur un plan, et sur lequel — une pièce n'a
// normalement qu'une forme associée au plus, on prend la première.
export function usePieceLocationOnPlan(pieceId: string) {
  return useQuery({
    queryKey: ['pieceLocationOnPlan', pieceId],
    enabled: !!pieceId,
    queryFn: async (): Promise<PieceLocationOnPlan | null> => {
      const { data, error } = await supabase
        .from('plan_formes')
        .select('id, plan_id')
        .eq('piece_id', pieceId)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ? { planId: data.plan_id, formeId: data.id } : null;
    },
  });
}

export function useDeletePlanForme(planId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('plan_formes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['planFormes', planId] }),
  });
}

export function usePlanPins(planId: string) {
  return useQuery({
    queryKey: ['planPins', planId],
    queryFn: async (): Promise<PlanPin[]> => {
      const { data, error } = await supabase.from('plan_pins').select('*').eq('plan_id', planId);
      if (error) throw error;
      return data;
    },
  });
}

export function useCreatePlanPin(planId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { formeId: string; emplacementId: string }): Promise<PlanPin> => {
      const { data, error } = await supabase
        .from('plan_pins')
        .insert({ plan_id: planId, forme_id: input.formeId, emplacement_id: input.emplacementId, rel_x: 0.5, rel_y: 0.5 })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['planPins', planId] }),
  });
}

export function useUpdatePlanPin(planId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; relX: number; relY: number }) => {
      const { error } = await supabase.from('plan_pins').update({ rel_x: input.relX, rel_y: input.relY }).eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['planPins', planId] }),
  });
}

export function useDeletePlanPin(planId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('plan_pins').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['planPins', planId] }),
  });
}
