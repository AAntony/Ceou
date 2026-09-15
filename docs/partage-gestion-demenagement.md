# Partage et gestion des déménagements

## Règles

- Tous les déménagements, existants et nouveaux, sont privés par défaut. Leur créateur choisit les amis acceptés dans « Plus d’actions → Partager avec des amis ». Désélectionner tous les amis retire le partage.
- Chaque accès serveur vérifie encore l’amitié et les droits des habitations de départ et d’arrivée. Les deux doivent autoriser la consultation ; la modification exige la modification (ou propriétaire) sur les deux. Sans destination, seul le départ compte. Une invitation au déménagement n’accorde jamais de droit supplémentaire sur une habitation.
- La consultation inclut le suivi, les cartons et leur QR. Seul le créateur configure les destinataires. Les éditeurs peuvent modifier et supprimer les cartons et le suivi.
- Le partage de l’inventaire des habitations reste inchangé : les cartons et objets qui s’y trouvent restent accessibles selon ces droits. La confidentialité ajoutée concerne le suivi du déménagement. Les données déjà téléchargées sur un autre appareil ne peuvent pas être effacées à distance ; la révocation s’applique aux nouvelles lectures serveur.

## Modification et suppression

- Le nom et la date du déménagement sont modifiables. La destination conserve son action existante et ses restrictions après installation des objets.
- Les informations d’un carton sont modifiables, y compris après la fin du déménagement. Le nom de son contenant d’inventaire est synchronisé lorsqu’il existe encore, sous contrôle des droits de son habitation actuelle.
- Toute suppression vérifie côté serveur que les cartons concernés ne contiennent ni objets ni sous-conteneurs. Les contenants sont verrouillés avant ce contrôle. Le lot entier est annulé si un carton est plein.
- Les cartons temporaires vides sont retirés de l’inventaire. Les contenants stockés sont conservés. Les objets déjà déplacés ou installés ne sont jamais supprimés par cette action.
- Le suivi et les cartons supprimés sont masqués par une date de suppression ; leur historique reste conservé en base. Aucune restauration de suivi n’est proposée dans l’interface à ce stade.
- Les clés de cache de déménagement changent pour ne pas réafficher les anciens suivis implicitement partagés après l’OTA ; le cache d’inventaire et les écritures hors ligne restent inchangés.

## Vérification

`npm run verify:ci` réussi : 54 tests, 30 avertissements ESLint existants. Tests PostgreSQL isolés avec fonctions réelles : privé par défaut, partage explicite, QR, consultation/modification, combinaison des droits, retrait du partage, fin d’amitié, modification du nom/date/carton, suppression refusée avec objets ou sous-conteneurs, conservation des objets déplacés. Aucun essai n’altère l’inventaire personnel.

À valider sur deux comptes : partager avec un ami lecteur, scanner un carton, vérifier l’absence de commandes d’écriture ; puis tester un ami éditeur. Désactiver le partage et actualiser côté ami. Pour la suppression, employer un carton de test vide puis un carton de test contenant un objet.
