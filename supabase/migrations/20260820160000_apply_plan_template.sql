-- Départs de plan : poser d'un coup les pièces d'un logement type.
--
-- POURQUOI : le moment le plus difficile d'un éditeur de plan est la page
-- blanche. Demander à quelqu'un de dessiner son logement rectangle par
-- rectangle, au doigt, écarte d'emblée une partie des utilisateurs — et
-- l'objectif énoncé est que ce soit faisable à tout âge. On part donc d'un
-- logement déjà construit qu'on ajuste, plutôt que d'une feuille vide.
--
-- POURQUOI UNE FONCTION plutôt que N insertions depuis le client : appliquer
-- un départ crée des Pièces ET des formes. À mi-chemin, un échec réseau
-- laisserait un plan à moitié posé, sans moyen simple de reprendre. Ici tout
-- part ensemble ou rien.
--
-- Le CLIENT porte la géométrie (p_rooms) : les gabarits se retouchent à l'œil
-- dans le code de l'app, pas dans une migration SQL.
create function public.apply_plan_template(p_plan_id uuid, p_rooms jsonb)
returns setof public.plan_formes
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_habitation_id uuid;
  v_room jsonb;
  v_piece_id uuid;
  v_name text;
begin
  select habitation_id into v_habitation_id from public.plans where id = p_plan_id;
  if v_habitation_id is null then
    raise exception 'plan_not_found';
  end if;

  -- Refus si le plan a déjà des formes : un départ ne s'applique qu'à un plan
  -- vierge. Sans ce garde-fou, un double appui sur le gabarit empilerait deux
  -- logements l'un sur l'autre.
  if exists (select 1 from public.plan_formes where plan_id = p_plan_id) then
    raise exception 'plan_not_empty';
  end if;

  for v_room in select * from jsonb_array_elements(p_rooms) loop
    v_name := btrim(v_room ->> 'name');

    -- On RÉUTILISE une pièce existante du même nom plutôt que d'en créer une
    -- deuxième : appliquer un départ sur une habitation déjà renseignée ne
    -- doit pas dédoubler « Cuisine » dans l'inventaire.
    select id into v_piece_id
    from public.pieces
    where habitation_id = v_habitation_id and lower(name) = lower(v_name)
    limit 1;

    if v_piece_id is null then
      insert into public.pieces (habitation_id, name, preset_key)
      values (v_habitation_id, v_name, nullif(v_room ->> 'preset_key', ''))
      returning id into v_piece_id;
    end if;

    return query
    insert into public.plan_formes (plan_id, shape_type, x, y, width, height, piece_id)
    values (
      p_plan_id,
      'rectangle',
      (v_room ->> 'x')::real,
      (v_room ->> 'y')::real,
      (v_room ->> 'width')::real,
      (v_room ->> 'height')::real,
      v_piece_id
    )
    returning *;
  end loop;
end;
$$;
