import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteRow, selectMany, selectOne } from '../../lib/supabase/crud';
import { supabase } from '../../lib/supabase/client';
import { nextPinSlot } from './pinSlots';
import { clampPositionToWorld } from './snap';
import type { Plan, PlanDoor, PlanForme, PlanPin } from '../../types/database';
import type { DoorEdge } from './types';
import { DEFAULT_SHAPE_SIZE, WORLD_HEIGHT, WORLD_WIDTH, type PlanShapeType } from './constants';

export function usePlans(habitationId: string) {
  return useQuery({
    queryKey: ['plans', habitationId],
    queryFn: () => selectMany<Plan>('plans', { column: 'habitation_id', value: habitationId }, 'floor_order'),
  });
}

export function usePlan(id: string) {
  return useQuery({
    queryKey: ['plan', id],
    queryFn: () => selectOne<Plan>('plans', id),
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

// L'ORDRE DES NIVEAUX, tel qu'il apparaît dans la liste ET dans le sélecteur
// d'étage posé sur le plan : le même, de haut en bas. C'est la personne qui
// décide si son grenier est en tête ou en queue.
//
// RENUMÉROTE TOUT plutôt que d'échanger deux valeurs. `floor_order` était
// jusqu'ici l'indice de création (`existing.length`), ce qui laisse des trous
// et des doublons dès qu'un plan est supprimé puis un autre créé — deux plans
// à 2, et leur ordre devient celui que la base voudra. Réécrire la série
// complète à chaque déplacement remet d'aplomb ce qui l'était mal, sans
// migration ni réparation séparée.
export function useReorderPlans(habitationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      await Promise.all(
        orderedIds.map((id, index) =>
          supabase
            .from('plans')
            .update({ floor_order: index })
            .eq('id', id)
            .then(({ error }) => {
              if (error) throw error;
            }),
        ),
      );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plans', habitationId] }),
  });
}

export function useDeletePlan(habitationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteRow('plans', id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plans', habitationId] }),
  });
}

export function usePlanFormes(planId: string) {
  return useQuery({
    queryKey: ['planFormes', planId],
    queryFn: () => selectMany<PlanForme>('plan_formes', { column: 'plan_id', value: planId }, 'created_at'),
  });
}

export function useCreatePlanForme(planId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    // `center` = point du monde actuellement visible au centre du viewport
    // (voir PlanCanvas.getViewportCenter, via le ref exposé dans
    // plan/[id].tsx) — sans ça, une nouvelle pièce apparaissait toujours au
    // même endroit fixe de la feuille, invisible si l'utilisateur avait
    // zoomé/déplacé la vue ailleurs sur un grand plan. Repli sur le centre
    // de la feuille si le ref n'est pas encore prêt (cas limite).
    mutationFn: async (input: { shapeType: PlanShapeType; center?: { x: number; y: number } }): Promise<PlanForme> => {
      const centerX = input.center?.x ?? WORLD_WIDTH / 2;
      const centerY = input.center?.y ?? WORLD_HEIGHT / 2;
      const { x, y } = clampPositionToWorld(
        centerX - DEFAULT_SHAPE_SIZE / 2,
        centerY - DEFAULT_SHAPE_SIZE / 2,
        DEFAULT_SHAPE_SIZE,
        DEFAULT_SHAPE_SIZE,
      );
      const { data, error } = await supabase
        .from('plan_formes')
        .insert({ plan_id: planId, shape_type: input.shapeType, x, y, width: DEFAULT_SHAPE_SIZE, height: DEFAULT_SHAPE_SIZE })
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
    // Exemptée du rafraîchissement global (cf. src/lib/queryClient.ts) : un
    // arrangement de plan émet une mutation par forme relâchée, et une
    // géométrie ne change rien ailleurs dans l'app.
    meta: { skipGlobalRefresh: true },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: ['planFormes', planId] });
      // Associer une pièce à une forme, en revanche, se voit ailleurs (le
      // lien « Voir sur le plan » d'une fiche objet apparaît ou disparaît) :
      // ce cas-là repasse par la règle générale.
      if (input.pieceId !== undefined) queryClient.invalidateQueries();
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

// Une pièce de départ un peu plus grande que celle qu'on ajoute à la main
// (DEFAULT_SHAPE_SIZE, 80×80) : elle est SEULE sur la feuille, et elle doit
// accueillir tout de suite une puce d'Emplacement sans que les deux se
// marchent dessus. Proportions d'une pièce des gabarits (voir templates.ts).
const STARTER_ROOM_WIDTH = 220;
const STARTER_ROOM_HEIGHT = 180;

