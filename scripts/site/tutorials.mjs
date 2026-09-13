// LES TUTORIELS, LUS DANS L'APP.
//
// Même règle que pour la politique de confidentialité : le texte n'est
// recopié nulle part. Les chapitres viennent de fr.json et en.json — ceux que
// lit l'écran de l'app — et leur ORDRE de src/features/tutoriels/chapitres.ts.
// Corriger une étape dans l'app la corrige sur le site au prochain
// `npm run site`, et on ne peut pas publier deux versions d'une même leçon.
//
// L'ORDRE EST LU DANS LE SOURCE, PAS IMPORTÉ. chapitres.ts est du TypeScript :
// l'importer demanderait une version de Node qui sache retirer les types, et
// afficherait un avertissement à chaque génération. Le tableau est simple —
// un identifiant, une démonstration, parfois des démonstrations d'étape — et
// il se lit sans risque. SI SA FORME CHANGE, la génération s'arrête avec un
// message qui dit quoi faire, plutôt que de publier une page amputée.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Les icônes du sommaire. Celles de l'app sont des noms de sa propre
// bibliothèque ; le site a les siennes, dessinées dans icons.mjs.
const ICON_OF = {
  demarrer: 'flag',
  retrouver: 'search',
  'ajouter-vite': 'scan',
  factures: 'receipt',
  plan: 'plan',
  prets: 'loan',
  amis: 'people',
  invites: 'qr',
  affichage: 'a11y',
  'hors-ligne': 'offline',
};

function readOrder(root) {
  const source = readFileSync(join(root, 'src/features/tutoriels/chapitres.ts'), 'utf8');
  const start = source.indexOf('export const CHAPITRES');
  const open = source.indexOf('= [', start);
  const end = source.indexOf('\n];', open);
  if (start === -1 || open === -1 || end === -1) return [];

  // Un chapitre par accolade de premier niveau ; `demosEtapes` est le seul
  // objet imbriqué, d'où un seul niveau d'accolades toléré à l'intérieur.
  const objects = source.slice(open + 3, end).match(/\{(?:[^{}]|\{[^{}]*\})*\}/g) ?? [];
  return objects.map((chunk) => {
    const steps = chunk.match(/demosEtapes:\s*\{([^}]*)\}/)?.[1] ?? '';
    return {
      id: chunk.match(/\bid:\s*'([^']+)'/)?.[1],
      demo: chunk.match(/\bdemo:\s*'([^']+)'/)?.[1],
      demosEtapes: Object.fromEntries(
        [...steps.matchAll(/(\d+)\s*:\s*'([^']+)'/g)].map(([, rank, id]) => [Number(rank), id]),
      ),
    };
  });
}

/**
 * Les chapitres dans l'ordre de lecture, et le bloc `tutoriels` de chaque langue.
 *
 * `demoIds` : les mini-écrans que le site sait dessiner (demos.mjs).
 */
export function loadTutorials(root, demoIds) {
  const locales = Object.fromEntries(
    ['fr', 'en'].map((lang) => [
      lang,
      JSON.parse(readFileSync(join(root, `src/lib/i18n/locales/${lang}.json`), 'utf8')).tutoriels,
    ]),
  );
  const order = readOrder(root);

  const problems = [];
  if (order.length === 0) {
    problems.push('aucun chapitre lu dans src/features/tutoriels/chapitres.ts — la forme du tableau CHAPITRES a changé ?');
  }
  for (const chapter of order) {
    if (!chapter.id || !chapter.demo) {
      problems.push('un chapitre sans `id` ou sans `demo` dans chapitres.ts');
      continue;
    }
    if (!ICON_OF[chapter.id]) {
      problems.push(`pas d'icône de sommaire pour « ${chapter.id} » : l'ajouter à ICON_OF dans scripts/site/tutorials.mjs`);
    }
    for (const id of [chapter.demo, ...Object.values(chapter.demosEtapes)]) {
      if (!demoIds.includes(id)) {
        problems.push(`le mini-écran « ${id} » n'existe pas sur le site : le dessiner dans scripts/site/demos.mjs`);
      }
    }
    for (const lang of ['fr', 'en']) {
      const copy = locales[lang].chapters?.[chapter.id];
      const complete = copy && ['title', 'summary', 'goal', 'tip', 'result'].every((key) => copy[key]) && Array.isArray(copy.steps);
      if (!complete) problems.push(`le chapitre « ${chapter.id} » est incomplet dans ${lang}.json`);
    }
  }
  for (const lang of ['fr', 'en']) {
    for (const id of Object.keys(locales[lang].chapters ?? {})) {
      if (!order.some((chapter) => chapter.id === id)) {
        problems.push(`« ${id} » est dans ${lang}.json mais pas dans chapitres.ts`);
      }
    }
  }
  if (problems.length > 0) {
    throw new Error(`Tutoriels — la page ne peut pas être engendrée :\n  - ${problems.join('\n  - ')}`);
  }

  return {
    chapters: order.map((chapter) => ({ ...chapter, icon: ICON_OF[chapter.id] })),
    locales,
  };
}
