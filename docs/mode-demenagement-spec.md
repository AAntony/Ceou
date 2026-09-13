# Feature : Mode Déménagement

## Objectif

Ajouter à Céoù un **Mode Déménagement** permettant à l'utilisateur de préparer, organiser et suivre un déménagement en utilisant l'inventaire existant de l'application.

Le principe central est simple :

**Les objets quittent leurs emplacements habituels pour être regroupés dans des cartons, puis sont réaffectés à leurs nouveaux emplacements lors du déballage.**

La fonctionnalité doit rester cohérente avec le fonctionnement actuel de Céoù : logements, pièces, emplacements, objets, photos, recherche et inventaire.

---

# 1. Création d'un déménagement

L'utilisateur peut créer un nouveau déménagement depuis son logement.

Il renseigne :

- un nom, par exemple « Déménagement Toulouse 2026 » ;
- le logement de départ ;
- le logement de destination, s'il existe déjà dans Céoù ;
- éventuellement la date prévue du déménagement.

Si le logement de destination n'existe pas encore, l'utilisateur doit pouvoir le créer pendant le processus.

Le déménagement possède plusieurs états :

- Préparation
- En cours
- Déballage
- Terminé

Un écran principal permet de suivre sa progression.

Exemple :

**Déménagement Toulouse 2026**

📦 12 cartons  
📋 84 objets emballés  
🏠 37 objets déjà installés  
✅ Progression : 44 %

---

# 2. Création des cartons

L'utilisateur peut créer des cartons virtuels.

Exemple :

**Carton #12**

Il peut éventuellement renseigner :

- un nom personnalisé ;
- une catégorie ;
- une pièce de destination ;
- une description ;
- une photo du carton.

Exemples :

- Carton #01 - Cuisine
- Carton #02 - Livres
- Carton #03 - Informatique
- Carton #04 - Salle de bain

La numérotation doit pouvoir être générée automatiquement afin que la création de nombreux cartons soit très rapide.

---

# 3. Ajouter des objets dans un carton

L'utilisateur doit pouvoir ajouter des objets existants de son inventaire à un carton.

Plusieurs méthodes doivent être proposées :

### Depuis un carton

L'utilisateur ouvre :

**Carton #03 - Informatique**

Puis sélectionne :

**Ajouter des objets**

Il peut rechercher et sélectionner plusieurs objets de son inventaire.

### Depuis un objet

Depuis la fiche d'un objet :

**Emballer dans un carton**

Puis sélectionner le carton correspondant.

### Ajout rapide

Prévoir une expérience permettant d'ajouter plusieurs objets successivement dans le même carton sans devoir refaire tout le parcours à chaque objet.

Lorsqu'un objet est emballé, son emplacement doit devenir quelque chose comme :

**📦 Déménagement → Carton #03**

Son ancien emplacement doit cependant être conservé dans l'historique.

---

# 4. Ajout d'objets par photo et IA

Permettre à l'utilisateur de photographier le contenu d'un carton.

L'IA analyse la photo et détecte plusieurs objets.

Exemple :

Photo du carton →

- clavier
- souris
- câble HDMI
- casque audio
- multiprise
- chargeur USB-C

L'utilisateur valide, corrige ou supprime les objets détectés.

Il peut ensuite sélectionner :

**Ajouter les 6 objets au Carton #03**

Si certains objets semblent déjà exister dans l'inventaire, essayer de proposer une correspondance afin d'éviter les doublons.

Exemple :

> « Un objet "Casque Sony WH-1000XM5" existe déjà dans votre inventaire. Est-ce le même ? »

---

# 5. QR Code pour chaque carton

Chaque carton possède un **QR Code unique** généré par Céoù.

L'utilisateur doit pouvoir :

- afficher le QR Code ;
- l'imprimer ;
- éventuellement générer plusieurs étiquettes en une fois.

Le QR Code identifie le carton mais ne doit pas exposer directement les données personnelles ou le contenu complet du carton.

Lorsqu'il est scanné depuis Céoù, l'application ouvre immédiatement :

**📦 Carton #03 - Informatique**

Contenu :
- Clavier Logitech
- Souris
- Casque Sony
- Webcam
- Câble HDMI
- Chargeur USB-C

**6 objets**

---

# 6. Recherche pendant le déménagement

Tous les objets emballés doivent rester accessibles depuis la recherche globale de Céoù.

Exemple :

Utilisateur :

**« Céoù mon casque Sony ? »**

Résultat :

> 🎧 Casque Sony WH-1000XM5  
> 📦 Carton #03 - Informatique  
> 🏠 Déménagement Toulouse 2026

L'objectif est de résoudre un problème très concret du déménagement :

**« Dans quel carton j'ai mis ce truc ? »**

La recherche vocale de Céoù doit fonctionner exactement de la même manière.

---

# 7. Pièce de destination

Lors de la préparation d'un carton, l'utilisateur peut indiquer sa future destination.

Exemple :

**Carton #03 - Informatique**

Destination :

**Nouvelle maison → Bureau**

Cela permettra à l'utilisateur de savoir immédiatement où déposer chaque carton à son arrivée.

