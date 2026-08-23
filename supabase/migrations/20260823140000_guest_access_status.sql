-- Pourquoi un visiteur ne voit plus rien.
--
-- L'accès d'un invité est DÉRIVÉ de son code (cf. 20260820120000) : rien
-- n'est matérialisé en partage, donc quand le code expire ou que l'hôte le
-- supprime, l'accès s'éteint à la seconde près et l'app devient simplement
-- vide. Vide et muette : le visiteur n'a aucun moyen de savoir s'il a mal
-- saisi le code, si son hôte a tout retiré, ou si l'app est cassée.
--
-- Cette fonction dit laquelle des trois. Elle est `security definer` parce
-- que c'est le seul moyen honnête de répondre : un visiteur n'a pas le droit
-- de lire share_invites, et lui ouvrir cette table pour un simple message
-- d'interface reviendrait à exposer les codes des autres. Elle ne renvoie
-- rien d'autre que ce qui concerne l'appelant, et rien qui puisse servir à
-- entrer quelque part (ni code, ni identité de l'hôte).
--
-- 'revoked' se déduit d'une ABSENCE : share_invite_redemptions cascade sur
-- la suppression du code, donc un visiteur dont la ligne d'utilisation a
-- disparu est quelqu'un dont le code a été supprimé. C'est indirect mais
-- c'est la seule trace qui reste, et par construction elle est fiable : une
-- session anonyme n'existe QUE parce qu'un code a été utilisé.
create or replace function public.my_guest_access_status()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with mine as (
    select i.expires_at
    from public.share_invite_redemptions r
    join public.share_invites i on i.id = r.invite_id
    where r.user_id = auth.uid()
      and i.target_type = 'guest'
  )
  select jsonb_build_object(
    'status',
    case
      -- Un seul code encore valable suffit : plusieurs hôtes peuvent avoir
      -- invité la même personne.
      when exists (select 1 from mine where expires_at is null or expires_at > now()) then 'active'
      when exists (select 1 from mine) then 'expired'
      when public.is_anonymous() then 'revoked'
      -- Un compte normal sans aucun code utilisé n'est pas un invité : il
      -- n'a rien perdu, il n'a jamais rien reçu par ce chemin.
      else 'none'
    end,
    -- La plus lointaine des dates passées : c'est celle qui a réellement mis
    -- fin à l'accès, les codes plus anciens s'étaient éteints avant.
    'expires_at', (select max(expires_at) from mine)
  )
$$;
