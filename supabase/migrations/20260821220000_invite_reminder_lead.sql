-- Délai de rappel avant expiration, choisi PAR CODE.
--
-- Pourquoi par code et pas un réglage global : les codes invité vont de 1 à
-- 3650 jours. « Prévenir 3 jours avant » n'a aucun sens pour un code de 2
-- jours, et ne veut rien dire pour un code d'un an. Il n'existe pas de bonne
-- valeur unique, donc la valeur vit avec le code.
--
-- Le rappel lui-même est une notification LOCALE programmée sur l'appareil
-- du créateur — il n'y a donc ni tâche planifiée ni envoi serveur ici. Cette
-- colonne n'est que l'intention de l'utilisateur, rendue durable : c'est
-- elle qui permet de reprogrammer le rappel après une réinstallation, ou de
-- le recalculer quand un code est renouvelé.
--
-- Le serveur ne décide PAS si le rappel est pertinent (date déjà passée,
-- code épuisé) : c'est l'appareil qui programme, donc c'est lui qui tranche
-- au moment de le faire, avec l'heure qu'il a réellement.

alter table public.share_invites add column remind_days_before int;

comment on column public.share_invites.remind_days_before is
  'Nombre de jours avant expires_at ou l''appareil du createur programme un rappel local. NULL = aucun rappel.';

-- Rétrocompatibilité pour les codes déjà créés. La règle proportionnelle
-- (un cinquième de la durée de vie, plancher 1 jour, plafond 7) n'est écrite
-- ici QUE pour ce remplissage ponctuel : côté vivant, c'est le client qui
-- pré-remplit le champ, et le serveur se contente de valider ce qu'il reçoit.
update public.share_invites
set remind_days_before = case
  when target_type = 'friend' then 1
  else greatest(1, least(7, round(extract(epoch from (expires_at - created_at)) / 86400.0 * 0.2)::int))
end
where expires_at is not null;

-- === Création ============================================================
-- DROP + CREATE : on ajoute un paramètre, `create or replace` ne sait pas
-- changer une liste d'arguments.
drop function public.create_share_invite(uuid[], text, text, int, timestamptz, text);

create function public.create_share_invite(
  p_habitation_ids uuid[],
  p_permission text,
  p_target_type text,
  p_max_uses int default 1,
  p_expires_at timestamptz default null,
  p_label text default null,
  p_remind_days_before int default null
)
returns public.share_invites
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_row public.share_invites;
  v_hid uuid;
  v_max_uses int := p_max_uses;
  v_expires_at timestamptz := p_expires_at;
  v_remind int;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;
  if public.is_anonymous() then
    raise exception 'not_authenticated';
  end if;
  if array_length(p_habitation_ids, 1) is null or array_length(p_habitation_ids, 1) = 0 then
    raise exception 'no_habitations_selected';
  end if;

  foreach v_hid in array p_habitation_ids loop
    if not public.can_manage_habitation_sharing(v_hid, v_me) then
      raise exception 'not_authorized_for_habitation';
    end if;
  end loop;

  if p_target_type = 'guest' then
    -- Un invité n'a jamais que la consultation : forcé ici plutôt que de
    -- faire confiance au client, qui pourrait envoyer autre chose.
    p_permission := 'consultation';
  else
    -- Une invitation d'ami désigne UNE personne : ni multi-usage, ni
    -- permanente. Valeurs forcées pour que l'écran d'invité ne puisse pas
    -- fabriquer par erreur un code d'ami illimité.
    v_max_uses := 1;
    v_expires_at := coalesce(p_expires_at, now() + interval '7 days');
  end if;

  if v_max_uses is not null and v_max_uses < 1 then
    raise exception 'invalid_max_uses';
  end if;
  if v_expires_at is not null and v_expires_at <= now() then
    raise exception 'invalid_expiry';
  end if;

  -- Un code d'ami dure toujours 7 jours et n'expose aucun réglage de durée :
  -- lui ajouter un champ de rappel serait le tout premier réglage temporel
  -- d'un formulaire qui n'en a aucun. Valeur fixe à la veille.
  -- Un code permanent, lui, n'expire pas : rien à rappeler.
  if p_target_type = 'friend' then
    v_remind := 1;
  elsif v_expires_at is null then
    v_remind := null;
  else
    v_remind := greatest(1, least(3650, coalesce(p_remind_days_before, 1)));
  end if;

  insert into public.share_invites (
    code, created_by, habitation_ids, permission, target_type, max_uses, expires_at, label,
    remind_days_before
  )
  values (
    public.generate_invite_code(), v_me, p_habitation_ids, p_permission, p_target_type,
    v_max_uses, v_expires_at, nullif(btrim(coalesce(p_label, '')), ''),
    v_remind
  )
  returning * into v_row;

  return v_row;
end;
$$;

-- === Renouvellement ======================================================
drop function public.update_share_invite(uuid, int, timestamptz, boolean, text);

create function public.update_share_invite(
  p_invite_id uuid,
  p_max_uses int,
  p_expires_at timestamptz,
  p_reset_uses boolean default false,
  p_label text default null,
  p_remind_days_before int default null
)
returns public.share_invites
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_row public.share_invites;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;
  if p_max_uses is not null and p_max_uses < 1 then
    raise exception 'invalid_max_uses';
  end if;
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'invalid_expiry';
  end if;

  update public.share_invites
  set max_uses = p_max_uses,
      expires_at = p_expires_at,
      label = nullif(btrim(coalesce(p_label, '')), ''),
      -- Prolonger un code sans expiration efface son rappel : il n'y a plus
      -- de date à anticiper. Le rétablir plus tard reprogrammera tout, le
      -- rappel étant recalculé à partir de cette colonne à chaque passage.
      remind_days_before = case
        when p_expires_at is null then null
        else greatest(1, least(3650, coalesce(p_remind_days_before, remind_days_before, 1)))
      end,
      -- Remettre le compteur à zéro rouvre le code à de nouveaux visiteurs
      -- SANS toucher aux utilisations déjà enregistrées : ceux qui sont
      -- déjà entrés gardent leur accès, ils ne comptent simplement plus
      -- dans le quota. C'est le sens de « renouveler » pour une location
      -- qui accueille les occupants suivants.
      use_count = case when p_reset_uses then 0 else use_count end
  where id = p_invite_id and created_by = v_me
  returning * into v_row;

  if not found then
    raise exception 'invite_not_found';
  end if;

  return v_row;
end;
$$;

-- === Liste ===============================================================
-- DROP + CREATE là encore : la table de retour gagne une colonne.
drop function public.list_my_share_invites();

create function public.list_my_share_invites()
returns table (
  id uuid,
  code text,
  label text,
  target_type text,
  permission text,
  habitation_ids uuid[],
  habitation_names text[],
  max_uses int,
  use_count int,
  expires_at timestamptz,
  remind_days_before int,
  created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select
    i.id, i.code, i.label, i.target_type, i.permission, i.habitation_ids,
    array(
      select h.name from public.habitations h
      where h.id = any (i.habitation_ids)
      order by h.name
    ) as habitation_names,
    i.max_uses, i.use_count, i.expires_at, i.remind_days_before, i.created_at
  from public.share_invites i
  where i.created_by = auth.uid()
  order by i.created_at desc
$$;
