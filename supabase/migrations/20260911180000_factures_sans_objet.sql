-- Une facture dont le dernier objet disparaissait devenait INTROUVABLE.
--
-- LE DÉFAUT, ET POURQUOI IL ÉTAIT SILENCIEUX. `facture_objets.objet_id` est
-- en `on delete cascade` : supprimer un objet efface ses liaisons. Une facture
-- qui ne couvrait que cet objet-là survivait donc sans plus aucune liaison —
-- et les trois fonctions qui la font remonter à l'écran passent TOUTES par
-- une jointure sur les objets (factures_for_habitation, factures_export_rows,
-- et la requête de la fiche d'un objet). Elle n'apparaissait donc nulle part :
-- ni lisible, ni modifiable, ni supprimable, son fichier restant dans le
-- bucket. On se débarrasse d'un objet, on perd en silence la preuve de ce
-- qu'il valait.
--
-- La migration d'origine énonçait pourtant l'invariant : « ELLE NAÎT TOUJOURS
-- D'UN OBJET. Il n'y a pas de facture orpheline. » Le raisonnement était bon,
-- sa prémisse fausse — rien ne l'empêchait. Ce déclencheur l'impose vraiment.
--
-- POURQUOI SUPPRIMER PLUTÔT QUE RENDRE VISIBLE. Une facture orpheline
-- n'appartient à aucun logement (le sien se déduit de ses objets, il n'est
-- stocké nulle part), donc aucun dossier ne peut l'accueillir : la rendre
-- visible demanderait une surface nouvelle, pour des lignes que personne n'a
-- demandé à garder. Une ligne invisible ET indestructible est strictement pire
-- qu'une ligne absente. L'app prévient, elle, avant de supprimer un objet qui
-- porte des preuves d'achat — la perte est annoncée, pas subie.
--
-- CE QU'IL FAUT SAVOIR, ET QUI EST ASSUMÉ : un ami en modification peut
-- supprimer un objet, donc déclencher la suppression d'une facture qui
-- appartient au PROPRIÉTAIRE, sans que celui-ci en soit averti. C'est déjà
-- vrai de l'objet lui-même, qui est autrement plus lourd à perdre ; la preuve
-- suit la chose qu'elle prouve. Prévenir le propriétaire demanderait une
-- notification serveur — pas fait, et signalé.
create or replace function public.purge_facture_sans_objet()
returns trigger
language plpgsql
-- `security definer`, ET C'EST INDISPENSABLE ICI. La suppression peut être
-- déclenchée par quelqu'un qui n'est pas le propriétaire de la facture (un
-- ami en modification qui supprime un objet). En droits d'appelant, la RLS de
-- `factures` refuserait la suppression sans rien dire — et laisserait
-- exactement l'orpheline que ce déclencheur existe pour empêcher.
--
-- La portée reste étroite : la ligne visée vient d'être privée de sa dernière
-- liaison dans la même commande, il n'y a aucun autre moyen d'atteindre cette
-- fonction.
security definer
set search_path = public
as $$
begin
  delete from public.factures f
  where f.id = old.facture_id
    and not exists (select 1 from public.facture_objets fo where fo.facture_id = f.id);
  return null;
end;
$$;

-- APRÈS, ET LIGNE PAR LIGNE. Supprimer un objet efface d'un coup plusieurs
-- liaisons, chacune vers une facture différente : il faut examiner chacune.
--
-- Supprimer une FACTURE fait aussi cascader ses liaisons et déclenche donc
-- cette fonction — qui ne trouve alors plus rien à supprimer, la ligne étant
-- déjà partie dans la même commande. Pas de récursion.
drop trigger if exists facture_objets_purge on public.facture_objets;

create trigger facture_objets_purge
  after delete on public.facture_objets
  for each row
  execute function public.purge_facture_sans_objet();

-- Le ménage de ce qui a déjà été orphelin avant ce correctif. Ces lignes
-- n'apparaissaient déjà nulle part dans l'application : les supprimer ne fait
-- disparaître rien de visible.
delete from public.factures f
where not exists (select 1 from public.facture_objets fo where fo.facture_id = f.id);
