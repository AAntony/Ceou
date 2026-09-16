-- Observe first: existing inventories remain available. Activation is a server operation.
create table public.billing_settings (
 id boolean primary key default true check(id),
 enforce boolean not null default false,
 ads_enabled boolean not null default false,
 reward_photos integer not null default 2 check(reward_photos between 1 and 10),
 ads_per_day integer not null default 5 check(ads_per_day between 1 and 20)
);
insert into public.billing_settings(id) values(true);
create table public.billing_plans (
 id text primary key check(id in ('free','plus')),
 homes integer not null check(homes > 0), objects integer not null check(objects > 0),
 photos integer not null check(photos >= 0), voice_seconds integer not null check(voice_seconds >= 0)
);
insert into public.billing_plans values ('free',2,150,5,300),('plus',10,3000,50,1800);
create table public.billing_testers(user_id uuid primary key references auth.users(id) on delete cascade);
create table public.billing_entitlements (
 user_id uuid references auth.users(id) on delete cascade,
 sandbox boolean not null, expires_at timestamptz not null,
 checked_at timestamptz not null default now(), primary key(user_id,sandbox)
);
create table public.billing_photo_usage (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 period date not null default date_trunc('month',now() at time zone 'utc')::date,
 created_at timestamptz not null default now(), settled_at timestamptz,
 charged boolean not null default true, bonus boolean not null default false,
 input_tokens integer, output_tokens integer, model text
);
create index billing_photo_usage_month on public.billing_photo_usage(user_id,period);
create table public.billing_ad_rewards (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '1 hour',
 granted_at timestamptz, transaction_id text unique, photos integer not null,
 test boolean not null default false
);
create index billing_ad_rewards_user on public.billing_ad_rewards(user_id,created_at);
do $$declare n text; begin
 foreach n in array array['billing_settings','billing_plans','billing_testers','billing_entitlements','billing_photo_usage','billing_ad_rewards'] loop
 execute format('alter table public.%I enable row level security',n);
 execute format('revoke all on public.%I from anon, authenticated',n);
 execute format('grant all on public.%I to service_role',n);
 end loop;
end $$;

create function public.billing_plan(p_user uuid) returns text language sql stable security definer set search_path=public as $$
 select case when exists(select 1 from billing_entitlements e where e.user_id=p_user and e.expires_at>now()
 and (not e.sandbox or exists(select 1 from billing_testers t where t.user_id=p_user))) then 'plus' else 'free' end
$$;
create function public.billing_inventory(p_user uuid) returns jsonb language sql stable security definer set search_path=public as $$
 with recursive locations as (
 select e.id from emplacements e join pieces p on p.id=e.piece_id join habitations h on h.id=p.habitation_id where h.user_id=p_user
 ), containers as (
 select c.id from conteneurs c join locations l on l.id=c.parent_emplacement_id
 union select c.id from conteneurs c join containers parent on parent.id=c.parent_conteneur_id
 ) select jsonb_build_object('homes',(select count(*) from habitations where user_id=p_user),
 'objects',(select count(*) from objets where parent_emplacement_id in (select id from locations) or parent_conteneur_id in (select id from containers)))
$$;
create function public.billing_snapshot() returns jsonb language plpgsql stable security definer set search_path=public as $$
declare u uuid:=auth.uid(); plan text; v_period date:=date_trunc('month',now() at time zone 'utc')::date;
begin
 if u is null then raise exception 'unauthorized'; end if;
 plan:=billing_plan(u);
 return jsonb_build_object('plan',plan,'enforced',(select enforce from billing_settings),
 'tester',exists(select 1 from billing_testers where user_id=u),
 'ads_enabled',(select ads_enabled from billing_settings),
 'reward_photos',(select reward_photos from billing_settings),'ads_per_day',(select ads_per_day from billing_settings),
 'plans',(select jsonb_object_agg(id,to_jsonb(p)-'id') from billing_plans p),
 'inventory',billing_inventory(u),'period',v_period,'resets_at',v_period+interval '1 month',
 'photos_used',(select count(*) from billing_photo_usage where user_id=u and billing_photo_usage.period=v_period and charged and not bonus),
 'bonus_remaining',greatest(0,(select coalesce(sum(photos),0) from billing_ad_rewards where user_id=u and granted_at>=v_period and (not test or exists(select 1 from billing_testers where user_id=u)))
 -(select count(*) from billing_photo_usage where user_id=u and billing_photo_usage.period=v_period and charged and bonus)),
 'ads_today',(select count(*) from billing_ad_rewards where user_id=u and created_at>=(now() at time zone 'utc')::date and (granted_at is not null or expires_at>now())),
 'voice_seconds_used',(select coalesce(sum(coalesce(used_seconds,granted_seconds)),0) from voice_live_sessions where user_id=u and day>=v_period));
end $$;

