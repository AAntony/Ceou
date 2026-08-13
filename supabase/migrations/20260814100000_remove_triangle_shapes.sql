-- Le triangle a été retiré des formes de plan disponibles (aucune valeur
-- ajoutée par rapport à rectangle/cercle) — nettoie les instances déjà
-- créées, plutôt que de laisser des formes orphelines que l'app ne sait
-- plus dessiner.
delete from public.plan_formes where shape_type = 'triangle';
