-- A filled box may be removed only after an explicit choice about its contents.
-- Recovery storage belongs to the source home and survives the moving project.
alter table public.moving_projects add column recovery_location_id uuid
  references public.emplacements(id) on delete set null;

create function public.moving_recovery_location(p_project_id uuid, p_name text) returns uuid
language plpgsql security invoker set search_path = public as $$
declare m moving_projects; v_location uuid; v_piece uuid;
begin
  select * into m from moving_projects where id=p_project_id for update;
  if not coalesce(has_habitation_access(m.source_id,auth.uid(),'modification'),false) then
    raise exception 'moving_forbidden';
  end if;
  select e.id into v_location from emplacements e join pieces p on p.id=e.piece_id
    where e.id=m.recovery_location_id and p.habitation_id=m.source_id for share of e,p;
  if v_location is null then
    insert into pieces(habitation_id,name) values(m.source_id,p_name) returning id into v_piece;
    insert into emplacements(piece_id,name) values(v_piece,p_name) returning id into v_location;
    update moving_projects set recovery_location_id=v_location where id=m.id;
  end if;
  return v_location;
end $$;
revoke all on function public.moving_recovery_location(uuid,text) from public, anon, authenticated;

-- Internal helper: moving_manage is the authenticated entry point.
create function public.moving_delete_box(p_project_id uuid, p_box_id uuid, p_contents text, p_recovery_name text)
returns void language plpgsql security invoker set search_path = public as $$
declare
  m moving_projects; b moving_boxes; o objets; i moving_items;
  v_container uuid; v_children uuid[]; v_containers uuid[]; v_level uuid[];
  v_origin_type text; v_origin_id uuid; v_origin_home uuid; v_recovery uuid;
begin
  select * into m from moving_projects where id=p_project_id for update;
  if auth.uid() is null or not moving_access(m.id,'modification') then raise exception 'moving_forbidden'; end if;
  if p_contents is null or p_contents not in ('restore','trash','keep')
    or p_recovery_name is null or length(btrim(p_recovery_name)) not between 1 and 160 then
    raise exception 'moving_invalid';
  end if;
  select * into b from moving_boxes where id=p_box_id and project_id=m.id and deleted_at is null for update;
  if b.id is null then raise exception 'moving_box_missing'; end if;

  -- A permanent storage container is only detached from the moving history.
  if b.status='stored' then
    if p_contents<>'keep' then raise exception 'moving_box_stored'; end if;
    update moving_boxes set deleted_at=now(),container_id=null where id=b.id;
    return;
  end if;
  if p_contents='keep' then raise exception 'moving_invalid'; end if;
  if b.container_id is null then
    update moving_boxes set deleted_at=now() where id=b.id;
    return;
  end if;

  perform id from conteneurs where id=b.container_id for update;
  if not coalesce(has_habitation_access((select location_habitation(parent_emplacement_id,parent_conteneur_id)
    from conteneurs where id=b.container_id),auth.uid(),'modification'),false) then
    raise exception 'moving_forbidden';
  end if;

  -- Lock parents before discovering children. Foreign-key inserts cannot slip
  -- into the tree between the snapshot and the cascading delete.
  v_containers:=array[b.container_id]; v_level:=v_containers;
  while cardinality(v_level)>0 loop
    v_children:='{}';
    for v_container in select id from conteneurs where parent_conteneur_id=any(v_level)
      and not(id=any(v_containers)) order by id for update loop
      v_children:=array_append(v_children,v_container);
    end loop;
    v_containers:=v_containers||v_children; v_level:=v_children;
  end loop;
  if exists(select 1 from moving_boxes where container_id=any(v_containers) and id<>b.id and deleted_at is null) then
    raise exception 'moving_nested_box';
  end if;
  perform id from objets where parent_conteneur_id=any(v_containers) order by id for update;

  if p_contents='trash' then
    -- One snapshot includes nested containers, photos and invoice links.
    perform corbeille_deposer('conteneur',b.container_id);
    update moving_items set outcome='removed',resolved_at=now()
      where object_id in (select id from objets where parent_conteneur_id=any(v_containers))
      and project_id=m.id;
  else
    for o in select * from objets where parent_conteneur_id=b.container_id order by id loop
      select * into i from moving_items where project_id=m.id and object_id=o.id;
      v_origin_type:=i.origin_type; v_origin_id:=null; v_origin_home:=null;
      if v_origin_type='emplacement' then
        select id into v_origin_id from emplacements where id=i.origin_id for share;
        v_origin_home:=location_habitation(v_origin_id,null);
      elsif v_origin_type='conteneur' and not(i.origin_id=any(v_containers)) then
        select id into v_origin_id from conteneurs where id=i.origin_id for share;
        v_origin_home:=location_habitation(null,v_origin_id);
        -- Returning to another temporary box would keep an invisible packing task.
        if exists(with recursive ancestors as (
          select id,parent_conteneur_id from conteneurs where id=v_origin_id
          union select c.id,c.parent_conteneur_id from conteneurs c join ancestors a on c.id=a.parent_conteneur_id
        ) select 1 from ancestors a join moving_boxes x on x.container_id=a.id
          where x.deleted_at is null and x.status<>'stored') then
          v_origin_id:=null;
        end if;
      end if;
      -- New objects, deleted origins and revoked access all preserve the object
      -- in a visible recovery location, never in a soon-to-be-deleted box.
      if v_origin_id is null or not coalesce(has_habitation_access(v_origin_home,auth.uid(),'modification'),false) then
        if v_recovery is null then v_recovery:=moving_recovery_location(m.id,p_recovery_name); end if;
        v_origin_type:='emplacement'; v_origin_id:=v_recovery;
      end if;
      perform move_objet(o.id,v_origin_type,v_origin_id);
      update moving_items set outcome='removed',resolved_at=now() where project_id=m.id and object_id=o.id;
    end loop;
    -- Containers do not have an origin history. Preserve their entire hierarchy.
    if exists(select 1 from conteneurs where parent_conteneur_id=b.container_id) then
      if v_recovery is null then v_recovery:=moving_recovery_location(m.id,p_recovery_name); end if;
      update conteneurs set parent_emplacement_id=v_recovery,parent_conteneur_id=null where parent_conteneur_id=b.container_id;
      update moving_items set outcome='removed',resolved_at=now() where project_id=m.id and outcome in ('packed','stored')
        and object_id in (select id from objets where parent_conteneur_id=any(v_containers));
    end if;
  end if;
  delete from conteneurs where id=b.container_id;
  update moving_boxes set deleted_at=now(),container_id=null where id=b.id;
