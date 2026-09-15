# Plans : exploration visuelle

La direction proposée dans `prototypes/plans-direction.html` est intégrée à l'application.

- Cartes avec aperçu agrandi ; modification, suppression (dans le formulaire) et ordre des étages derrière « Options du plan ».
- Étages en haut et action secondaire « Modifier ». Les commandes de consultation sont hors du dessin.
- Noms réellement mesurés à la taille de texte de l'application et du système. Placement dans les limites de la pièce, sans collision ; un numéro renvoie à la légende quand le nom ne tient pas. À très faible zoom, un repère peut lui aussi être masqué : la liste conserve toutes les pièces.
- Sélection d'une pièce : cadrage rapproché, rangements numérotés selon leur position et noms complets dans une liste défilante. Les positions enregistrées ne sont jamais déplacées pour arranger l'affichage. Les repères superposés restent accessibles par la liste.
- La fermeture revient à la vue d'ensemble. « Voir sur le plan » conserve le repère du rangement recherché. La vue descriptive accessible et les outils d'édition restent disponibles selon les droits existants.
- Aucun changement de schéma, de droits ni de données d'inventaire.

## Aperçu web

Le moteur CanvasKit doit être chargé avant le module de dessin. `PlanCanvas.web.tsx` assure cet ordre ; le composant natif utilise directement le même dessin. `npm run web` prépare le fichier WASM depuis la dépendance installée, sans CDN. Pour un export web manuel, lancer `node scripts/setup-plan-web.mjs` avant `expo export --platform web`.

## Vérifications

Tests de placement : noms longs, grandes polices, collisions, zoom et numérotation stable. Contrôle local à largeur mobile : aperçu, sélection d'une pièce, correspondance des numéros et retour à l'ensemble. Les gestes natifs et TalkBack restent à valider sur le téléphone Android.

Parcours de validation : Lieux → habitation → Plans ; ouvrir un niveau, sélectionner une pièce, ouvrir un rangement, revenir et changer d'étage. Vérifier aussi l'édition sur un plan de test, les thèmes clair/sombre et une taille de texte agrandie.