create function public.billing_photo_reserve(p_user uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare id uuid; used integer; credits integer; cap integer; is_bonus boolean:=false; v_period date:=date_trunc('month',now() at time zone 'utc')::date;
begin
 perform pg_advisory_xact_lock(hashtext('billing:'||p_user));
 select photos into cap from billing_plans where billing_plans.id=billing_plan(p_user);
 select count(*) into used from billing_photo_usage where user_id=p_user and billing_photo_usage.period=v_period and charged and not bonus;
 if used>=cap then
 select coalesce(sum(photos),0) into credits from billing_ad_rewards where user_id=p_user and granted_at>=v_period and (not test or exists(select 1 from billing_testers where user_id=p_user));
 select credits-count(*) into credits from billing_photo_usage where user_id=p_user and billing_photo_usage.period=v_period and charged and bonus;
 is_bonus:=credits>0;
 if not is_bonus and (select enforce from billing_settings) then raise exception 'billing_photo_limit'; end if;
 end if;
 insert into billing_photo_usage(user_id,bonus) values(p_user,is_bonus) returning billing_photo_usage.id into id;
 return id;
end $$;
create function public.billing_photo_settle(p_id uuid,p_success boolean,p_input integer default null,p_output integer default null,p_model text default null)
 returns void language sql security definer set search_path=public as $$
 update billing_photo_usage set charged=p_success,settled_at=now(),input_tokens=greatest(0,p_input),output_tokens=greatest(0,p_output),model=p_model
 where id=p_id and settled_at is null
$$;

create function public.billing_ad_prepare(p_user uuid,p_test boolean) returns uuid language plpgsql security definer set search_path=public as $$
declare id uuid; c integer; settings billing_settings;
begin
 perform pg_advisory_xact_lock(hashtext('billing:'||p_user));
 select * into settings from billing_settings;
 if p_test then
 if not exists(select 1 from billing_testers where user_id=p_user) then raise exception 'billing_test_disabled'; end if;
 elsif not settings.ads_enabled then raise exception 'billing_ads_disabled'; end if;
 select count(*) into c from billing_ad_rewards where user_id=p_user and created_at>=(now() at time zone 'utc')::date and (granted_at is not null or expires_at>now());
 if c>=settings.ads_per_day then raise exception 'billing_ad_limit'; end if;
 insert into billing_ad_rewards(user_id,test,photos) values(p_user,p_test,settings.reward_photos) returning billing_ad_rewards.id into id;
 return id;
end $$;
create function public.billing_ad_grant(p_id uuid,p_user uuid,p_transaction text,p_test boolean) returns boolean language plpgsql security definer set search_path=public as $$
declare reward billing_ad_rewards;
begin
 perform pg_advisory_xact_lock(hashtext('billing:'||p_user));
 select * into reward from billing_ad_rewards where id=p_id and user_id=p_user for update;
 if not found or reward.test<>p_test then return false; end if;
 if reward.granted_at is not null then return reward.transaction_id=p_transaction; end if;
 if reward.expires_at<now() or length(p_transaction)<8 then return false; end if;
 if p_test and not exists(select 1 from billing_testers where user_id=p_user) then return false; end if;
 if exists(select 1 from billing_ad_rewards where transaction_id=p_transaction) then return false; end if;
 update billing_ad_rewards set granted_at=now(),transaction_id=p_transaction where id=p_id;
 return true;
end $$;

-- The home owner pays for their inventory, including additions by an editor.
-- Updates within the same home remain possible after a downgrade.
create function public.billing_inventory_guard() returns trigger language plpgsql security definer set search_path=public as $$
declare owner_id uuid; old_owner uuid; inv jsonb; caps billing_plans; added integer:=1; home uuid;
begin
 if not (select enforce from billing_settings) then return new; end if;
 if tg_table_name='habitations' then
 owner_id:=new.user_id;
 if tg_op='UPDATE' and old.user_id=new.user_id then return new; end if;
 elsif tg_table_name='pieces' then
 select user_id into owner_id from habitations where id=new.habitation_id;
 select user_id into old_owner from habitations where id=old.habitation_id;
 if owner_id=old_owner then return new; end if;
 elsif tg_table_name='emplacements' then
 select h.user_id into owner_id from habitations h join pieces p on p.habitation_id=h.id where p.id=new.piece_id;
 select h.user_id into old_owner from habitations h join pieces p on p.habitation_id=h.id where p.id=old.piece_id;
 if owner_id=old_owner then return new; end if;
 else
 home:=location_habitation(new.parent_emplacement_id,new.parent_conteneur_id);
 select user_id into owner_id from habitations where id=home;
 if tg_op='UPDATE' then
 select user_id into old_owner from habitations where id=location_habitation(old.parent_emplacement_id,old.parent_conteneur_id);
 if old_owner=owner_id then return new; end if;
 end if;
 end if;
 if owner_id is null then return new; end if;
 perform pg_advisory_xact_lock(hashtext('billing:'||owner_id));
 inv:=billing_inventory(owner_id);
 select * into caps from billing_plans where id=billing_plan(owner_id);
 if tg_table_name='habitations' then
 if (inv->>'homes')::integer>=caps.homes then raise exception 'billing_home_limit'; end if;
 if tg_op='INSERT' then return new; end if;
 with recursive locations as (select e.id from emplacements e join pieces p on p.id=e.piece_id where p.habitation_id=new.id),
 containers as (select c.id from conteneurs c join locations l on l.id=c.parent_emplacement_id union select c.id from conteneurs c join containers p on p.id=c.parent_conteneur_id)
 select count(*) into added from objets where parent_emplacement_id in (select id from locations) or parent_conteneur_id in(select id from containers);
 elsif tg_table_name in ('pieces','emplacements') then
 with recursive locations as (select e.id from emplacements e where (tg_table_name='pieces' and e.piece_id=new.id) or (tg_table_name='emplacements' and e.id=new.id)),
 containers as (select c.id from conteneurs c join locations l on l.id=c.parent_emplacement_id union select c.id from conteneurs c join containers p on p.id=c.parent_conteneur_id)
 select count(*) into added from objets where parent_emplacement_id in(select id from locations) or parent_conteneur_id in(select id from containers);
 elsif tg_table_name='conteneurs' then
 with recursive descendants as (select new.id as id union select c.id from conteneurs c join descendants d on c.parent_conteneur_id=d.id)
 select count(*) into added from objets where parent_conteneur_id in(select id from descendants);
 end if;
 if added>0 and (inv->>'objects')::integer+added>caps.objects then raise exception 'billing_object_limit'; end if;
 return new;
end $$;
create trigger billing_home_guard before insert or update of user_id on public.habitations for each row execute function public.billing_inventory_guard();
create trigger billing_object_guard before insert or update of parent_emplacement_id,parent_conteneur_id on public.objets for each row execute function public.billing_inventory_guard();
create trigger billing_container_guard before update of parent_emplacement_id,parent_conteneur_id on public.conteneurs for each row execute function public.billing_inventory_guard();
create trigger billing_room_guard before update of habitation_id on public.pieces for each row execute function public.billing_inventory_guard();
create trigger billing_location_guard before update of piece_id on public.emplacements for each row execute function public.billing_inventory_guard();

-- Keep the existing daily protection, adding the monthly allowance under the same lock.
create or replace function public.voice_live_reserve(p_user_id uuid,p_session_seconds integer,p_daily_seconds integer,p_min_seconds integer)
 returns table(session_id uuid,granted_seconds integer,remaining_seconds integer) language plpgsql security definer set search_path=public as $$
declare used integer; monthly integer; cap integer; granted integer; id uuid; remaining integer;
begin
 perform pg_advisory_xact_lock(hashtext('voice_live:'||p_user_id));
 select coalesce(sum(coalesce(s.used_seconds,s.granted_seconds)),0) into used from voice_live_sessions s where s.user_id=p_user_id and s.day=(now() at time zone 'utc')::date;
 remaining:=p_daily_seconds-used;
 if (select enforce from billing_settings) then
 select voice_seconds into cap from billing_plans where billing_plans.id=billing_plan(p_user_id);
 select coalesce(sum(coalesce(s.used_seconds,s.granted_seconds)),0) into monthly from voice_live_sessions s where s.user_id=p_user_id and s.day>=date_trunc('month',now() at time zone 'utc')::date;
 remaining:=least(remaining,cap-monthly);
 end if;
 granted:=least(p_session_seconds,remaining);
 if granted<greatest(1,p_min_seconds) then return; end if;
 insert into voice_live_sessions(user_id,granted_seconds) values(p_user_id,granted) returning voice_live_sessions.id into id;
 return query select id,granted,remaining-granted;
end $$;

create function public.billing_entitlement_sync(p_user uuid,p_sandbox boolean,p_expires timestamptz,p_checked timestamptz)
returns void language sql security definer set search_path=public as $$
 insert into billing_entitlements(user_id,sandbox,expires_at,checked_at)
 select p_user,s,case when s=p_sandbox then p_expires else '1970-01-01'::timestamptz end,p_checked from unnest(array[false,true]) s
 on conflict(user_id,sandbox) do update set expires_at=excluded.expires_at,checked_at=excluded.checked_at
 where billing_entitlements.checked_at<=excluded.checked_at
$$;

do $$declare f record; begin
 for f in select oid::regprocedure signature from pg_proc where pronamespace='public'::regnamespace and proname like 'billing_%' loop
 execute format('revoke all on function %s from public, anon, authenticated',f.signature);
 execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;
grant execute on function public.billing_snapshot() to authenticated;