end $$;
revoke all on function public.moving_delete_box(uuid,uuid,text,text) from public, anon, authenticated;

create or replace function public.moving_manage(p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m moving_projects; b moving_boxes; recipient uuid; recipients uuid[]; v_name text;
begin
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'moving_forbidden'; end if;
 select * into m from moving_projects where id=(p_payload->>'project_id')::uuid for update;
 if m.id is null or not moving_access(m.id) then raise exception 'moving_forbidden'; end if;
 if p_action='sharing' then
   if m.user_id<>auth.uid() then raise exception 'moving_forbidden'; end if;
   if jsonb_typeof(p_payload->'friends') is distinct from 'array' then raise exception 'moving_invalid'; end if;
   select coalesce(array_agg(distinct value::uuid),'{}'::uuid[]) into recipients from jsonb_array_elements_text(p_payload->'friends');
   foreach recipient in array recipients loop
     if not exists(select 1 from friendships f where f.status='accepted' and ((f.requester_id=m.user_id and f.addressee_id=recipient) or (f.addressee_id=m.user_id and f.requester_id=recipient)))
       or not coalesce(has_habitation_access(m.source_id,recipient,'consultation'),false)
       or (m.destination_id is not null and not coalesce(has_habitation_access(m.destination_id,recipient,'consultation'),false)) then raise exception 'moving_share_rights'; end if;
   end loop;
   update moving_projects set shared_with=recipients where id=m.id;
 elsif p_action='project_edit' then
   if not moving_access(m.id,'modification') then raise exception 'moving_forbidden'; end if;
   v_name:=btrim(p_payload->>'name');
   if v_name is null or length(v_name) not between 1 and 160 then raise exception 'moving_invalid'; end if;
   update moving_projects set name=v_name,planned_date=nullif(p_payload->>'planned_date','')::date where id=m.id;
   update pieces set name='Déménagement · '||v_name where id=m.staging_piece_id;
   update emplacements set name=v_name where id=m.staging_location_id;
 elsif p_action='box_edit' then
   if not moving_access(m.id,'modification') then raise exception 'moving_forbidden'; end if;
   select * into b from moving_boxes where id=(p_payload->>'box_id')::uuid and project_id=m.id and deleted_at is null for update;
   if b.id is null then raise exception 'moving_box_missing'; end if;
   v_name:=btrim(p_payload->>'name');
   if v_name is null or length(v_name) not between 1 and 160 then raise exception 'moving_invalid'; end if;
   if nullif(p_payload->>'destination_piece_id','') is not null and not exists(select 1 from pieces where id=(p_payload->>'destination_piece_id')::uuid and habitation_id=m.destination_id) then raise exception 'moving_destination'; end if;
   update moving_boxes set name=v_name,category=nullif(p_payload->>'category',''),description=nullif(p_payload->>'description',''),destination_piece_id=nullif(p_payload->>'destination_piece_id','')::uuid where id=b.id;
   if b.container_id is not null and not coalesce(has_habitation_access((select location_habitation(parent_emplacement_id,parent_conteneur_id) from conteneurs where id=b.container_id),auth.uid(),'modification'),false) then raise exception 'moving_forbidden'; end if;
   update conteneurs set name=v_name where id=b.container_id;
 elsif p_action='box_delete' and p_payload ? 'contents' then
   perform moving_delete_box(m.id,(p_payload->>'box_id')::uuid,p_payload->>'contents',
     coalesce(p_payload->>'recovery_name','Objets à ranger'));
 elsif p_action in ('project_delete','box_delete') then
   if p_action='project_delete' and not moving_access(m.id,'modification') and not (m.user_id=auth.uid() and m.status='completed') then raise exception 'moving_forbidden'; end if;
   if p_action='box_delete' and not moving_access(m.id,'modification') then raise exception 'moving_forbidden'; end if;
   if p_action='box_delete' and not exists(select 1 from moving_boxes where id=(p_payload->>'box_id')::uuid and project_id=m.id and deleted_at is null) then raise exception 'moving_box_missing'; end if;
   if not moving_access(m.id,'modification') and exists(select 1 from moving_boxes where project_id=m.id and deleted_at is null and container_id is not null) then raise exception 'moving_forbidden'; end if;
   if p_action='project_delete' then
     perform id from pieces where id=m.staging_piece_id for update;
     perform id from emplacements where id=m.staging_location_id for update;
   end if;
   -- Lock parent containers before checking emptiness: FK inserts cannot race deletion.
   perform c.id from conteneurs c join moving_boxes x on x.container_id=c.id where x.project_id=m.id and x.deleted_at is null
     and (p_action='project_delete' or x.id=(p_payload->>'box_id')::uuid) for update of c;
   for b in select * from moving_boxes where project_id=m.id and deleted_at is null and (p_action='project_delete' or id=(p_payload->>'box_id')::uuid) loop
     if exists(select 1 from objets where parent_conteneur_id=b.container_id) or exists(select 1 from conteneurs where parent_conteneur_id=b.container_id) then raise exception 'moving_delete_not_empty'; end if;
     -- A stored box is an ordinary inventory container and survives removal of its moving record.
     if b.status<>'stored' and b.container_id is not null then
       if not coalesce(has_habitation_access((select location_habitation(parent_emplacement_id,parent_conteneur_id) from conteneurs where id=b.container_id),auth.uid(),'modification'),false) then raise exception 'moving_forbidden'; end if;
       delete from conteneurs where id=b.container_id;
     end if;
     update moving_boxes set deleted_at=now(),container_id=null where id=b.id;
   end loop;
   if p_action='project_delete' then
     if not exists(select 1 from objets where parent_emplacement_id=m.staging_location_id) and not exists(select 1 from conteneurs where parent_emplacement_id=m.staging_location_id) then delete from emplacements where id=m.staging_location_id; end if;
     if not exists(select 1 from emplacements where piece_id=m.staging_piece_id) then delete from pieces where id=m.staging_piece_id; end if;
     update moving_projects set deleted_at=now(),status='completed' where id=m.id;
   end if;
 else raise exception 'moving_invalid'; end if;
 return jsonb_build_object('id',m.id);
end $$;
revoke all on function public.moving_manage(text,jsonb) from public;
grant execute on function public.moving_manage(text,jsonb) to authenticated;
