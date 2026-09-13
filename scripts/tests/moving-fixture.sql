-- Minimal existing-inventory contract for isolated PostgreSQL tests.
-- New migration is executed verbatim. Existing services are represented here only.
create schema auth;
create table auth.users(id uuid primary key);
create role anon; create role authenticated;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function auth.jwt() returns jsonb language sql stable as $$select '{}'::jsonb$$;
create table habitations(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,name text not null,type text not null,icon text);
create table pieces(id uuid primary key default gen_random_uuid(),habitation_id uuid references habitations(id) on delete cascade,name text not null);
create table emplacements(id uuid primary key default gen_random_uuid(),piece_id uuid references pieces(id) on delete cascade,name text not null);
create table conteneurs(id uuid primary key default gen_random_uuid(),name text not null,photo_url text,parent_emplacement_id uuid references emplacements(id) on delete cascade,parent_conteneur_id uuid references conteneurs(id) on delete cascade,
 check((parent_emplacement_id is not null)::int+(parent_conteneur_id is not null)::int=1));
create table objets(id uuid primary key default gen_random_uuid(),name text not null,photo_url text,parent_emplacement_id uuid references emplacements(id) on delete cascade,parent_conteneur_id uuid references conteneurs(id) on delete cascade,
 check((parent_emplacement_id is not null)::int+(parent_conteneur_id is not null)::int=1));
create table objet_deplacements(id uuid primary key default gen_random_uuid(),objet_id uuid references objets(id) on delete cascade,from_location_type text,from_location_id uuid,from_location_label text,to_location_type text,to_location_id uuid,to_location_label text);
create table test_permissions(home uuid,person uuid,permission text);
create function has_habitation_access(h uuid,u uuid,p text) returns boolean language sql stable security definer set search_path=public as $$
select exists(select 1 from habitations where id=h and user_id=u) or exists(select 1 from test_permissions where home=h and person=u and (permission='modification' or p='consultation'))$$;
create function conteneur_root_emplacement(c_id uuid) returns uuid language sql stable as $$
with recursive chain as (select id,parent_emplacement_id,parent_conteneur_id from conteneurs where id=c_id union select c.id,c.parent_emplacement_id,c.parent_conteneur_id from conteneurs c join chain on c.id=chain.parent_conteneur_id)
select parent_emplacement_id from chain where parent_emplacement_id is not null limit 1$$;
create function location_habitation(e_id uuid,c_id uuid) returns uuid language sql stable as $$select p.habitation_id from emplacements e join pieces p on p.id=e.piece_id where e.id=coalesce(e_id,conteneur_root_emplacement(c_id))$$;
create function corbeille_deposer(kind text,o_id uuid) returns uuid language plpgsql as $$begin delete from objets where id=o_id;return o_id;end$$;
