-- Moving is metadata over the existing inventory, never a second object store.
create table public.moving_projects (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 source_id uuid references public.habitations(id) on delete set null,
 destination_id uuid references public.habitations(id) on delete set null,
 name text not null check(length(btrim(name)) between 1 and 160),
 planned_date date,
 status text not null default 'preparation' check(status in ('preparation','moving','unpacking','completed')),
 staging_piece_id uuid references public.pieces(id) on delete set null,
 staging_location_id uuid references public.emplacements(id) on delete set null,
 next_number integer not null default 1,
 created_at timestamptz not null default now(), completed_at timestamptz,
 check(source_id is null or destination_id is null or source_id<>destination_id)
);
create table public.moving_boxes (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.moving_projects(id) on delete cascade,
 container_id uuid unique references public.conteneurs(id) on delete set null,
 number integer not null, name text not null, category text, description text, photo_url text,
 destination_piece_id uuid references public.pieces(id) on delete set null,
 status text not null default 'packing' check(status in ('packing','ready','transported','stored')),
 created_at timestamptz not null default now(), unique(project_id,number)
);
create table public.moving_items (
 project_id uuid not null references public.moving_projects(id) on delete cascade,
 object_id uuid not null, -- Historical identity survives the existing recycle bin.
 box_id uuid not null references public.moving_boxes(id),
 name text not null,
 origin_type text, origin_id uuid, origin_label text,
 outcome text not null default 'packed' check(outcome in ('packed','installed','stored','lost','given','sold','discarded','removed')),
 packed_at timestamptz not null default now(), resolved_at timestamptz,
 primary key(project_id,object_id)
);
create index moving_boxes_project on public.moving_boxes(project_id);
create index moving_items_box on public.moving_items(box_id);
create index moving_items_object on public.moving_items(object_id);
create index moving_projects_source on public.moving_projects(source_id);

create function public.moving_access(p_id uuid, p_permission text default 'consultation') returns boolean
language sql stable security definer set search_path = public as $$
 select exists(select 1 from moving_projects m where m.id=p_id
 and auth.uid() is not null
 and (has_habitation_access(m.source_id,auth.uid(),p_permission)
      or (m.source_id is null and m.status='completed' and m.user_id=auth.uid() and p_permission='consultation'))
 and (m.destination_id is null or has_habitation_access(m.destination_id,auth.uid(),p_permission)))
$$;
revoke all on function public.moving_access(uuid,text) from public;
grant execute on function public.moving_access(uuid,text) to authenticated;
alter table public.moving_projects enable row level security;
alter table public.moving_boxes enable row level security;
alter table public.moving_items enable row level security;
create policy moving_projects_read on public.moving_projects for select to authenticated using(moving_access(id));
create policy moving_boxes_read on public.moving_boxes for select to authenticated using(moving_access(project_id));
create policy moving_items_read on public.moving_items for select to authenticated using(moving_access(project_id));
revoke all on public.moving_projects, public.moving_boxes, public.moving_items from anon, authenticated;
grant select on public.moving_projects, public.moving_boxes, public.moving_items to authenticated;

