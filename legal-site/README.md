# legal-site

Les deux pages publiques exigées par les stores. **Engendrées** — ne pas les
modifier à la main.

- `index.html` — français, ancre `#suppression-de-compte`
- `en.html` — anglais, ancre `#account-deletion`

## Modifier le texte

Le texte vit dans `src/features/legal/privacyPolicy.json`, lu **à la fois** par
l'écran de l'app (`app/privacy-policy.tsx`) et par ces pages. Après toute
modification :

```bash
node scripts/build-legal-page.mjs
```

puis redéployer, sinon la version publique reste en arrière de celle de l'app —
et l'écart entre les deux est exactement ce qu'un examinateur de store relève.

## Ce que chaque store attend

| Store | Champ | Adresse à déposer |
| --- | --- | --- |
| App Store Connect | Privacy Policy URL | `https://<domaine>/` |
| Google Play | Politique de confidentialité | `https://<domaine>/` |
| Google Play | Suppression de compte (URL web) | `https://<domaine>/#suppression-de-compte` |

Google Play demande les deux séparément : la politique, **et** une adresse où
quelqu'un qui n'a pas — ou n'a plus — l'app installée peut demander la
suppression de son compte. C'est ce que porte l'ancre.

## Déployer

Le dossier n'a aucune dépendance : deux fichiers HTML, rien de distant, ni
police ni script. N'importe quel hébergement statique convient.

Avec EAS Hosting, déjà rattaché à ce projet :

```bash
npx eas-cli@latest deploy --export-dir legal-site --prod
```

La première exécution demande un sous-domaine (`<nom>.expo.app`). Une fois
choisi, il ne doit plus changer : l'adresse est recopiée dans les deux fiches
de store, et on ne peut jamais la corriger partout.
