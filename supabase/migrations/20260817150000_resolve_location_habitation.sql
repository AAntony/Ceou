-- Phase 8b — expose côté client la résolution "id d'Emplacement/Conteneur
-- -> habitation_id" déjà utilisée en interne par la RLS (emplacement_
-- habitation/conteneur_habitation, sharing_rls.sql) : ContainerContents
-- (écran partagé Emplacement/Conteneur) ne connaît que parentType/parentId,
-- pas l'Habitation — nécessaire pour résoudre le droit effectif de
-- l'utilisateur et masquer les boutons d'ajout/édition en Consultation.
create function public.resolve_location_habitation(p_type text, p_id uuid)
returns uuid
language sql stable security definer set search_path = public as $$
  select case p_type
    when 'emplacement' then public.emplacement_habitation(p_id)
    when 'conteneur' then public.conteneur_habitation(p_id)
  end
$$;
