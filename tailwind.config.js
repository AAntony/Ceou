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
