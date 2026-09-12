# Céoù — audit produit, design et accessibilité

Date : 12 septembre 2026. Base Git examinée : `42076a3`.

## Conclusion

Céoù possède déjà un socle fonctionnel riche. Sa meilleure promesse est « Je retrouve ce dont j’ai besoin, là où je suis ». La refonte doit donner la priorité au lieu et à la réponse, réduire l’effort de rangement, puis révéler les fonctions de gestion selon le contexte. Une simple nouvelle palette ne suffirait pas.

Publics précisés par le porteur : adolescents, adultes et personnes âgées, entreprises et locations Airbnb. Application en test auprès d’amis, sans production ; identité visuelle entièrement ouverte. Recommandation : un cœur commun et des parcours adaptés au rôle, plutôt que multiplier immédiatement les applications ou imposer un tableau de bord professionnel aux particuliers.

## Périmètre et niveau de preuve

Lecture des routes, composants communs, thèmes, recherche, inventaire, onboarding, assistant, plans, prêts, factures, partage, cache et migrations associées. Inspection réelle, dans l’aperçu web à 390 × 844, de la connexion, de l’accueil connecté, d’une fiche objet, des logements, des pièces, de la liste des plans, des factures et des amis. Les observations issues du code et du web ne constituent pas une validation sur Android ou iOS.

**Périmètre confirmé par le porteur : application mobile native, pas application web.** Android est donc la référence. Les problèmes du navigateur (positionnement de l’en-tête, CanvasKit absent pour le plan et boutons HTML imbriqués) sont exclus des priorités de cette refonte mobile. Le plan graphique n’a pas pu être évalué visuellement ; son code et son alternative textuelle ont été examinés. Les captures web donnent des indices sur la hiérarchie et les contenus, pas une preuve de mise en page native. Le parcours Airbnb proposé ci-dessous est lui aussi natif ; une consultation web sans installation serait une décision produit distincte.

`npm run verify` : TypeScript réussi, ESLint terminé avec 0 erreur et 34 avertissements. Aucun test utilisateur, test TalkBack/VoiceOver, test de restauration en base ni test complet hors connexion effectué. Aucune modification du code applicatif, migration, publication ou opération sur les données dans cet audit.

## Ce qui existe et mérite d’être conservé

| Domaine | Fonctionnalités repérées | Valeur produit |
| --- | --- | --- |
| Retrouver | Index d’objets, pièces, emplacements et conteneurs ; recherche sans accents ; filtres par pièce ; logements favoris | Accès rapide aux affaires utiles |
| Ranger | Logement → pièce → emplacement → conteneurs → objet ; création en contexte ; photos et codes-barres | Refléter les lieux réels, même avec des boîtes imbriquées |
| Ajouter rapidement | Saisie manuelle et détection d’objets par photo, sélection de destination | Limiter la saisie d’un inventaire |
| Se repérer | Plans par étage, pièces, portes, emplacements ; vue en liste descriptive ; lien depuis un objet | Aider aussi une personne qui ne connaît pas les lieux |
| Parler | Localisation et déplacement vocal, résolution d’ambiguïtés, réponse orale, annulation du dernier déplacement | Utilisation mains occupées et aide à la saisie |
| Prêter | Prêts et emprunts, personne nommée ou proche, échéance, rappel et retour | Ne plus perdre la trace d’un objet sorti |
| Conserver les preuves | Factures multi-articles, documents, garanties, objets sans facture, rattachement, export PDF | Retrouver les justificatifs et suivre les achats |
| Partager | Proches, catégories, permissions, invitations QR/code, invités temporaires et révocation | Foyer, visiteurs, séjour et équipe |
| Récupérer | Corbeille, restauration, historique des déplacements | Rendre les erreurs rattrapables |
| Résilience | Cache persistant, écritures locales, file de synchronisation, affichage des échecs | Continuer dans une cave ou un garage sans réseau |
| Accompagner | Guide créant de vraies données, tutoriels, FR/EN, thèmes et trois tailles de texte | Favoriser l’autonomie |

