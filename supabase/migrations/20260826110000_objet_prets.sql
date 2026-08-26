-- Prets et emprunts d'objets.
--
-- POURQUOI L'OBJET NE BOUGE PAS. Preter un objet ne le deplace pas : il garde
-- son emplacement. « Ou est-ce que ca vit » et « ou est-ce que c'est en ce
-- moment » sont deux questions differentes, et toute l'app est batie sur la
-- premiere. Deplacer l'objet chez l'emprunteur ferait perdre l'endroit ou le
-- ranger au retour — precisement ce que l'app existe pour savoir.
--
-- LES DEUX SENS DANS UNE SEULE TABLE. `direction` dit si je prete ou si
-- j'emprunte. Un objet EMPRUNTE est un objet normal de l'inventaire, pose la
-- ou on l'a mis : c'est ce qui permet de repondre a « ou j'ai mis la ponceuse
-- de Marc ? », qui est exactement ce que l'app sait faire. Il porte seulement
-- la marque qu'il n'est pas a nous, et il s'en va quand on le rend.
--
-- LE NOM EST TOUJOURS STOCKE, le lien vers un compte ne vient qu'en plus.
-- L'inverse — une cible qui est SOIT un ami SOIT un nom — paraissait plus
-- propre, mais un `on delete set null` sur le compte aurait vide la ligne de
-- son interlocuteur le jour ou cet ami supprime son compte : on aurait garde
-- « une perceuse pretee a personne ». Le nom survit, le lien est optionnel.
-- C'est aussi ce qui permet de preter a quelqu'un qui n'a pas l'app, ce qui
-- est le cas le plus frequent dans la vraie vie.
--
-- L'HISTORIQUE EST CONSERVE. Un pret rendu n'est pas supprime, il porte une
-- date de retour. « Je lui ai deja prete trois fois » est une information, et
-- elle ne coute rien a garder.

create table public.objet_prets (
  id uuid primary key default gen_random_uuid(),
  objet_id uuid not null references public.objets (id) on delete cascade,
  direction text not null check (direction in ('pret', 'emprunt')),
  -- Nom affiche, toujours renseigne : celui d'un ami au moment du pret, ou
  -- celui qu'on a tape pour quelqu'un qui n'a pas l'app.
  counterpart_label text not null check (btrim(counterpart_label) <> ''),
  -- Renseigne uniquement quand c'est un ami accepte (voir le trigger plus
  -- bas). Sa disparition ne fait perdre que le lien, jamais le nom.
  counterpart_user_id uuid references auth.users (id) on delete set null,
  started_at timestamptz not null default now(),
  due_at timestamptz,
  returned_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);

create index objet_prets_objet_idx on public.objet_prets (objet_id);
create index objet_prets_counterpart_idx on public.objet_prets (counterpart_user_id);
-- L'ecran « Prets » ne lit que les lignes ouvertes, et les trie par echeance :
-- l'index porte donc sur due_at et non sur returned_at, qui vaut null partout
-- dans cette portion et n'ordonnerait rien.
create index objet_prets_open_due_idx on public.objet_prets (due_at) where returned_at is null;

-- Un objet ne peut pas etre prete a deux personnes a la fois. Contrainte en
-- base et pas seulement dans l'ecran : deux appareils du meme foyer peuvent
-- preter le meme objet a la meme seconde.
create unique index objet_prets_one_open_per_objet on public.objet_prets (objet_id) where returned_at is null;

comment on column public.objet_prets.direction is
  'pret = je l''ai prete a quelqu''un ; emprunt = je l''ai emprunte a quelqu''un.';
comment on column public.objet_prets.returned_at is
  'NULL = pret en cours. Renseigne = rendu, la ligne devient de l''historique.';

-- === Qui est un ami ? ====================================================
-- Extrait ici parce que trois endroits en ont besoin (le garde-fou d'ecriture
-- ci-dessous, la resolution de profil, et probablement la suite) et qu'aucune
-- fonction ne repondait a cette question jusqu'a present.
create function public.is_accepted_friend(p_a uuid, p_b uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = p_a and f.addressee_id = p_b)
        or (f.requester_id = p_b and f.addressee_id = p_a))
  )
$$;

