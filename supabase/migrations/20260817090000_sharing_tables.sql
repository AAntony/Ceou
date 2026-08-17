-- Phase 8a (partage d'Habitation) — fondations de données, partie 1/3 :
-- tables + code ami. Purement additif, ne touche à AUCUNE policy existante
-- ni à AUCUNE table déjà en usage : zéro risque de régression, rien ne lit
-- encore ces nouvelles tables tant que la partie 2 (RLS) n'est pas appliquée.

-- === Code ami =========================================================

alter table public.profiles add column friend_code text;

-- Alphabet volontairement sans caractères ambigus à l'oral/à l'écrit
-- (pas de 0/O, 1/I/L) — ce code est fait pour être dicté/tapé à la main.
create function public.generate_friend_code()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..8 loop
      code := code || substr(chars, floor(random() * length(chars))::int + 1, 1);
    end loop;
    exit when not exists (select 1 from public.profiles where friend_code = code);
  end loop;
  return code;
end;
$$;

update public.profiles set friend_code = public.generate_friend_code() where friend_code is null;

alter table public.profiles add constraint profiles_friend_code_key unique (friend_code);
alter table public.profiles alter column friend_code set not null;

-- Étend le trigger de création de profil existant (pas de second trigger).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, locale, friend_code)
  values (new.id, 'fr', public.generate_friend_code());
  return new;
end;
$$;

-- === Amis & groupes ====================================================

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users (id) on delete cascade,
  addressee_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  source_invite_id uuid,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> addressee_id)
);

-- Une seule relation par paire, peu importe le sens (A->B et B->A comptent
-- comme la même relation).
create unique index friendships_pair_idx on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index friendships_addressee_idx on public.friendships (addressee_id);

create table public.friend_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.friend_group_members (
  group_id uuid not null references public.friend_groups (id) on delete cascade,
  friend_user_id uuid not null references auth.users (id) on delete cascade,
  primary key (group_id, friend_user_id)
);

create index friend_group_members_friend_idx on public.friend_group_members (friend_user_id);

-- === Partage d'Habitation ==============================================

create table public.habitation_shares (
  id uuid primary key default gen_random_uuid(),
  habitation_id uuid not null references public.habitations (id) on delete cascade,
  shared_with_user_id uuid references auth.users (id) on delete cascade,
  shared_with_group_id uuid references public.friend_groups (id) on delete cascade,
  permission text not null check (permission in ('consultation', 'modification', 'proprietaire')),
  shared_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint habitation_shares_exactly_one_target check (
    (shared_with_user_id is not null)::int + (shared_with_group_id is not null)::int = 1
  )
);

create index habitation_shares_habitation_idx on public.habitation_shares (habitation_id);
create index habitation_shares_user_idx on public.habitation_shares (shared_with_user_id);
create index habitation_shares_group_idx on public.habitation_shares (shared_with_group_id);

-- Un utilisateur (ou un groupe) n'a qu'une seule ligne de partage par
-- Habitation — modifier son droit met à jour la ligne existante plutôt que
-- d'en empiler une nouvelle. Deux index partiels car `unique` ne peut pas
-- porter sur une colonne nullable de façon utile ici (on veut l'unicité
-- seulement parmi les lignes qui ciblent CETTE colonne).
create unique index habitation_shares_unique_user on public.habitation_shares (habitation_id, shared_with_user_id) where shared_with_user_id is not null;
create unique index habitation_shares_unique_group on public.habitation_shares (habitation_id, shared_with_group_id) where shared_with_group_id is not null;

-- === Invitations éphémères (Partager mon code / Inviter un invité) ====

create table public.share_invites (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  created_by uuid not null references auth.users (id) on delete cascade,
  habitation_ids uuid[] not null,
  permission text not null check (permission in ('consultation', 'modification', 'proprietaire')),
  target_type text not null check (target_type in ('friend', 'guest')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  redeemed_by uuid references auth.users (id),
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);

create index share_invites_created_by_idx on public.share_invites (created_by);

alter table public.friendships add constraint friendships_source_invite_fkey foreign key (source_invite_id) references public.share_invites (id) on delete set null;