-- The trigger sees ALL object moves, including voice and existing move_objet.
-- It runs after the inventory's RLS check, and never grants inventory access.
create function public.moving_track_object() returns trigger
language plpgsql security definer set search_path = public as $$
declare b moving_boxes; old_b moving_boxes; m moving_projects; origin_type text; origin_id uuid; origin_label text;
begin
 if TG_OP='DELETE' then
   update moving_items i set outcome=case when outcome in ('lost','given','sold','discarded') then outcome else 'removed' end,
     resolved_at=now() where object_id=old.id and exists(select 1 from moving_projects p where p.id=i.project_id and p.status<>'completed');
   return old;
 end if;
 if TG_OP='UPDATE' and new.parent_emplacement_id is not distinct from old.parent_emplacement_id
   and new.parent_conteneur_id is not distinct from old.parent_conteneur_id then return new; end if;
 select x.* into b from moving_boxes x join moving_projects p on p.id=x.project_id
   where x.container_id=new.parent_conteneur_id and p.status<>'completed';
 if TG_OP='UPDATE' then
   select x.* into old_b from moving_boxes x join moving_projects p on p.id=x.project_id
     where x.container_id=old.parent_conteneur_id and p.status<>'completed';
   if old_b.id is not null and b.id is not null and b.project_id<>old_b.project_id then
     raise exception 'moving_other_project';
   end if;
   if old_b.id is not null and (b.id is null or b.project_id<>old_b.project_id or b.status='stored') then
     update moving_items set outcome=case when location_habitation(new.parent_emplacement_id,new.parent_conteneur_id)=
       (select destination_id from moving_projects where id=old_b.project_id) then 'installed' else 'removed' end,
       resolved_at=now() where project_id=old_b.project_id and object_id=new.id;
   end if;
   origin_type:=case when old.parent_emplacement_id is not null then 'emplacement' else 'conteneur' end;
   origin_id:=coalesce(old.parent_emplacement_id,old.parent_conteneur_id);
   if origin_type='emplacement' then select name into origin_label from emplacements where id=origin_id;
   else select name into origin_label from conteneurs where id=origin_id; end if;
 end if;
 if b.id is not null then
   select * into m from moving_projects where id=b.project_id for update;
   if b.status='stored' then return new; end if;
   if exists(select 1 from moving_items i join moving_projects p on p.id=i.project_id
      where i.object_id=new.id and p.id<>b.project_id and p.status<>'completed' and i.outcome='packed') then
     raise exception 'moving_other_project';
   end if;
   insert into moving_items(project_id,object_id,box_id,name,origin_type,origin_id,origin_label)
   values(b.project_id,new.id,b.id,new.name,origin_type,origin_id,origin_label)
   on conflict(project_id,object_id) do update set box_id=excluded.box_id,name=excluded.name,outcome='packed',resolved_at=null;
   update moving_boxes set status='packing' where id=b.id;
 end if;
 return new;
end
$$;
revoke all on function public.moving_track_object() from public;
create trigger moving_track_object after insert or update or delete on public.objets
 for each row execute function public.moving_track_object();

create function public.moving_read(p_project_id uuid default null) returns jsonb
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
    from moving_boxes b left join pieces p on p.id=b.destination_piece_id where b.project_id=m.id),'[]'::jsonb),
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

