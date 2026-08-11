/** @type {import('tailwindcss').Config} */
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
          DEFAULT: '#FF6B4A',
          dark: '#E2543A',
          light: '#FFE4DB',
        },
        teal: {
          DEFAULT: '#2EC4B6',
          dark: '#219488',
          light: '#DBF7F4',
        },
        mustard: {
          DEFAULT: '#FFC857',
          dark: '#E0A93C',
          light: '#FFF3DA',
        },
        ink: {
          DEFAULT: '#2D2A26',
          soft: '#6B6459',
        },
        sand: {
          DEFAULT: '#FFFBF8',
          dark: '#F5EEE6',
        },
      },
    },
  },
  plugins: [],
};