export type StarterPlan = { planId: string; formeId: string };

/**
 * Pose d'un seul geste le plan minimal qui rend « Voir sur le plan » utile :
 * un plan, la Pièce dessinée dessus, et la puce de l'Emplacement dedans.
 *
 * Sert au guide de démarrage. Le plan est le dernier maillon du cycle qu'il
 * enseigne (chercher → la fiche → le plan), mais c'est aussi le seul qui
 * demande normalement de dessiner : demander ça à quelqu'un qui découvre
 * l'app le perdrait juste avant la récompense. Le guide le fait donc pour
 * elle, et lui laisse le geste qui compte — appuyer sur « Voir sur le plan ».
 *
 * TOUT EST RÉUTILISÉ SI ÇA EXISTE DÉJÀ, et ce n'est pas une politesse : le
 * guide se rejoue depuis le Profil, sur un inventaire parfois complet. Une
 * deuxième forme pour la même Pièce rendrait « Voir sur le plan » ambigu
 * (il prend la première), et une deuxième puce pour le même Emplacement
 * serait carrément refusée par la base — plan_pins porte une contrainte
 * d'unicité sur emplacement_id.
 */
export function useCreateStarterPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      habitationId: string;
      pieceId: string;
      emplacementId: string;
      /** Nom du plan s'il faut en créer un. */
      name: string;
    }): Promise<StarterPlan> => {
      // 1. La pièce est-elle déjà dessinée quelque part ? Si oui c'est CE
      // plan-là qu'il faut ouvrir, pas un nouveau.
      const { data: existingForme, error: formeLookupError } = await supabase
        .from('plan_formes')
        .select('id, plan_id')
        .eq('piece_id', input.pieceId)
        .limit(1)
        .maybeSingle();
      if (formeLookupError) throw formeLookupError;

      let planId = existingForme?.plan_id ?? null;
      let formeId = existingForme?.id ?? null;

      if (!planId) {
        const { data: plans, error: plansError } = await supabase
          .from('plans')
          .select('id')
          .eq('habitation_id', input.habitationId)
          .order('floor_order');
        if (plansError) throw plansError;

        if (plans && plans.length > 0) {
          planId = plans[0].id;
        } else {
          const { data: plan, error: planError } = await supabase
            .from('plans')
            .insert({ habitation_id: input.habitationId, name: input.name, floor_order: 0 })
            .select()
            .single();
          if (planError) throw planError;
          planId = plan.id;
        }
      }

      if (!formeId) {
        const { x, y } = clampPositionToWorld(
          WORLD_WIDTH / 2 - STARTER_ROOM_WIDTH / 2,
          WORLD_HEIGHT / 2 - STARTER_ROOM_HEIGHT / 2,
          STARTER_ROOM_WIDTH,
          STARTER_ROOM_HEIGHT,
        );
        const { data: forme, error: formeError } = await supabase
          .from('plan_formes')
          .insert({
            plan_id: planId,
            shape_type: 'rectangle',
            piece_id: input.pieceId,
            x,
            y,
            width: STARTER_ROOM_WIDTH,
            height: STARTER_ROOM_HEIGHT,
          })
          .select()
          .single();
        if (formeError) throw formeError;
        formeId = forme.id;
      }

      // 2. La puce de l'Emplacement. Absente, elle est posée sur le premier
      // créneau libre de la pièce plutôt qu'en son centre, où elle
      // recouvrirait le nom.
      const { data: existingPin, error: pinLookupError } = await supabase
        .from('plan_pins')
        .select('id')
        .eq('emplacement_id', input.emplacementId)
        .limit(1)
        .maybeSingle();
      if (pinLookupError) throw pinLookupError;

      if (!existingPin) {
        const { data: siblings, error: siblingsError } = await supabase
          .from('plan_pins')
          .select('id')
          .eq('forme_id', formeId);
        if (siblingsError) throw siblingsError;

        const slot = nextPinSlot(siblings?.length ?? 0);
        const { error: pinError } = await supabase.from('plan_pins').insert({
          plan_id: planId,
          forme_id: formeId,
          emplacement_id: input.emplacementId,
          rel_x: slot.relX,
          rel_y: slot.relY,
        });
        if (pinError) throw pinError;
      }

      return { planId, formeId };
    },
    // Large à dessein : ce seul geste crée un plan, une forme et une puce, et
    // fait apparaître le lien « Voir sur le plan » sur les fiches objet de
    // toute la pièce.
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

