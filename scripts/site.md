# Le site public de Céoù

Quatre pages engendrées dans `site/`. **Ne pas les modifier à la main** — elles
sont réécrites à chaque exécution du générateur.

| Fichier | Contenu | Ancre |
| --- | --- | --- |
| `index.html` | Accueil, français | |
| `en.html` | Accueil, anglais | |
| `confidentialite.html` | Politique de confidentialité, français | `#suppression-de-compte` |
| `privacy.html` | Politique de confidentialité, anglais | `#account-deletion` |

Ce document vit ici et non dans `site/` : ce dossier part en ligne tel quel, et
tout ce qu'il contient devient public. Une note de développement n'a rien à
faire sur le domaine d'une politique de confidentialité.

## Modifier le contenu

**Le texte de la politique** vit dans `src/features/legal/privacyPolicy.json`,
lu **à la fois** par l'écran de l'app (`app/privacy-policy.tsx`) et par le
générateur. C'est le seul endroit à modifier, et c'est ce qui empêche l'app et
la page publique de se contredire.

**Le texte de l'accueil** vit dans le générateur lui-même
(`scripts/build-site.mjs`, objet `HOME`) : il n'appartient qu'au site, l'app
n'en connaît pas un mot.

Puis, dans les deux cas :

```bash
node scripts/build-site.mjs
```

Et redéployer. Sans ça la version publique reste en arrière de celle de l'app —
et l'écart entre les deux est exactement ce qu'un examinateur de store relève.

## Déployer

Le dossier n'a **aucune dépendance** : quatre fichiers HTML, rien de distant,
ni police ni feuille de style ni script. N'importe quel hébergement statique
convient.

### OVH (l'hébergement inclus avec le domaine)

Par FTP, avec WinSCP :

| Champ | Valeur |
| --- | --- |
| Protocole | FTP |
| Chiffrement | **TLS/SSL explicite** — sans quoi le mot de passe passe en clair |
| Hôte | `ftp.clusterXXX.hosting.ovh.net` (espace client OVH → onglet FTP - SSH) |
| Port | 21 |

Déposer le **contenu** de `site/` à la racine de `www`, pas le dossier
lui-même : `index.html` doit répondre à `https://ceou.eu/`.

### EAS Hosting (le miroir actuel, `ceou.expo.app`)

```bash
npx eas-cli@latest deploy --export-dir site --prod
```

## Ce que chaque store attend

| Store | Champ | Adresse |
| --- | --- | --- |
| App Store Connect | Privacy Policy URL | `https://ceou.eu/confidentialite.html` |
| Google Play | Politique de confidentialité | `https://ceou.eu/confidentialite.html` |
| Google Play | Suppression de compte (URL web) | `https://ceou.eu/confidentialite.html#suppression-de-compte` |

Google Play demande les deux séparément : la politique, **et** une adresse où
quelqu'un qui n'a pas — ou n'a plus — l'app installée peut demander la
suppression de son compte.

**Les noms de fichiers et les ancres ne doivent plus changer** une fois la
première fiche déposée : une adresse déposée dans un store est recopiée
ailleurs, et on ne peut jamais la corriger partout.

## À ne pas confondre

`docs/` est l'**autre** page publique du projet — atterrissage des e-mails
Supabase et ouverture des invitations, servie par GitHub Pages sur
`aantony.github.io/Ceou/`. Cette adresse est encodée dans les QR d'invitation
déjà partagés : elle ne doit pas bouger.