Nuances : le scan multi-objets reste un parcours en ligne ; le mode invité est de consultation. Le code comporte déjà une alternative textuelle au plan et une prise en compte des mouvements réduits dans `Pulse.tsx`. Il faut étendre et tester ces mécanismes, pas les présenter comme absents.

## Diagnostic design

### 1. L’information principale est sous-dimensionnée

`ResultCard.tsx` affiche trois colonnes par défaut, un nom d’environ 13 points et une localisation d’environ 10 points sur mobile (`0.93rem` et `0.71rem`, base mobile 14). La ligne de localisation est tronquée à une ligne. Même le mode à une colonne garde une limitation à une ligne pour ce chemin.

Pour une application appelée Céoù, l’endroit où se trouve l’objet doit se lire sans ouvrir systématiquement la fiche. Proposition : liste avec petite photo, nom de 17–18 points, destination de 15–16 points, puis pièce et logement de 14 points. Conserver une grille optionnelle à deux colonnes pour la reconnaissance par photo. Préférer une photo réelle ; à défaut, pictogramme sobre et nom complet. Les images génériques répétées ne doivent pas dominer la recherche.

### 2. La fiche ressemble d’abord à un formulaire

La fiche objet affiche photo, fil de localisation, lien plan, champs modifiables, factures, actions et historique. Le bouton d’enregistrement se trouve dans l’en-tête. Proposition : ouvrir une fiche de consultation avec le nom et un bloc « Rangé dans », puis « Voir sur le plan », « Déplacer » et, selon le cas, « Prêter ». Réserver les champs à « Modifier ». Factures et historique viennent ensuite. Conserver les droits existants, les photos, le prêt actif et l’accès aux justificatifs.

### 3. La navigation expose le modèle plus que l’intention

Les onglets actuels sont Céoù, Habitations, Amis, Profil. « Habitations » couvre pourtant aussi des garages et véhicules ; le produit vise désormais les entreprises. Proposition à tester : **Retrouver · Lieux · Partages · Profil**. Plans et factures restent attachés à leur lieu ; les prêts deviennent accessibles depuis les objets et Partages. Le changement de libellés n’exige pas de renommer les tables.

Ne pas faire des factures la première carte de chaque lieu par défaut : sur le parcours « où sont les serviettes ? », pièces et rangements sont prioritaires. Afficher les tâches de gestion lorsque pertinentes, en respectant le rôle.

### 4. Une direction visuelle plus affirmée

Conserver le caractère domestique et accueillant : fond ivoire très léger, surfaces nettes, texte encre, bleu profond pour agir. Limiter menthe et jaune aux états et catégories utiles. Préférer des rangées ouvertes séparées discrètement à une accumulation de petites cartes bordées et de pastilles.

Proposition de système : corps 16, information secondaire 14, titres 24–30 ; marges 20–24 ; actions hautes de 48–56 ; trois rayons stables (12, 18, 24). Ce sont des valeurs de départ, à éprouver avec agrandissement système et petits écrans. Éviter les hauteurs fixes autour du texte essentiel. Le bleu `#0867AC` avec du blanc donne environ 5,92:1 et constitue un candidat pour les boutons pleins ; ce n’est pas une palette complète validée.

Le thème sombre actuel est chaleureux et cohérent dans son intention. Conserver une personnalité équivalente en sombre, avec des contrastes mesurés. Les animations doivent aider à comprendre le déplacement ou la confirmation, rester brèves et suivre la préférence de réduction des mouvements.

La connexion observée est sobre mais très générique : aucun signe de marque ni bénéfice clairement énoncé. Ajouter Céoù et une phrase utile, puis distinguer visuellement « Se connecter », « Créer mon espace » et « J’ai une invitation », sans enfouir ce dernier parcours pour les visiteurs.

