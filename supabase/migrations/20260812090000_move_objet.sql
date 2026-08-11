-- Déplacement atomique d'un Objet : met à jour son parent ET journalise le
-- déplacement dans le même appel, pour ne jamais se retrouver avec l'un
-- des deux écrits sans l'autre. security invoker (défaut) : les policies
-- RLS existantes sur objets/objet_deplacements s'appliquent normalement à
-- l'utilisateur appelant, aucun privilège élevé nécessaire ici.
create function public.move_objet(p_objet_id uuid, p_to_type text, p_to_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_from_type text;
  v_from_id uuid;
  v_from_label text;
  v_to_label text;
begin
  select
    case when parent_emplacement_id is not null then 'emplacement' else 'conteneur' end,
    coalesce(parent_emplacement_id, parent_conteneur_id)
  into v_from_type, v_from_id
  from public.objets
  where id = p_objet_id;

  if v_from_id is null then
    raise exception 'objet % not found', p_objet_id;
  end if;

  if v_from_type = 'emplacement' then
    select name into v_from_label from public.emplacements where id = v_from_id;
  else
    select name into v_from_label from public.conteneurs where id = v_from_id;
  end if;

  if p_to_type = 'emplacement' then
    select name into v_to_label from public.emplacements where id = p_to_id;
  elsif p_to_type = 'conteneur' then
    select name into v_to_label from public.conteneurs where id = p_to_id;
  else
    raise exception 'invalid p_to_type: %', p_to_type;
  end if;

  if v_to_label is null then
    raise exception 'destination % % not found', p_to_type, p_to_id;
  end if;

  update public.objets
  set
    parent_emplacement_id = case when p_to_type = 'emplacement' then p_to_id else null end,
    parent_conteneur_id = case when p_to_type = 'conteneur' then p_to_id else null end
  where id = p_objet_id;

  insert into public.objet_deplacements (
    objet_id, from_location_type, from_location_id, from_location_label,
    to_location_type, to_location_id, to_location_label
  ) values (
    p_objet_id, v_from_type, v_from_id, v_from_label,
    p_to_type, p_to_id, v_to_label
  );
end;
$$;

-- === stockage : photos d'objets ====================================
-- Même pattern que le bucket avatars (lecture publique, chemin préfixé par
-- l'uid pour l'écriture) : simplicité/perf pour le MVP plutôt que des URLs
-- signées, à durcir plus tard si besoin d'une vraie confidentialité.

insert into storage.buckets (id, name, public)
values ('objets', 'objets', true)
on conflict (id) do nothing;

create policy "objets_photo_public_read" on storage.objects
  for select using (bucket_id = 'objets');

create policy "objets_photo_owner_write" on storage.objects
  for insert with check (bucket_id = 'objets' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "objets_photo_owner_update" on storage.objects
  for update using (bucket_id = 'objets' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "objets_photo_owner_delete" on storage.objects
  for delete using (bucket_id = 'objets' and (storage.foldername(name))[1] = auth.uid()::text);
