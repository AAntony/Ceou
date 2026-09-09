# Le site public de Céoù

Quatre pages et une image engendrées dans `site/`. **Ne rien y modifier à la
main** — le dossier est réécrit à chaque exécution du générateur.

| Fichier | Contenu | Ancre |
| --- | --- | --- |
| `index.html` | Accueil, français | |
| `en.html` | Accueil, anglais | |
| `confidentialite.html` | Politique de confidentialité, français | `#suppression-de-compte` |
| `privacy.html` | Politique de confidentialité, anglais | `#account-deletion` |
| `og-image.png` | Vignette de partage et icône de raccourci | |

Ce document vit ici et non dans `site/` : ce dossier part en ligne tel quel, et
tout ce qu'il contient devient public. Une note de développement n'a rien à
faire sur le domaine d'une politique de confidentialité.

```bash
npm run site
```

## Où vit quoi

Le générateur assemble ; la matière est à côté.

| Fichier | Rôle |
| --- | --- |
| `scripts/build-site.mjs` | Assemble les quatre pages et les écrit |
| `scripts/site/content.mjs` | **Tout le texte**, français et anglais côte à côte |
| `scripts/site/style.mjs` | La feuille de style, écrite dans chaque page |
| `scripts/site/icons.mjs` | Les dessins : logo, favicon, icônes, plan miniature |
| `scripts/site/layout.mjs` | En-tête HTML, navigation, pied de page, script |
| `scripts/site/appColors.mjs` | Les couleurs de pièce, traduites pour le thème sombre |

**Le texte de la politique** ne vit dans aucun de ces fichiers : il est dans
`src/features/legal/privacyPolicy.json`, lu **à la fois** par l'écran de l'app
(`app/privacy-policy.tsx`) et par le générateur. C'est le seul endroit à
modifier, et c'est ce qui empêche l'app et la page publique de se contredire.
Le sommaire de la page se construit tout seul à partir de ses sections.

**Le texte de l'accueil** vit dans `content.mjs` : il n'appartient qu'au site,
l'app n'en connaît pas un mot.

Après toute modification, réengendrer **et redéployer**. Sans ça la version
publique reste en arrière de celle de l'app — et l'écart entre les deux est
exactement ce qu'un examinateur de store relève.

## Relire avant de déposer

```bash
npm run site:serve
```

Puis <http://localhost:4321>. Ouvrir `site/index.html` directement ne suffit
pas : en `file:`, le défilement de la fenêtre et les observateurs de visibilité
ne se comportent pas comme sur un vrai serveur, et on validerait la page dans
des conditions qui n'existent nulle part.

Ce qui mérite un coup d'oeil à chaque fois :

- **Le texte doublé.** `document.documentElement.style.fontSize = '32px'` dans
  la console, sur une fenêtre étroite. Rien ne doit déborder de côté ni se
  tronquer. C'est là que les défauts de grille apparaissent.
- **Les deux thèmes.** Le site suit le réglage du système.
- **Le menu replié**, sous 54 rem : il s'ouvre, se referme à Échap et au clic
  sur un lien.

## Ce qui ne doit rien coûter à personne

Le dossier n'appelle **rien de distant** : ni police, ni feuille de style, ni
script, ni image hébergée ailleurs. Trois raisons — le site s'affiche partout,
y compris là où les requêtes vers un tiers sont bloquées ; il ne peut pas
casser parce que quelqu'un a bougé un fichier ailleurs ; et il n'apprend rien
à personne sur qui le consulte, ce qui serait malvenu sur un site dont une
page promet justement de ne pas faire ça.

Le JavaScript de la page ne fait que du confort : menu repliable, apparitions
au défilement, lien de menu souligné pour la section qu'on lit. **Rien de ce
qu'il fait n'est nécessaire pour lire la page.** Bloqué, la page s'affiche
entière du premier coup.

## Déployer

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

### EAS Hosting (le miroir, `ceou.expo.app`)

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