## Accessibilité : priorités étayées

Référentiel de conception : WCAG 2.2 pour contrastes, information et interactions, complété par les recommandations natives. Ce document n’est pas une déclaration de conformité.

| Priorité | Observation | Action recommandée |
| --- | --- | --- |
| P0 | `TextField` rend le label visuellement mais ne le relie pas au champ ; absence de nom confirmée dans l’arbre web, comportement TalkBack à tester | Nom accessible systématique, lien label/champ natif, erreur associée et annoncée ; vérifier tous les formulaires sur appareil |
| P0 | Blanc sur bleu primaire `#1591EA` : **3,35:1** | Assombrir le fond des actions à petit texte, sans assombrir aveuglément tous les usages de l’accent |
| P0 | Blanc sur boutons rouges `#EF4444` : **3,76:1** | Introduire un fond danger dédié aux boutons ; ne pas réutiliser sans contrôle la couleur du texte danger en sombre |
| P0 | Texte `inkFaint` clair sur blanc : **2,72:1** ; sombre sur surface sombre : **3,55:1** | Réserver la teinte faible à la décoration ; utiliser un vrai jeton de texte secondaire pour placeholders et navigation |
| P0 | Texte menthe `#219488` sur `#DBF7F4` : **3,29:1** | Corriger les textes des filtres et badges concernés |
| P1 | Résultats très petits et chemins tronqués, même au plus grand mode | Localisation sur plusieurs lignes, liste confortable, taille secondaire lisible |
| P1 | Boutons retour/fermer de l’ajout : icône 22 + hitSlop 8, environ 38 au total au réglage normal | Cible native explicite d’au moins 48 × 48 dp, et vérifier les limites du parent |
| P1 | Pastilles d’objets dans les factures avec vignette 20 et faible padding | Agrandir la zone interactive sans nécessairement agrandir toute la décoration |
| P1 | Filtres de pièces sans `accessibilityState.selected` | Annoncer l’état choisi et compléter la couleur par un indicateur non chromatique |
| P1 | `Button` remplace son texte par un indicateur pendant l’attente | Garder un nom accessible stable en plus de `busy` |
| P1 | Bottom sheets sans gestion explicite commune du focus initial et de son retour | Tester le comportement natif existant puis compléter focus, fermeture et annonces au niveau partagé |
| P1 | Réduction des animations trouvée dans les tutoriels, pas généralisée | Étendre aux introductions, feuilles et effets de l’accueil ; tester le réglage système |

Mesures : calcul WCAG à partir des couleurs opaques définies dans le code, sans opacité d’état pressé ou désactivé. Le seuil de 4,5:1 concerne le texte normal ; 3:1 le grand texte au sens WCAG et certains éléments non textuels. Une taille de texte petite n’est pas à elle seule une violation d’un seuil WCAG, mais elle est particulièrement mal adaptée ici.

La vue textuelle `PlanRoomList` est un atout : elle décrit zone, voisinages, connexions et rangements. Vérifier que sa commande est découvrable au lecteur d’écran. L’édition par glisser/zoom reste à compléter par des commandes non gestuelles si elle doit être accessible : sélection d’une pièce, position/dimensions, déplacer par étapes. Un plan consultable en liste ne prouve pas que son éditeur est accessible.

## Améliorations fonctionnelles prioritaires

### Recherche fiable et périmètre compréhensible

L’index serveur filtre les logements favoris. L’accueil filtre ensuite par nom de pièce, pas par identifiant ; deux « Cuisine » sont regroupées. La recherche texte teste si au moins un terme apparaît dans le **nom**, puis trie alphabétiquement. Elle n’interroge pas les descriptions dans ce parcours. Un objet d’un lieu non favori peut donc sembler absent et une requête composée donner des résultats trop larges.

