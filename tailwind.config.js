/** @type {import('tailwindcss').Config} */

// Chaque couleur pointe sur une variable declaree dans global.css, ou vivent
// les deux jeux de valeurs (clair et sombre). `<alpha-value>` est ce qui
// garde `border-ink/10` et `bg-ink/5` fonctionnels par-dessus la variable.
const token = (name) => `rgb(var(--color-${name}) / <alpha-value>)`;

module.exports = {
  darkMode: 'class',
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      // L'ECHELLE TYPOGRAPHIQUE DE CEOU, par ROLE et non par taille.
      //
      // `text-sm` ne dit pas ce qu'on ecrit, seulement combien c'est petit :
      // deux ecrans finissent par titrer l'un en `text-xl`, l'autre en
      // `text-2xl`, et personne ne sait lequel a raison. Un role le dit, et
      // toute l'app se retaille depuis ces sept lignes.
      //
      // Les valeurs reprennent exactement l'echelle Tailwind d'origine : le
      // passage aux roles n'a rien change a l'ecran, il a nomme ce qui
      // existait. Elles sont en `rem`, donc soumises au reglage de taille
      // du Profil (voir metro.config.js et lib/textScale).
      fontSize: {
        // Le nom de l'app sur l'ecran d'un visiteur. Une fois par ecran, pas
        // plus.
        display: ['1.875rem', '2.25rem'],
        // Titre d'ecran (la salutation de l'accueil, « Connexion »).
        title: ['1.5rem', '2rem'],
        // Titre d'une feuille ou d'une section forte.
        heading: ['1.25rem', '1.75rem'],
        // Titre d'un bloc a l'interieur d'un ecran.
        subheading: ['1.125rem', '1.75rem'],
        // LE TEXTE COURANT : nom d'un objet, d'une piece, d'un ami, contenu
        // d'un champ de saisie. En cas de doute, c'est celui-la.
        body: ['1rem', '1.5rem'],
        // Libelle de champ, ligne secondaire d'une rangee, libelle de
        // bouton compact. Le plus utilise apres `body`.
        label: ['0.875rem', '1.25rem'],
        // Mention, aide, pastille de comptage. Ce qu'on lit si on cherche,
        // pas ce qu'on lit d'abord.
        caption: ['0.75rem', '1rem'],
      },
      colors: {
        // Identité visuelle Ceou — corail/turquoise/moutarde plutôt que du
        // gris neutre, pour un ton joueur cohérent avec "retrouver ses affaires".
        coral: {
          DEFAULT: token('coral'),
          dark: token('coral-dark'),
          light: token('coral-light'),
        },
        teal: {
          DEFAULT: token('teal'),
          dark: token('teal-dark'),
          light: token('teal-light'),
        },
        mustard: {
          DEFAULT: token('mustard'),
          dark: token('mustard-dark'),
          light: token('mustard-light'),
        },
        sky: {
          DEFAULT: token('sky'),
          dark: token('sky-dark'),
          light: token('sky-light'),
        },
        ink: {
          DEFAULT: token('ink'),
          soft: token('ink-soft'),
          faint: token('ink-faint'),
        },
        sand: {
          DEFAULT: token('sand'),
          dark: token('sand-dark'),
        },
        // Le fond des cartes et des feuilles. Remplace `bg-white`, qui ne
        // pouvait pas s'assombrir sans mentir sur son nom.
        surface: token('surface'),
      },
    },
  },
  plugins: [],
};