Sur l'écran du carton :

> 📦 Carton #03  
> 📍 À déposer dans : Bureau

Cette information doit être facilement visible, notamment pendant la phase de déménagement.

---

# 8. Mode Déballage

Lorsque l'utilisateur arrive dans son nouveau logement, le déménagement passe en phase :

**Déballage**

Il peut scanner le QR Code d'un carton.

Céoù affiche immédiatement son contenu et sa destination.

Exemple :

**📦 Carton #03 - Informatique**

📍 Destination prévue : Bureau

6 objets

Bouton :

**Déballer le carton**

L'utilisateur peut ensuite affecter les objets à leur nouvel emplacement.

Exemple :

Casque Sony  
→ Bureau → Tiroir gauche

Clavier  
→ Bureau → Bureau principal

Câbles HDMI  
→ Bureau → Placard → Boîte câbles

Il doit être possible de déplacer plusieurs objets simultanément vers le même emplacement.

---

# 9. Carton entièrement déballé

Lorsque tous les objets d'un carton ont été réaffectés :

**Carton #03**

passe à :

✅ **Déballé**

Le tableau de bord est automatiquement actualisé.

Exemple :

**Déménagement Toulouse 2026**

📦 20 cartons  
✅ 14 cartons déballés  
📋 126 objets  
🏠 93 objets installés

**Progression : 74 %**

---

# 10. Tableau de bord du déménagement

Créer un écran permettant de visualiser rapidement :

- nombre total de cartons ;
- cartons préparés ;
- cartons transportés ;
- cartons déballés ;
- nombre d'objets emballés ;
- nombre d'objets installés ;
- progression globale.

Permettre également de filtrer les cartons :

**Tous | À emballer | Prêts | À déballer | Terminés**

Et éventuellement par pièce :

**Cuisine | Salon | Chambre | Bureau | Garage**

---

# 11. Terminer le déménagement

Lorsque tous les cartons sont déballés, proposer :

**🎉 Terminer le déménagement**

Après confirmation :

- le nouveau logement devient le logement actuel des objets concernés ;
- leurs nouveaux emplacements deviennent leurs emplacements normaux ;
- le déménagement est archivé ;
- l'historique des déplacements est conservé ;
- les cartons restent consultables dans l'historique mais ne polluent plus l'inventaire actif.

Le déménagement terminé doit pouvoir être consulté ultérieurement.

---

# 12. Cas particuliers

Prévoir les comportements suivants :

### Objet laissé dans l'ancien logement

Tous les objets ne sont pas obligatoirement déménagés.

### Objet supprimé/perdu

Un objet peut être marqué comme :

- perdu pendant le déménagement ;
- donné ;
- vendu ;
- jeté.

### Carton non déballé

Un carton peut rester stocké après le déménagement.

Exemple :

**Carton #18 - Décorations Noël**

→ Garage → Étagère 4

Dans ce cas, le carton peut devenir un emplacement permanent et les objets restent associés au carton.

### Modification d'un carton

Un objet doit pouvoir être déplacé d'un carton vers un autre à tout moment.

---

# 13. UX recherchée

Le Mode Déménagement doit être extrêmement rapide à utiliser.

Pendant un déménagement, l'utilisateur peut avoir des dizaines de cartons et plusieurs centaines d'objets.

Éviter au maximum :

- les formulaires longs ;
- les validations répétitives ;
- les écrans intermédiaires inutiles ;
- les actions nécessitant plusieurs clics.

Privilégier :

- sélection multiple ;
- scan QR ;
- photo + reconnaissance IA ;
- actions rapides ;
- valeurs par défaut intelligentes ;
- duplication de paramètres du carton précédent.

Le scénario idéal doit être :

**Créer carton → photographier contenu → IA détecte les objets → valider → QR Code → fermer le carton.**

Puis dans le nouveau logement :

**Scanner QR → voir contenu + destination → déballer → affecter les objets → carton terminé.**

---

# 14. Intégration avec Céoù

Cette fonctionnalité ne doit pas constituer un système d'inventaire parallèle.

Elle doit réutiliser autant que possible les entités et fonctionnalités existantes de Céoù :

- logements ;
- pièces ;
- emplacements ;
- objets ;
- photos ;
- utilisateurs ;
- partage de logement ;
- recherche textuelle ;
- recherche vocale ;
- reconnaissance IA.

Le Mode Déménagement est essentiellement une **couche temporaire de gestion des déplacements d'objets entre deux logements**.

L'architecture doit permettre ultérieurement d'ajouter facilement :

- partage du déménagement avec les membres du foyer ;
- export PDF des cartons ;
- impression d'une planche complète d'étiquettes QR ;
- statistiques de déménagement ;
- inventaire avant/après ;
- utilisation des cartons comme emplacements permanents ;
- assistance IA pour proposer automatiquement la pièce de destination.

## Critère principal de réussite

Un utilisateur possédant plusieurs centaines d'objets doit pouvoir organiser son déménagement avec **le moins de saisie manuelle possible**, puis retrouver instantanément n'importe quel objet pendant la période où ses affaires sont réparties dans des cartons.