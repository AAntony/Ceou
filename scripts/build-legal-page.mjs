import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// LA PAGE PUBLIQUE, ENGENDRÉE DEPUIS LE TEXTE DE L'APP.
//
// Les deux stores exigent une politique de confidentialité consultable SANS
// installer l'application, et Google Play exige en plus une adresse où la
// suppression de compte puisse être demandée par quelqu'un qui n'a pas — ou
// n'a plus — l'app installée. Ces pages répondent aux deux.
//
// ENGENDRÉES ET NON ÉCRITES À LA MAIN : le même texte à deux endroits finit
// par diverger, et l'écart entre ce qu'une app déclare et ce que sa page
// publique déclare est exactement ce qu'un examinateur de store relève. La
// source unique est src/features/legal/privacyPolicy.json, que l'écran
// app/privacy-policy.tsx lit également.
//
// UNE PAGE PAR LANGUE, et non une seule page à bascule. Une bascule en CSS
// aurait posé deux fois le même identifiant d'ancre — or l'ancre de
// suppression est précisément ce qu'on dépose dans la fiche Play Store, et
// elle doit désigner un seul endroit. Deux fichiers plats n'ont aucun de ces
// problèmes, se référencent l'un l'autre, et se lisent même si tout le reste
// échoue.
//
// RIEN DE DISTANT : ni police, ni feuille de style, ni script tiers. Une page
// juridique doit s'afficher partout, y compris là où tout est bloqué, et ne
// doit rien apprendre à personne sur qui la consulte — une police hébergée
// ailleurs suffirait à créer un journal de visites chez un tiers, sur la page
// même qui promet de ne pas faire ça.
//
//   node scripts/build-legal-page.mjs
//
// puis déployer le dossier legal-site/ (voir le README qu'il contient).

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const data = JSON.parse(readFileSync(join(root, 'src/features/legal/privacyPolicy.json'), 'utf8'));

const CONTACT = 'aldana.antony@gmail.com';

// Les ancres de suppression ne doivent PLUS JAMAIS changer : une adresse
// déposée dans une fiche de store est recopiée ailleurs, et la corriger
// partout n'est jamais possible.
const PAGES = {
  fr: {
    file: 'index.html',
    anchor: 'suppression-de-compte',
    other: { file: 'en.html', label: 'English' },
    eyebrow: 'Céoù — où sont mes affaires',
    contactHeading: 'Contact',
    contactBody:
      "Pour toute question sur tes données, ou pour exercer un droit d'accès, de rectification ou d'export : ",
    description: "Politique de confidentialité de l'application Céoù, et demande de suppression de compte.",
  },
  en: {
    file: 'en.html',
    anchor: 'account-deletion',
    other: { file: 'index.html', label: 'Français' },
    eyebrow: 'Ceou — where my things are',
    contactHeading: 'Contact',
    contactBody: 'For any question about your data, or to exercise a right of access, correction or export: ',
    description: 'Privacy policy of the Ceou app, and account deletion requests.',
  },
};

function escape(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** Rend cliquable l'adresse de contact citée dans un paragraphe. */
function withMailto(html) {
  return html.replaceAll(CONTACT, `<a href="mailto:${CONTACT}">${CONTACT}</a>`);
}

function paragraph(text) {
  return `      <p>${withMailto(escape(text))}</p>`;
}

function sectionHtml({ heading, body }) {
  return `    <section>
      <h2>${escape(heading)}</h2>
${paragraph(body).slice(2)}
    </section>`;
}

function deletionHtml(lang) {
  const block = data.deletion[lang];
  return `    <section class="highlight" id="${PAGES[lang].anchor}">
      <h2>${escape(block.heading)}</h2>
${block.paragraphs.map((text) => paragraph(text).slice(2)).join('\n')}
    </section>`;
}

const STYLE = `    :root {
      color-scheme: light dark;
      --sand: #FFFBF8;
      --ink: #2D2A26;
      --ink-soft: #6B6459;
      --accent: #0B5E9E;
      --line: rgba(45, 42, 38, 0.12);
      --highlight: #F1F7FC;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --sand: #191714;
        --ink: #F4F0E9;
        --ink-soft: #A8A094;
        --accent: #8FCBF7;
        --line: rgba(244, 240, 233, 0.14);
        --highlight: #12324D;
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 2rem 1.25rem 4rem;
      background: var(--sand);
      color: var(--ink);
      font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    main { max-width: 40rem; margin: 0 auto; }
    header { margin-bottom: 2.5rem; }
    .eyebrow { margin: 0 0 0.75rem; color: var(--ink-soft); font-size: 0.875rem; letter-spacing: 0.02em; }
    h1 { margin: 0 0 0.35rem; font-size: 1.75rem; line-height: 1.25; }
    .updated { margin: 0; color: var(--ink-soft); font-size: 0.9375rem; }
    .switch { margin: 1.25rem 0 0; }
    a { color: var(--accent); }
    section { margin-bottom: 1.75rem; }
    h2 { margin: 0 0 0.5rem; font-size: 1.0625rem; line-height: 1.35; }
    p { margin: 0 0 0.75rem; }
    p:last-child { margin-bottom: 0; }
    .highlight { padding: 1.25rem; border: 1px solid var(--line); border-radius: 14px; background: var(--highlight); }
    /* Ciblée depuis la fiche Play Store : elle doit se distinguer dès
       l'arrivée, sans quoi le lecteur atterrit au milieu d'un mur de texte. */
    .highlight:target { border-color: var(--accent); }`;

function page(lang) {
  const meta = PAGES[lang];
  const policy = data.policy[lang];

  return `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escape(policy.title)} — Céoù</title>
  <meta name="description" content="${escape(meta.description)}">
  <link rel="alternate" hreflang="${lang === 'fr' ? 'en' : 'fr'}" href="${meta.other.file}">
  <style>
${STYLE}
  </style>
</head>
<body>
  <main>
    <header>
      <p class="eyebrow">${escape(meta.eyebrow)}</p>
      <h1>${escape(policy.title)}</h1>
      <p class="updated">${escape(policy.updated)}</p>
      <p class="switch"><a href="${meta.other.file}">${escape(meta.other.label)}</a></p>
    </header>

${policy.sections.map(sectionHtml).join('\n')}

${deletionHtml(lang)}

    <section>
      <h2>${escape(meta.contactHeading)}</h2>
      <p>${escape(meta.contactBody)}<a href="mailto:${CONTACT}">${CONTACT}</a></p>
    </section>
  </main>
</body>
</html>
`;
}

const outDir = join(root, 'legal-site');
mkdirSync(outDir, { recursive: true });

for (const lang of Object.keys(PAGES)) {
  writeFileSync(join(outDir, PAGES[lang].file), page(lang), 'utf8');
  console.log(`legal-site/${PAGES[lang].file} — ${data.policy[lang].sections.length} sections, ancre #${PAGES[lang].anchor}`);
}