-- FAILLE FERMEE ICI. Sans ce garde-fou, n'importe qui pouvait ecrire
-- l'identifiant d'un inconnu dans counterpart_user_id, puis se faire rendre
-- son nom affiche et son avatar par list_objet_prets() — qui est
-- `security definer` et contourne donc la RLS de `profiles`, laquelle
-- restreint normalement la lecture a sa propre ligne. Le lien vers un compte
-- n'est accepte que vers un ami accepte ; pour tous les autres, il reste le
-- nom libre, qui ne revele rien.
create function public.objet_prets_check_counterpart()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.counterpart_user_id is not null then
    if new.counterpart_user_id = auth.uid() then
      raise exception 'cannot_lend_to_self';
    end if;
    if not public.is_accepted_friend(auth.uid(), new.counterpart_user_id) then
      raise exception 'counterpart_not_a_friend';
    end if;
  end if;
  return new;
end;
$$;

create trigger objet_prets_counterpart_guard
  before insert or update on public.objet_prets
  for each row execute function public.objet_prets_check_counterpart();

-- === RLS =================================================================
-- Meme forme exacte que objet_deplacements (migration 20260817100000) : on
-- remonte de l'objet a son Habitation, et on laisse has_habitation_access
-- trancher. Un ami qui partage l'Habitation voit donc les prets, comme il voit
-- deja les objets et leur historique.

alter table public.objet_prets enable row level security;

create policy "objet_prets_select" on public.objet_prets
  for select using (
    exists (
      select 1 from public.objets o
      where o.id = objet_id
        and public.has_habitation_access(public.location_habitation(o.parent_emplacement_id, o.parent_conteneur_id), auth.uid(), 'consultation')
    )
  );

create policy "objet_prets_write" on public.objet_prets
  for all
  using (
    exists (
      select 1 from public.objets o
      where o.id = objet_id
        and public.has_habitation_access(public.location_habitation(o.parent_emplacement_id, o.parent_conteneur_id), auth.uid(), 'modification')
    )
  )
  with check (
    exists (
      select 1 from public.objets o
      where o.id = objet_id
        and public.has_habitation_access(public.location_habitation(o.parent_emplacement_id, o.parent_conteneur_id), auth.uid(), 'modification')
    )
  );

-- === Lecture de l'ecran « Prets » ========================================
-- Une fonction plutot qu'un select direct, pour la meme raison que
-- list_my_share_invites : l'ecran a besoin du NOM de l'objet et du nom a jour
-- de l'ami, ce qui ferait sinon une requete par ligne.
--
-- Le nom affiche est rafraichi UNIQUEMENT pour un ami accepte ; sinon on rend
-- l'instantane stocke. Un ami qui se renomme apparait donc sous son nouveau
-- nom, et personne d'autre n'est resolu.
create function public.list_objet_prets(p_include_closed boolean default false)
returns table (
  id uuid,
  objet_id uuid,
  objet_name text,
  objet_photo_url text,
  direction text,
  counterpart_label text,
  counterpart_user_id uuid,
  counterpart_avatar_url text,
  started_at timestamptz,
  due_at timestamptz,
  returned_at timestamptz,
  note text
)
language sql stable security definer set search_path = public as $$
  select
    pr.id,
    pr.objet_id,
    o.name as objet_name,
    o.photo_url as objet_photo_url,
    pr.direction,
    coalesce(friend.display_name, pr.counterpart_label) as counterpart_label,
    pr.counterpart_user_id,
    friend.avatar_url as counterpart_avatar_url,
    pr.started_at,
    pr.due_at,
    pr.returned_at,
    pr.note
  from public.objet_prets pr
  join public.objets o on o.id = pr.objet_id
  left join public.profiles friend
    on friend.id = pr.counterpart_user_id
   and public.is_accepted_friend(auth.uid(), pr.counterpart_user_id)
  where public.has_habitation_access(
          public.location_habitation(o.parent_emplacement_id, o.parent_conteneur_id),
          auth.uid(),
          'consultation')
    and (p_include_closed or pr.returned_at is null)
  -- Les retards d'abord, puis les echeances les plus proches. Une ligne sans
  -- date de retour prevue ferme la marche : elle n'est jamais urgente.
  order by
    pr.returned_at nulls first,
    (pr.due_at is null),
    pr.due_at asc,
    pr.started_at desc
$$;
