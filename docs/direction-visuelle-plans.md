# Proposition : les plans comme accès visuel à l’inventaire

## Constat sur les captures

La miniature repose sur un enfant `flex: 1` dans un parent de 56 × 60 qui centre ses enfants. Sans largeur explicite, le contenu uniquement positionné en absolu peut mesurer zéro en largeur. Le correctif donne 100 % de largeur et de hauteur au composant, pour les plans remplis comme vides. À confirmer sur Android.

Les étiquettes du canevas tentent le haut puis le bas de chaque pièce. Quand ces deux bandes contiennent un rangement, le rendu revient en haut malgré la collision. Les cartes des rangements et les noms des pièces se disputent donc le même espace. Une nouvelle palette seule ne suffirait pas.

## Direction proposée (maquette, pas encore intégrée au canevas)

Voir `docs/prototypes/plans-direction.html` : sélectionner Bureau ou une autre pièce dans le plan central modifie la fiche. Les autres commandes représentent la disposition future et ne modifient aucune donnée.

1. Liste des étages : aperçu complet sur une carte, nom et nombre de pièces dessous, menu discret pour renommer/réordonner/supprimer. Le plan est identifiable avant de l’ouvrir.
2. Vue d’ensemble : fond minéral clair, couleurs désaturées, traits fins, noms des pièces prioritaires. Une zone trop étroite reçoit un numéro avec son nom complet dans une légende. Aucun rétrécissement illimité du texte pour tout faire tenir.
3. Pièce sélectionnée : cadrage sur la pièce, repères de rangements numérotés à leur position réelle, noms complets et actions dans une fiche basse défilante. L’ouverture d’un rangement mène toujours à son inventaire.
4. Navigation : choix d’étage en haut, accès Modifier secondaire, recentrage discret, vue liste accessible. Les outils de dessin n’apparaissent que pendant l’édition.

La maquette utilise des géométries et données de démonstration inspirées des captures ; elle n’est ni un relevé architectural exact ni une version fonctionnelle du moteur de plans.

## Intégration à réaliser après choix de la direction

- Conserver les coordonnées, formes, portes, pincement/zoom et droits actuels.
- Remplacer les deux bandes d’étiquettes par un placement tenant compte des dimensions mesurées et des collisions. Si aucune zone ne convient, employer le repère et sa légende ; ne jamais dessiner une étiquette par-dessus une autre.
- Préserver les portes et les couleurs attribuées aux pièces ; proposer leur traduction désaturée pour la vue d’exploration, avec une sélection bleue suffisamment contrastée.
- Décliner clair/sombre et tailles de texte, y compris 200 %. Les informations masquées dans le dessin restent disponibles dans la liste et au lecteur d’écran.
- Vérifier sur Android à 360 et 390 points, sur un plan dense et des noms longs. Tester ensuite déplacement de pièce, porte, rangement, recherche et navigation vers un objet.

## Références

- [Apple HIG — Maps](https://developer.apple.com/design/human-interface-guidelines/maps) : hiérarchie cartographique et carte intégrée au langage visuel de l’application.
- [Apple — Adding Indoor Maps to your App and Website](https://developer.apple.com/videos/play/wwdc2019/241/) : distinction des pièces, points d’intérêt et niveaux. Inspiration de structure, sans intégration de MapKit ni dépendance supplémentaire.

Vérification du correctif de miniature : `npm run verify:ci` réussi (54 tests, 30 avertissements existants). Maquette consultée et sélection d’une pièce vérifiée dans le navigateur ; rendu natif du correctif encore à confirmer sur téléphone.
