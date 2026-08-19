// Config ESLint (flat, ESLint 9) — ajoutée lors de l'audit du 2026-08-19.
// Motivation : `tsc` seul ne signalait PAS les imports/variables inutilisés,
// donc le code mort était invisible pour l'outillage et ne pouvait être traqué
// qu'à l'œil. Deux garde-fous complémentaires depuis :
//   - tsconfig (noUnusedLocals / noUnusedParameters) = variables et imports
//     morts, en ERREUR bloquante dès `tsc --noEmit` ;
//   - ESLint = règles React et conventions que le compilateur ne voit pas.
const expoConfig = require('eslint-config-expo/flat');
const typescriptEslint = require('@typescript-eslint/eslint-plugin');
const { defineConfig } = require('eslint/config');

module.exports = defineConfig([
  ...expoConfig,
  {
    ignores: [
      'dist/*',
      'node_modules/*',
      'expo-env.d.ts',
      // Généré par `supabase gen types` — le linter n'a rien à y dire, le
      // fichier est réécrit intégralement au prochain gen.
      'src/types/supabase.ts',
      // Code Deno (specifiers `npm:`, API Deno globale) : ni le résolveur de
      // modules Node ni les globals navigateur d'Expo ne s'y appliquent.
      // Déjà exclu de tsconfig.json pour la même raison.
      'supabase/functions/*',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: { '@typescript-eslint': typescriptEslint },
    rules: {
      // Expo ne la pose qu'en `warn` : passée en `error` pour que
      // `npm run lint` échoue vraiment plutôt que de laisser filer. Les noms
      // préfixés d'un `_` restent tolérés — convention pour un paramètre
      // imposé par une signature mais délibérément ignoré (ex. le
      // `(_error, _input, context)` des onError de React Query).
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          vars: 'all',
          args: 'after-used',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],

      // FAUX POSITIF ASSUMÉ dans ce projet : les 13 occurrences signalées sont
      // toutes des `ref.current` lus/écrits DANS un callback de geste
      // (`Gesture.Pan().onStart/onUpdate`, `Gesture.Pinch()`), pas pendant le
      // rendu — c'est précisément l'usage canonique d'un ref avec
      // react-native-gesture-handler. La règle ne sait pas distinguer les deux
      // contextes. Vérifié fichier par fichier (PlanCanvas, PlanPinLayer) avant
      // désactivation : ne pas la réactiver sans refaire cette vérification.
      'react-hooks/refs': 'off',

      // Rétrogradée en avertissement, pas corrigée : les 16 occurrences sont
      // toutes le motif « remettre l'état à zéro quand la modale s'ouvre »
      // (`useEffect(() => { if (visible) setX(...) }, [visible])`), délibéré et
      // documenté dans ces composants. La règle est un conseil de performance
      // (rendus en cascade), pas un signalement de bug : le comportement actuel
      // est correct. À traiter comme un chantier à part si on veut s'en
      // débarrasser — ça touche l'état de modales qui fonctionnent aujourd'hui.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
]);
