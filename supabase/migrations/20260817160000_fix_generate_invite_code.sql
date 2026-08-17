-- Correction de bug : generate_invite_code() déclarait une variable locale
-- `code`, alors que share_invites a AUSSI une colonne `code` — la clause
-- `where code = code` de la vérification d'unicité était donc ambiguë pour
-- Postgres (il ne sait pas si chaque `code` désigne la variable ou la
-- colonne), ce qui faisait échouer TOUTE tentative de "Partager mon code"/
-- "Inviter un invité" avec l'erreur "column reference \"code\" is
-- ambiguous" (confirmé en testant en direct : create_share_invite → 400).
-- Renommer la variable en `v_code` (même convention que le reste du
-- fichier) lève l'ambiguïté sans changer le comportement.
create or replace function public.generate_invite_code()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
begin
  loop
    v_code := '';
    for i in 1..10 loop
      v_code := v_code || substr(chars, floor(random() * length(chars))::int + 1, 1);
    end loop;
    exit when not exists (select 1 from public.share_invites where code = v_code);
  end loop;
  return v_code;
end;
$$;
