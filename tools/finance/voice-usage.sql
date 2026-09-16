-- Lecture seule. Supabase > SQL Editor > Run > export CSV.
-- Agrégats UTC, sans identifiant ni contenu de conversation.
-- Choisir des dates qui correspondent à la période étudiée (fin exclusive).
-- Les réservations non soldées ne sont PAS des minutes réellement consommées.
with monthly as (
  select to_char(created_at at time zone 'UTC', 'YYYY-MM') as month,
    count(*) as sessions,
    count(distinct user_id) as voice_users,
    count(*) filter (where used_seconds is not null) as settled_sessions,
    count(*) filter (where used_seconds is null) as unsettled_sessions,
    sum(used_seconds) filter (where used_seconds is not null) as reported_seconds,
    sum(granted_seconds) filter (where used_seconds is null) as unsettled_reserved_seconds
  from public.voice_live_sessions
  where created_at >= '2026-08-01T00:00:00Z'::timestamptz
    and created_at < '2026-10-01T00:00:00Z'::timestamptz
  group by 1
)
select month, sessions, voice_users, settled_sessions, unsettled_sessions,
  round(reported_seconds / 60.0, 2) as reported_voice_minutes,
  round(unsettled_reserved_seconds / 60.0, 2) as unsettled_reserved_minutes
from monthly order by month;