export function useDeletePlanForme(planId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteRow('plan_formes', id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['planFormes', planId] }),
  });
}

export function usePlanPins(planId: string) {
  return useQuery({
    queryKey: ['planPins', planId],
    queryFn: () => selectMany<PlanPin>('plan_pins', { column: 'plan_id', value: planId }),
  });
}

export function useCreatePlanPin(planId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    // relX/relY viennent de l'appelant (nextPinSlot) : sans ça toutes les
    // puces d'une même pièce atterrissaient au même point, empilées les unes
    // sur les autres et sur le nom de la pièce.
    mutationFn: async (input: { formeId: string; emplacementId: string; relX: number; relY: number }): Promise<PlanPin> => {
      const { data, error } = await supabase
        .from('plan_pins')
        .insert({
          plan_id: planId,
          forme_id: input.formeId,
          emplacement_id: input.emplacementId,
          rel_x: input.relX,
          rel_y: input.relY,
        })
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
    // Même raison que useUpdatePlanForme : une pastille qu'on déplace dans sa
    // pièce n'a de sens que sur ce plan.
    meta: { skipGlobalRefresh: true },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['planPins', planId] }),
  });
}

export function useDeletePlanPin(planId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteRow('plan_pins', id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['planPins', planId] }),
  });
}


// Nombre d'objets par Pièce, pour l'afficher sur le plan.
//
// Une seule requête pour toute l'habitation, pas une par pièce : le plan les
// affiche toutes en même temps. Voir la migration piece_object_counts, qui
// remonte aussi les objets rangés dans des conteneurs imbriqués.
export function usePieceObjectCounts(habitationId: string | undefined) {
  return useQuery({
    queryKey: ['pieceObjectCounts', habitationId],
    enabled: !!habitationId,
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase.rpc('piece_object_counts', { p_habitation_id: habitationId as string });
      if (error) throw error;
      const rows = (data ?? []) as { piece_id: string; objet_count: number }[];
      return Object.fromEntries(rows.map((row) => [row.piece_id, Number(row.objet_count)]));
    },
  });
}

/**
 * Forme exacte attendue par apply_plan_template.
 *
 * Typée précisément, et non Record<string, unknown> : le paramètre p_rooms
 * des types générés est un `Json`, auquel `unknown` n'est pas assignable.
 */
type TemplateRoomPayload = {
  name: string;
  preset_key: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

// Applique un départ de plan (voir templates.ts et la migration
// apply_plan_template). Une seule requête : créer les Pièces manquantes puis
// poser les formes doit réussir ou échouer d'un bloc, sinon un échec réseau à
// mi-parcours laisserait un plan à moitié posé.
export function useApplyPlanTemplate(planId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (rooms: TemplateRoomPayload[]): Promise<void> => {
      const { error } = await supabase.rpc('apply_plan_template', { p_plan_id: planId, p_rooms: rooms });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planFormes', planId] });
      // Le départ crée des Pièces : les écrans d'inventaire doivent les voir.
      queryClient.invalidateQueries({ queryKey: ['pieces'] });
      queryClient.invalidateQueries({ queryKey: ['searchIndex'] });
    },
  });
}

// === Portes ===============================================================
// Une porte est une interruption du mur, pas un objet posé dessus (cf. la
// migration 20260823170000). Les hooks sont calqués sur ceux des pastilles :
// même cycle de vie, même clé par plan.

export function usePlanDoors(planId: string) {
  return useQuery({
    queryKey: ['planDoors', planId],
    queryFn: () => selectMany<PlanDoor>('plan_doors', { column: 'plan_id', value: planId }),
  });
}

export function useCreatePlanDoor(planId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { formeId: string; edge: DoorEdge; position: number }): Promise<PlanDoor> => {
      const { data, error } = await supabase
        .from('plan_doors')
        .insert({ plan_id: planId, forme_id: input.formeId, edge: input.edge, position: input.position })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['planDoors', planId] }),
  });
}

export function useUpdatePlanDoor(planId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; edge: DoorEdge; position: number }) => {
      const { error } = await supabase.from('plan_doors').update({ edge: input.edge, position: input.position }).eq('id', input.id);
      if (error) throw error;
    },
    // Glisser une porte le long de son mur ne change rien hors de ce plan.
    meta: { skipGlobalRefresh: true },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['planDoors', planId] }),
  });
}

export function useDeletePlanDoor(planId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteRow('plan_doors', id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['planDoors', planId] }),
  });
}