Afficher le périmètre (« Mes favoris », lieu précis, « Tous mes accès »), utiliser les identifiants pour les filtres et rendre le logement visible dans les résultats ambigus. Classer nom exact, ensemble des mots puis correspondances partielles. Ajouter description et synonymes de manière contrôlée, avec résultats explicables. Conserver la recherche locale sur le cache. Les droits serveur doivent continuer à définir l’univers consultable.

### Ajout plus court et destination récente

Conserver la création à la volée dans `LocationTreePicker` et l’ajout contextuel existant. Proposer les derniers rangements utilisés avant l’arborescence ; garder le choix manuel disponible immédiatement. Pour les sessions d’inventaire, ajouter « Enregistrer et ajouter un autre » dans le même rangement et une revue des doublons probables après scan.

Ne pas introduire un objet sans destination en supprimant simplement une validation : le modèle actuel attend un emplacement ou conteneur. Un rangement explicite « À ranger » peut être évalué ; il nécessite un comportement clair et une décision de données, pas seulement une carte visuelle.

### Séjour Airbnb

Les invités temporaires en consultation existent déjà. Leur donner un accueil du séjour dans l’application mobile : logement nommé, date de fin d’accès, langue, recherche et accès rapides utiles (« linge », « cuisine », « ménage »). Ouvrir directement le lieu partagé lorsqu’il est unique. Proposer les consignes d’usage et photos de rangement à côté de l’objet. Évaluer avec les voyageurs l’effort d’installation ; ne pas présumer qu’une version web est nécessaire ou déjà prévue.

Évolution importante : sélection de ce qui est visible au voyageur et aperçu « Voir comme un invité ». Les règles actuelles sont principalement au niveau du logement ; masquer une carte dans l’interface ne suffit pas pour cacher un objet, une facture ou un document. Toute granularité supplémentaire doit être appliquée dans les règles de données et de stockage. Ne pas promettre aujourd’hui un partage au niveau d’une pièce ou d’un objet sans cette évolution.

### Entreprise

Employer « Lieux » et proposer, à terme, site, réserve, atelier, véhicule. Priorités à valider avec un premier client pilote : attribution d’équipement, état (disponible, prêté, à réparer), inventaire par QR de rangement, mouvements par lot et journal avec acteur. Les prêts actuels constituent une base ; une organisation avec membres et rôles dépasse le réseau d’amis actuel et demande une conception spécifique.

Éviter de transformer maintenant Céoù en ERP : ni stock comptable, ni achats fournisseurs, ni facturation commerciale ne sont démontrés comme besoins. Distinguer factures d’achat conservées et facturation de clients.

### Confiance dans les modifications

Afficher clairement « enregistré sur cet appareil », « synchronisation en cours », « synchronisé » et « à corriger » lorsque nécessaire. Le mécanisme de file et les échecs existent déjà : travailler sa lisibilité plutôt que créer une seconde file.

Protéger les formulaires avec changements non enregistrés. La fiche objet réinitialise nom et description quand `objet` change ; une actualisation peut écraser une saisie locale. La sortie d’écran n’a pas de garde visible dans cette fiche. Conserver un brouillon d’édition stable et avertir seulement quand des données seraient perdues.

## Point fonctionnel concret découvert

Dans `src/features/assistant/useAssistant.ts:546`, `text.split(/s+/)` découpe sur la lettre « s », alors que le commentaire et `SHORT_QUERY_MAX_WORDS` indiquent un comptage de mots. Ainsi « où ai je rangé mon vélo » est vu comme un seul segment et prend la branche courte locale au lieu de l’interprétation de phrase. Remplacer par un découpage sur les espaces et vérifier phrases courtes, longues, espaces multiples et mots contenant « s ». Défaut confirmé par lecture et reproduction de l’expression JavaScript ; le résultat vocal complet sur appareil reste à tester.

Autre risque concret : `handleSave` de la fiche objet envoie `name` sans le garde `trim()` présent à la création. Uniformiser la validation avant toute refonte des formulaires.

