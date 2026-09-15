-- Existing projects also become private. Access always intersects home permissions.
alter table public.moving_projects add column shared_with uuid[] not null default '{}';
alter table public.moving_projects add column deleted_at timestamptz;
alter table public.moving_boxes add column deleted_at timestamptz;

create or replace function public.moving_access(p_id uuid, p_permission text default 'consultation') returns boolean
language sql stable security definer set search_path = public as $$
 select exists(select 1 from moving_projects m where m.id=p_id and m.deleted_at is null
 and auth.uid() is not null
 and (m.user_id=auth.uid() or (auth.uid()=any(m.shared_with) and exists(
   select 1 from friendships f where f.status='accepted' and
   ((f.requester_id=m.user_id and f.addressee_id=auth.uid()) or (f.addressee_id=m.user_id and f.requester_id=auth.uid())))))
 and (has_habitation_access(m.source_id,auth.uid(),p_permission)
   or (m.source_id is null and m.status='completed' and m.user_id=auth.uid() and p_permission='consultation'))
 and (m.destination_id is null or has_habitation_access(m.destination_id,auth.uid(),p_permission)))
$$;

create function public.moving_share_candidates(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare m moving_projects;
begin
 select * into m from moving_projects where id=p_id;
 if m.user_id is distinct from auth.uid() or not moving_access(p_id) then raise exception 'moving_forbidden'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('user_id',u.id,'permission',
   case when has_habitation_access(m.source_id,u.id,'modification') and (m.destination_id is null or has_habitation_access(m.destination_id,u.id,'modification')) then 'modification'
   when has_habitation_access(m.source_id,u.id,'consultation') and (m.destination_id is null or has_habitation_access(m.destination_id,u.id,'consultation')) then 'consultation' else null end))
   from (select case when requester_id=m.user_id then addressee_id else requester_id end id from friendships
     where status='accepted' and (requester_id=m.user_id or addressee_id=m.user_id)) u),'[]'::jsonb);
end $$;
revoke all on function public.moving_share_candidates(uuid) from public;
grant execute on function public.moving_share_candidates(uuid) to authenticated;

create function public.moving_manage(p_action text,p_payload jsonb) returns jsonb
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

create or replace function public.moving_read(p_project_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare m moving_projects; result jsonb;
begin
 if auth.uid() is null then raise exception 'moving_forbidden'; end if;
 if p_project_id is null then
  return coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('editable',moving_access(p.id,'modification')) order by p.created_at desc)
    from moving_projects p where moving_access(p.id)), '[]'::jsonb);
 end if;
 if not exists(select 1 from moving_projects where id=p_project_id) then
   select project_id into p_project_id from moving_boxes where id=p_project_id;
 end if;
 if p_project_id is null or not moving_access(p_project_id) then raise exception 'moving_forbidden'; end if;
 select * into m from moving_projects where id=p_project_id;
 select jsonb_build_object('project',to_jsonb(m),'editable',moving_access(m.id,'modification'),
  'boxes',coalesce((select jsonb_agg(to_jsonb(b)||jsonb_build_object('destination_name',p.name) order by b.number)
    from moving_boxes b left join pieces p on p.id=b.destination_piece_id where b.project_id=m.id and b.deleted_at is null),'[]'::jsonb),
  'items',coalesce((select jsonb_agg(to_jsonb(i)) from moving_items i where i.project_id=m.id),'[]'::jsonb),
  'objects',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'photo_url',o.photo_url,
    'parent_type',case when o.parent_emplacement_id is not null then 'emplacement' else 'conteneur' end,
    'parent_id',coalesce(o.parent_emplacement_id,o.parent_conteneur_id),
    'parent_label',coalesce(c.name,e.name),'habitation_id',p.habitation_id,'piece_name',p.name) order by o.name)
    from objets o left join conteneurs c on c.id=o.parent_conteneur_id
    join emplacements e on e.id=coalesce(o.parent_emplacement_id,conteneur_root_emplacement(o.parent_conteneur_id))
    join pieces p on p.id=e.piece_id where p.habitation_id in (m.source_id,m.destination_id)), '[]'::jsonb)) into result;
 return result;
end
$$;
revoke all on function public.moving_read(uuid) from public;
grant execute on function public.moving_read(uuid) to authenticated;


alter policy moving_boxes_read on public.moving_boxes using(deleted_at is null and moving_access(project_id));
