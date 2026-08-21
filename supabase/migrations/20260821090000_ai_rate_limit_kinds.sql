-- Limitation de débit IA : un compteur PAR USAGE, plus un seul global.
--
-- La table ne portait qu'un horodatage par utilisateur, pensé pour le scan
-- photo. L'assistant vocal arrive et partagerait ce même compteur : demander
-- « où sont mes clés » bloquerait un scan photo pendant 30 secondes, et
-- inversement. Deux usages sans rapport, deux rythmes très différents.
--
-- La clé devient (user_id, kind). L'ancienne fonction est conservée en
-- passe-plat vers la nouvelle : detect-objects continue de fonctionner sans
-- redéploiement.

alter table public.ai_scan_rate_limit add column kind text not null default 'scan';

alter table public.ai_scan_rate_limit drop constraint ai_scan_rate_limit_pkey;
alter table public.ai_scan_rate_limit add primary key (user_id, kind);

comment on column public.ai_scan_rate_limit.kind is
  'Usage limite : ''scan'' (detection photo) ou ''voice'' (assistant vocal).';

create or replace function public.check_and_touch_ai_rate_limit(
  p_user_id uuid,
  p_kind text,
  p_cooldown_seconds int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last timestamptz;
begin
  -- `for update` verrouille la ligne pour toute la transaction : sans lui,
  -- deux requêtes simultanées du même utilisateur liraient toutes les deux un
  -- horodatage périmé et passeraient toutes les deux.
  select last_request_at into v_last
  from ai_scan_rate_limit
  where user_id = p_user_id and kind = p_kind
  for update;

  if v_last is null then
    insert into ai_scan_rate_limit (user_id, kind, last_request_at)
    values (p_user_id, p_kind, now());
    return true;
  end if;

  -- Refus SANS toucher l'horodatage : le repousser à chaque tentative
  -- rejetée enfermerait un utilisateur insistant dans un blocage sans fin.
  if now() - v_last < make_interval(secs => p_cooldown_seconds) then
    return false;
  end if;

  update ai_scan_rate_limit set last_request_at = now()
  where user_id = p_user_id and kind = p_kind;
  return true;
end;
$$;

-- Passe-plat : detect-objects appelle toujours l'ancien nom.
create or replace function public.check_and_touch_ai_scan_rate_limit(p_user_id uuid, p_cooldown_seconds int)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.check_and_touch_ai_rate_limit(p_user_id, 'scan', p_cooldown_seconds)
$$;
