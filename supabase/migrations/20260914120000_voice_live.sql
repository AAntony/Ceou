-- L'assistant vocal en conversation temps réel (Gemini Live).
--
-- DEUX CHOSES, ET RIEN D'AUTRE :
--
-- 1. UN ACCORD À PART. L'assistant actuel n'envoie à Google que le TEXTE de
--    la phrase ; la conversation temps réel envoie la VOIX elle-même, et les
--    résultats des recherches (noms d'objets, pièces, rangements) nécessaires
--    à chaque réponse. C'est un autre traitement : il demande un autre accord,
--    horodaté comme les deux précédents.
--
-- 2. UN PLAFOND QUOTIDIEN PAR COMPTE. L'audio se facture à la minute, l'app
--    est gratuite et le quota est partagé entre tous les comptes. La fonction
--    `voice-session` RÉSERVE une durée avant de délivrer un jeton Gemini, et
--    l'app rend en fin de session ce qu'elle n'a pas utilisé. Une session qui
--    ne rend jamais compte — app tuée, réseau coupé — reste comptée en entier :
--    c'est le défaut prudent.
--
-- Les réglages (durée d'une session, plafond du jour) vivent dans les secrets
-- de la fonction, pas ici : ils se changent sans migration ni mise à jour.

alter table public.profiles add column if not exists ai_voice_live_consent_at timestamptz;

create table public.voice_live_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Le jour du plafond est le jour UTC : il se remet à zéro à 2 h en été,
  -- 1 h en hiver, heure de Paris.
  day date not null default ((now() at time zone 'utc')::date),
  granted_seconds integer not null check (granted_seconds > 0),
  used_seconds integer check (used_seconds >= 0),
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create index voice_live_sessions_user_day on public.voice_live_sessions (user_id, day);

-- AUCUNE POLITIQUE : ni lecture ni écriture depuis l'app. Seule la fonction
-- Edge, avec la clé de service, passe par les deux fonctions ci-dessous. Un
-- compteur que l'utilisateur pourrait réécrire ne plafonnerait rien.
alter table public.voice_live_sessions enable row level security;
revoke all on public.voice_live_sessions from anon, authenticated;

-- Réserve une session, ou rien si le plafond du jour est atteint.
--
-- Le verrou consultatif sérialise deux ouvertures simultanées du même compte :
-- sans lui, deux appels lus en même temps verraient le même reste et
-- réserveraient chacun la totalité.
create function public.voice_live_reserve(
  p_user_id uuid,
  p_session_seconds integer,
  p_daily_seconds integer,
  p_min_seconds integer
)
returns table (session_id uuid, granted_seconds integer, remaining_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used integer;
  v_granted integer;
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('voice_live:' || p_user_id::text));

  select coalesce(sum(coalesce(s.used_seconds, s.granted_seconds)), 0) into v_used
  from voice_live_sessions s
  where s.user_id = p_user_id and s.day = (now() at time zone 'utc')::date;

  v_granted := least(p_session_seconds, p_daily_seconds - v_used);
  if v_granted < p_min_seconds then
    return;
  end if;

  insert into voice_live_sessions (user_id, granted_seconds)
  values (p_user_id, v_granted)
  returning id into v_id;

  return query select v_id, v_granted, p_daily_seconds - v_used - v_granted;
end;
$$;

-- Rend ce qui n'a pas servi. Une seule fois par session, et jamais plus que ce
-- qui avait été accordé : un client ne peut que s'appauvrir en mentant.
create function public.voice_live_settle(p_user_id uuid, p_session_id uuid, p_used_seconds integer)
returns void
language sql
security definer
set search_path = public
as $$
  update voice_live_sessions
  set used_seconds = least(greatest(p_used_seconds, 0), granted_seconds),
      ended_at = now()
  where id = p_session_id and user_id = p_user_id and used_seconds is null;
$$;

revoke all on function public.voice_live_reserve(uuid, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.voice_live_settle(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.voice_live_reserve(uuid, integer, integer, integer) to service_role;
grant execute on function public.voice_live_settle(uuid, uuid, integer) to service_role;
