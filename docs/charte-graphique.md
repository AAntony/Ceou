# Charte graphique Céoù

## Intention

Une interface calme et chaleureuse, qui met les objets et leurs photos au premier plan. La couleur indique une action ou un état. Les contrôles restent reconnaissables dans les thèmes clair et sombre.

## Couleurs et rôles

- Bleu plein : action principale, texte blanc. Une priorité visuelle par groupe d’actions.
- Bleu léger et contour bleu : sélection active dans un groupe de choix.
- Surface neutre et contour discret : action secondaire, jamais présentée comme déjà sélectionnée.
- Texte seul : action tertiaire ou annulation.
- Rouge : erreur ou suppression, toujours accompagné d’un libellé explicite.
- Texte principal `ink`, secondaire `inkSoft`, fond de page `sand`, cartes et champs `surface`.

La palette actuelle est conservée. Les noms techniques historiques `coral` correspondent au bleu de marque ; ne pas introduire une seconde palette pour les nouveaux écrans. Les valeurs JavaScript et CSS doivent rester synchronisées.

## Typographie et espacements

Utiliser les rôles existants : title pour un titre d’écran, heading pour une section, body pour le contenu, label pour un contrôle et caption pour une information complémentaire. Le nom d’un objet ne doit pas devenir une légende minuscule pour gagner de la place.

Espacements sur une grille de 4 points : 8 entre éléments liés, 12 à 16 à l’intérieur des cartes, 16 à 24 entre sections. Contrôles arrondis à 12, cartes et groupes à 16. Les pastilles sont réservées aux actions compactes et filtres.

## Composants de référence

- `Button` : variantes primary, outline neutre, ghost, danger et tile. Contenu centré, hauteur minimale de 48, texte multiligne autorisé.
- `SegmentedTabs` : choix réunis dans un fond commun ; seul l’onglet actif porte l’accent. Empilement conservé avec grandes polices.
- `TextField` : fond de surface, contour neutre au repos, bleu au focus, rouge en erreur. La bordure garde la même épaisseur pour éviter un saut de mise en page.
- `HeaderAddButton` : pastille compacte commune aux en-têtes, avec libellé accessible contextuel.
- Actions iconographiques : icône de la bibliothèque existante et libellé visible, sans emoji décoratif. Répartition uniforme de la largeur ; défilement si nécessaire pour conserver des cibles confortables.
- Photos : recadrage homogène dans les listes ; le contrôle pour changer une photo doit être identifiable séparément de l’ouverture de la fiche.

## Validation de l’étape 2

Comparer Lieux, formulaires et boutons secondaires en clair et sombre. Vérifier grandes polices, sélection des onglets, focus et erreurs de saisie. Les contrastes de la palette sont contrôlés automatiquement ; la validation native des lecteurs d’écran appartient à l’étape 4.