## Plan de livraison sans régression

| Lot | Contenu | Critère de sortie |
| --- | --- | --- |
| 0 — Référence | Jeux de démonstration propriétaire, proche en lecture, proche en modification, invité valide/expiré ; captures Android | Tous les parcours actuels documentés ; aucune donnée personnelle requise |
| 1 — Fondations | Contrastes, champs nommés, boutons, cibles, messages, mouvement réduit ; défaut de segmentation vocale | Composants communs validés en clair/sombre, lecteur d’écran et texte agrandi |
| 2 — Cœur quotidien | Recherche contextualisée, résultats lisibles, fiche de consultation, brouillon de modification, destinations récentes | Retrouver, déplacer, prêter, modifier et annuler restent accessibles avec les mêmes droits |
| 3 — Accueil des visiteurs | Entrée de séjour, consignes, fin d’accès, aperçu invité | Un voyageur trouve un objet sans apprendre l’arborescence ; règles d’accès vérifiées |
| 4 — Gestion avancée | Factures/garanties mieux découvertes, suivi des prêts, pilote entreprise, opérations par lot | Validation par utilisateurs réels avant extension du modèle |

Chaque lot doit rester relisible et réversible. Ne pas coupler une refonte globale des écrans à un changement des permissions et du schéma. Conserver les routes profondes, les identifiants, le QR, les types d’accès, les files hors connexion et l’export. Modifier les composants partagés d’abord, migrer un parcours ensuite.

Scénarios de non-régression : création manuelle avec photo ; scan multi-objets ; changement de destination dans et entre lieux ; recherche avec homonymes ; prêt et retour ; facture multi-articles et export ; suppression/restauration avec photo ; lien objet → plan → liste ; invitation, expiration et révocation ; changement de compte ; modification hors connexion puis reconnexion et relance de l’app.

Matrice d’accessibilité : Android TalkBack d’abord, VoiceOver si iOS visé ; largeur compacte ; grossissement système et réglage de l’app combinés ; clair/sombre ; clavier ouvert ; mouvement réduit ; contrôle externe si utilisé sur appareil. Les tests statiques actuels ne remplacent pas cette matrice. Aucun chantier de compatibilité web inclus.

Objectifs de recherche utilisateur proposés, non mesurés : retrouver un objet connu en moins de 10 secondes, ajouter un objet au même rangement en moins de 30 secondes, réaliser les parcours essentiels sans assistance au lecteur d’écran. Faire tester les mêmes tâches à des adolescents, adultes, seniors et visiteurs ne connaissant pas le lieu ; mesurer succès et hésitations plutôt que demander uniquement « Est-ce joli ? ».

## Accès utiles

Pas besoin d’un accès administrateur Supabase ou EAS pour la première refonte visuelle. Une session de démonstration dans le navigateur intégré et un build Android de test suffisent pour continuer l’inspection. Pour confirmer le comportement natif : appareil ou émulateur avec TalkBack, caméra et notifications. Pour changer les droits invités ou le modèle entreprise : environnement Supabase de développement isolé et migrations relisibles. Pour publier ultérieurement : accès Expo/EAS au moment de la livraison, pas pour cet audit.

## Références

- [Documentation Expo SDK 57, consultée avant toute proposition de code](https://docs.expo.dev/versions/v57.0.0/).
- [WCAG 2.2 — contraste, redimensionnement, gestes et information accessible](https://www.w3.org/TR/WCAG22/).
- [Android — rendre les applications accessibles, notamment cibles de 48 dp](https://developer.android.com/guide/topics/ui/accessibility/views/apps-views).
- [Apple — accessibilité dans les Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/accessibility).

La direction esthétique est une proposition de conception pour Céoù, pas une affirmation selon laquelle un style serait universellement « tendance » ou conviendrait déjà à tous les publics.
