-- Le compteur affiché sous le nom d'un ami ne compte plus QUE ce que JE lui
-- ai ouvert.
--
-- La version du 21/08 additionnait les deux sens (« ce qu'il y a entre
-- nous »). À l'usage c'est trompeur : la phrase se lit « X habitations
-- partagées » sous MON ami, donc on comprend « je lui en ai ouvert X » — et
-- une habitation que LUI m'a ouverte gonflait le chiffre sans que rien de ce
-- que je possède ne soit concerné. Impossible, en regardant la liste, de
-- savoir ce qu'on a soi-même exposé.
--
-- Ce que l'ami m'a partagé reste consultable, mais là où c'est sans
-- ambiguïté : la section « Partagé avec moi » de sa fiche, et l'onglet
-- Partagées de l'écran Habitations.
--
-- Signature de retour inchangée, donc CREATE OR REPLACE suffit ici (pas de
-- DROP préalable comme il en a fallu pour les RPC d'invitation).
create or replace function public.friend_shared_habitation_counts()
returns table (friend_user_id uuid, habitation_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select s.shared_with_user_id, count(distinct s.habitation_id)::bigint
  from public.habitation_shares s
  join public.habitations h on h.id = s.habitation_id
  where h.user_id = auth.uid()
    and s.shared_with_user_id is not null
  group by s.shared_with_user_id
$$;