-- One transactional command boundary. IDs supplied by the client make creations retryable.
create function public.moving_command(p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m moving_projects; b moving_boxes; o objets; v_id uuid; v_source uuid; v_dest uuid; v_piece uuid; v_loc uuid;
 v_type text; v_target uuid; v_home uuid; v_name text; v_number integer; entry jsonb; v_status text; v_box uuid;
begin
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'moving_forbidden'; end if;
 if p_action='create' then
   v_id:=(p_payload->>'id')::uuid; v_source:=(p_payload->>'source_id')::uuid; v_dest:=nullif(p_payload->>'destination_id','')::uuid;
   if not coalesce(has_habitation_access(v_source,auth.uid(),'modification'),false) then raise exception 'moving_forbidden'; end if;
   if exists(select 1 from moving_projects where id=v_id) then
     if not moving_access(v_id,'modification') then raise exception 'moving_forbidden'; end if;
     return jsonb_build_object('id',v_id);
   end if;
   if nullif(btrim(p_payload->>'destination_name'),'') is not null and v_dest is null then
     insert into habitations(user_id,name,type,icon) values(auth.uid(),btrim(p_payload->>'destination_name'),'maison','maison') returning id into v_dest;
   end if;
   if v_dest is not null and not coalesce(has_habitation_access(v_dest,auth.uid(),'modification'),false) then raise exception 'moving_forbidden'; end if;
   v_name:=btrim(p_payload->>'name');
   -- A dedicated, explicitly named inventory room holds the temporary containers.
   insert into pieces(habitation_id,name) values(v_source,'Déménagement · '||v_name) returning id into v_piece;
   insert into emplacements(piece_id,name) values(v_piece,v_name) returning id into v_loc;
   insert into moving_projects(id,source_id,destination_id,name,planned_date,staging_piece_id,staging_location_id)
    values(v_id,v_source,v_dest,v_name,nullif(p_payload->>'planned_date','')::date,v_piece,v_loc);
   return jsonb_build_object('id',v_id);
 end if;
 select * into m from moving_projects where id=(p_payload->>'project_id')::uuid for update;
 if m.id is null or not moving_access(m.id,'modification') then raise exception 'moving_forbidden'; end if;
 if m.status='completed' then raise exception 'moving_completed'; end if;
 if p_action='destination' then
   v_dest:=nullif(p_payload->>'destination_id','')::uuid;
   if v_dest is null and nullif(btrim(p_payload->>'destination_name'),'') is not null then
     insert into habitations(user_id,name,type,icon) values(auth.uid(),btrim(p_payload->>'destination_name'),'maison','maison') returning id into v_dest;
   end if;
   if v_dest is null or v_dest=m.source_id or not coalesce(has_habitation_access(v_dest,auth.uid(),'modification'),false) then raise exception 'moving_destination'; end if;
   if v_dest is not distinct from m.destination_id then return jsonb_build_object('id',m.id); end if;
   if exists(select 1 from moving_boxes where project_id=m.id and status='stored')
      or exists(select 1 from moving_items where project_id=m.id and outcome='installed') then raise exception 'moving_destination_locked'; end if;
   update moving_projects set destination_id=v_dest where id=m.id;
   update moving_boxes set destination_piece_id=null where project_id=m.id;
 elsif p_action='phase' then
   v_status:=p_payload->>'status';
   if v_status not in ('preparation','moving','unpacking') then raise exception 'moving_invalid'; end if;
   update moving_projects set status=v_status where id=m.id;
 elsif p_action='box_create' then
   v_box:=(p_payload->>'id')::uuid;
   if exists(select 1 from moving_boxes where id=v_box and project_id=m.id) then return jsonb_build_object('id',v_box); end if;
   v_number:=m.next_number;
   v_piece:=nullif(p_payload->>'destination_piece_id','')::uuid;
   if v_piece is not null and not exists(select 1 from pieces where id=v_piece and habitation_id=m.destination_id) then raise exception 'moving_destination'; end if;
   v_name:='Carton #'||lpad(v_number::text,greatest(2,length(v_number::text)),'0')||case when nullif(btrim(p_payload->>'name'),'') is not null then ' · '||btrim(p_payload->>'name') else '' end;
   insert into conteneurs(name,parent_emplacement_id) values(v_name,m.staging_location_id) returning id into v_id;
   insert into moving_boxes(id,project_id,container_id,number,name,category,description,destination_piece_id)
    values(v_box,m.id,v_id,v_number,v_name,nullif(p_payload->>'category',''),nullif(p_payload->>'description',''),v_piece);
   update moving_projects set next_number=next_number+1 where id=m.id;
   return jsonb_build_object('id',v_box);
 elsif p_action='finish' then
   if exists(select 1 from objets current_object join moving_boxes current_box on current_box.container_id=current_object.parent_conteneur_id where current_box.project_id=m.id and current_box.status<>'stored')
    or exists(select 1 from conteneurs c join moving_boxes current_box on current_box.container_id=c.parent_conteneur_id where current_box.project_id=m.id and current_box.status<>'stored') then raise exception 'moving_not_empty'; end if;
   -- Snapshot names and item history stay in the metadata; only empty temporary containers are removed.
   delete from conteneurs where id in (select container_id from moving_boxes where project_id=m.id and status<>'stored');
   if not exists(select 1 from conteneurs where parent_emplacement_id=m.staging_location_id)
    and not exists(select 1 from objets where parent_emplacement_id=m.staging_location_id) then
     delete from emplacements where id=m.staging_location_id;
   end if;
   if not exists(select 1 from emplacements where piece_id=m.staging_piece_id) then delete from pieces where id=m.staging_piece_id; end if;
   update moving_projects set status='completed',completed_at=now() where id=m.id;
 else
   select * into b from moving_boxes where id=(p_payload->>'box_id')::uuid and project_id=m.id for update;
   if b.id is null or b.container_id is null then raise exception 'moving_box_missing'; end if;
   if p_action='box_edit' then
     v_piece:=nullif(p_payload->>'destination_piece_id','')::uuid;
     if v_piece is not null and not exists(select 1 from pieces where id=v_piece and habitation_id=m.destination_id) then raise exception 'moving_destination'; end if;
     v_name:=btrim(p_payload->>'name');
     if v_name is null or length(v_name) not between 1 and 160 then raise exception 'moving_invalid'; end if;
     update moving_boxes set name=v_name,category=nullif(p_payload->>'category',''),description=nullif(p_payload->>'description',''),destination_piece_id=v_piece where id=b.id;
     update conteneurs set name=v_name where id=b.container_id;
   elsif p_action='box_photo' then
     update moving_boxes set photo_url=p_payload->>'photo_url' where id=b.id;
     update conteneurs set photo_url=p_payload->>'photo_url' where id=b.container_id;
   elsif p_action='box_status' then
     if b.status='stored' then raise exception 'moving_box_stored'; end if;
     v_status:=p_payload->>'status';
     if v_status not in ('packing','ready','transported') then raise exception 'moving_invalid'; end if;
     update moving_boxes set status=v_status where id=b.id;
   elsif p_action in ('pack','unpack','dispose','scan') then
     if b.status='stored' then raise exception 'moving_box_stored'; end if;
     if p_action='unpack' then
       v_type:=p_payload->>'to_type'; v_target:=(p_payload->>'to_id')::uuid;
       if v_type not in ('emplacement','conteneur') then raise exception 'moving_destination'; end if;
       v_home:=location_habitation(case when v_type='emplacement' then v_target end,case when v_type='conteneur' then v_target end);
       if m.destination_id is null or v_home is distinct from m.destination_id or not coalesce(has_habitation_access(v_home,auth.uid(),'modification'),false) then raise exception 'moving_destination'; end if;
       if exists(select 1 from moving_boxes x join moving_projects p on p.id=x.project_id where x.container_id=v_target and p.status<>'completed' and x.status<>'stored') then raise exception 'moving_destination'; end if;
     end if;
     if jsonb_typeof(p_payload->'items') is distinct from 'array' or jsonb_array_length(p_payload->'items') not between 1 and 500 then raise exception 'moving_invalid'; end if;
     for entry in select value from jsonb_array_elements(p_payload->'items') order by value->>'id' loop
       v_id:=(entry->>'id')::uuid;
       select * into o from objets where id=v_id for update;
       if p_action='scan' and o.id is null and coalesce((entry->>'create')::boolean,false) then
         v_name:=btrim(entry->>'name');
         if v_name is null or length(v_name) not between 1 and 160 then raise exception 'moving_invalid'; end if;
         insert into objets(id,name,parent_conteneur_id,photo_url) values(v_id,v_name,b.container_id,entry->>'photo_url');
       else
         if o.id is null then raise exception 'moving_object_missing'; end if;
         v_home:=location_habitation(o.parent_emplacement_id,o.parent_conteneur_id);
         if not coalesce(has_habitation_access(v_home,auth.uid(),'modification'),false) or v_home not in (m.source_id,coalesce(m.destination_id,m.source_id)) then raise exception 'moving_forbidden'; end if;
         if p_action in ('pack','scan') then
           if o.parent_conteneur_id is distinct from b.container_id then perform move_objet(o.id,'conteneur',b.container_id); end if;
         else
           if o.parent_conteneur_id is distinct from b.container_id then raise exception 'moving_object_changed'; end if;
           if p_action='unpack' then perform move_objet(o.id,v_type,v_target);
           else
             v_status:=p_payload->>'outcome';
             if v_status not in ('lost','given','sold','discarded') then raise exception 'moving_invalid'; end if;
             update moving_items set outcome=v_status,resolved_at=now() where project_id=m.id and object_id=o.id;
             perform corbeille_deposer('objet',o.id);
           end if;
         end if;
       end if;
     end loop;
   elsif p_action='store' then
     v_type:=p_payload->>'to_type'; v_target:=(p_payload->>'to_id')::uuid;
     if v_type not in ('emplacement','conteneur') then raise exception 'moving_destination'; end if;
     v_home:=location_habitation(case when v_type='emplacement' then v_target end,case when v_type='conteneur' then v_target end);
     if m.destination_id is null or v_home is distinct from m.destination_id or not coalesce(has_habitation_access(v_home,auth.uid(),'modification'),false) then raise exception 'moving_destination'; end if;
     if exists(select 1 from moving_boxes x join moving_projects p on p.id=x.project_id where x.container_id=v_target and p.status<>'completed') then raise exception 'moving_destination'; end if;
     if v_type='conteneur' and exists(with recursive ancestors as (
       select id,parent_conteneur_id from conteneurs where id=v_target
       union select c.id,c.parent_conteneur_id from conteneurs c join ancestors a on c.id=a.parent_conteneur_id
     ) select 1 from ancestors where id=b.container_id) then raise exception 'moving_destination'; end if;
     update conteneurs set parent_emplacement_id=case when v_type='emplacement' then v_target end,
       parent_conteneur_id=case when v_type='conteneur' then v_target end where id=b.container_id;
     insert into objet_deplacements(objet_id,from_location_type,from_location_id,from_location_label,to_location_type,to_location_id,to_location_label)
       select current_object.id,'conteneur',b.container_id,b.name,'conteneur',b.container_id,b.name||' · stocké' from objets current_object where current_object.parent_conteneur_id=b.container_id;
     update moving_boxes set status='stored' where id=b.id;
     update moving_items set outcome='stored',resolved_at=now() where box_id=b.id and outcome='packed';
   else raise exception 'moving_invalid'; end if;
 end if;
 return jsonb_build_object('id',m.id);
end
$$;
revoke all on function public.moving_command(text,jsonb) from public;
grant execute on function public.moving_command(text,jsonb) to authenticated;

-- Supplement the favourite-only index without changing its existing RPC contract.
create function public.moving_search_index() returns table(kind text,id uuid,name text,photo_url text,preset_key text,piece_id uuid,piece_name text,habitation_id uuid,habitation_name text,parent_label text)
language sql stable security definer set search_path = public as $$
 select 'objet'::text,o.id,o.name,o.photo_url,null::text,p.id,m.name,p.habitation_id,h.name,b.name
 from moving_boxes b join moving_projects m on m.id=b.project_id
 join objets o on o.parent_conteneur_id=b.container_id
 join emplacements e on e.id=conteneur_root_emplacement(b.container_id)
 join pieces p on p.id=e.piece_id join habitations h on h.id=p.habitation_id
 where m.status<>'completed' and moving_access(m.id) and has_habitation_access(h.id,auth.uid(),'consultation')
 union all
 select 'conteneur'::text,b.container_id,b.name,b.photo_url,null::text,p.id,m.name,p.habitation_id,h.name,m.name
 from moving_boxes b join moving_projects m on m.id=b.project_id
 join emplacements e on e.id=conteneur_root_emplacement(b.container_id)
 join pieces p on p.id=e.piece_id join habitations h on h.id=p.habitation_id
 where m.status<>'completed' and moving_access(m.id) and has_habitation_access(h.id,auth.uid(),'consultation')
$$;
revoke all on function public.moving_search_index() from public;
grant execute on function public.moving_search_index() to authenticated;
-- Do not delete homes underneath an active move. Completed archives do not block cleanup.
create function public.moving_guard_home_delete() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if exists(select 1 from auth.users where id=old.user_id)
 and exists(select 1 from moving_projects where status<>'completed' and (source_id=old.id or destination_id=old.id)) then
  raise exception 'moving_active_home';
 end if;
 return old;
end
$$;
revoke all on function public.moving_guard_home_delete() from public;
create trigger moving_guard_home_delete before delete on public.habitations for each row execute function public.moving_guard_home_delete();
