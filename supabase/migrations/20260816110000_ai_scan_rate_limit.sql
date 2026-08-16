-- Limite le débit de scans IA par utilisateur — protège le quota Gemini
-- PARTAGÉ entre tous les utilisateurs (une seule clé API, voir Edge Function
-- detect-objects) contre un utilisateur qui spammerait le scan et grillerait
-- le tier gratuit pour tout le monde. Aucune policy client (ni select, ni
-- insert, ni update) : seule la fonction ci-dessous (security definer) peut
-- toucher cette table, appelée uniquement depuis l'Edge Function.
create table public.ai_scan_rate_limit (
  user_id uuid primary key references auth.users (id) on delete cascade,
  last_request_at timestamptz not null default now()
);

alter table public.ai_scan_rate_limit enable row level security;

-- Vérifie ET met à jour l'horodatage en une seule opération atomique (le
-- verrou de ligne via `for update` évite qu'une requête concurrente du même
-- utilisateur passe entre deux lectures). Retourne true si la requête est
-- autorisée (et l'horodatage est alors avancé), false si elle doit être
-- rejetée (l'horodatage n'est PAS touché, pour ne pas repousser sans cesse
-- la fenêtre si l'utilisateur reste bloqué en boucle).
create or replace function public.check_and_touch_ai_scan_rate_limit(p_user_id uuid, p_cooldown_seconds int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last timestamptz;
begin
  select last_request_at into v_last from ai_scan_rate_limit where user_id = p_user_id for update;

  if v_last is null then
    insert into ai_scan_rate_limit (user_id, last_request_at) values (p_user_id, now());
    return true;
  end if;

  if now() - v_last < make_interval(secs => p_cooldown_seconds) then
    return false;
  end if;

  update ai_scan_rate_limit set last_request_at = now() where user_id = p_user_id;
  return true;
end;
$$;
