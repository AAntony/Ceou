-- Future disposals only: do not reinterpret or remove historical inventory.
create or replace function public.moving_command(p_action text,p_payload jsonb) returns jsonb
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
             -- Snapshot first; removal and history remain in the same transaction.
             delete from objets where id=o.id;
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

