import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CONTACT,
  DELETION_ANCHOR,
  FILES,
  ORIGIN,
  OTHER,
  SITE,
} from './site/content.mjs';
import { ICONS, planIllustration } from './site/icons.mjs';
import { escape, header, shell, withMailto } from './site/layout.mjs';

// LE SITE PUBLIC DE CÉOÙ, ENGENDRÉ.
//
// Quatre pages dans site/ : l'accueil et la politique de confidentialité,
// chacune en français et en anglais. C'est ce dossier, et lui seul, qu'on
// dépose dans le `www` de l'hébergement.
//
// POURQUOI UN GÉNÉRATEUR ET NON QUATRE FICHIERS ÉCRITS À LA MAIN :
//
//  - Le texte de la politique appartient à l'app. Il vit dans
//    src/features/legal/privacyPolicy.json, que lit aussi l'écran
//    app/privacy-policy.tsx. Recopié ici, il divergerait — et l'écart entre
//    ce qu'une app déclare et ce que sa page publique déclare est exactement
//    ce qu'un examinateur de store relève.
//  - L'en-tête, le pied de page, le style et le menu sont communs aux quatre
//    pages. Écrits quatre fois, ils se désaccorderaient au premier
//    changement.
//  - Les questions de l'accueil servent DEUX FOIS : à l'affichage, et dans
//    la donnée structurée que lisent les moteurs. Une réponse corrigée d'un
//    côté seulement serait invisible et fausse.
//
// Ce fichier assemble ; la matière est à côté, dans scripts/site/ :
// content.mjs (le texte), icons.mjs (les dessins), style.mjs (la feuille),
// layout.mjs (l'en-tête HTML, la navigation, le pied de page, le script).
//
//   node scripts/build-site.mjs
//
// puis déposer site/ par FTP — voir scripts/site.md.

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const legal = JSON.parse(readFileSync(join(root, 'src/features/legal/privacyPolicy.json'), 'utf8'));

/** Un identifiant d'ancre tiré d'un titre : « Tes droits » donne `tes-droits`. */
function slug(value) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// === L'accueil ===========================================================

function heroMock(copy) {
  const mock = copy.hero.mock;
  const results = mock.results
    .map(
      (result) => `            <li>
              <span class="thumb">${ICONS.box}</span>
              <span><b>${escape(result.name)}</b><span>${escape(result.path)}</span></span>
            </li>`,
    )
    .join('\n');

  return `        <div class="device reveal" role="img" aria-label="${escape(mock.label)}">
          <div class="screen">
            <p class="screen-title">${escape(mock.placeholder)}</p>
            <div class="field">
              ${ICONS.search}
              <span class="type">${escape(mock.query)}</span>
            </div>
            <ul class="results">
${results}
            </ul>
          </div>
        </div>`;
}

function detailMock(copy, kind) {
  if (kind === 'plan') {
    return `<div class="mock">${planIllustration(escape(copy.mocks.plan))}</div>`;
  }

  if (kind === 'chat') {
    const lines = copy.mocks.chat.lines
      .map((line) =>
        line.who === 'me'
          ? `            <li class="me">${escape(line.text)}</li>`
          : `            <li class="app"><b>${escape(line.name)}</b><span>${escape(line.path)}</span></li>`,
      )
      .join('\n');
    return `<div class="mock">
          <ul class="chat" role="img" aria-label="${escape(copy.mocks.chat.label)}">
${lines}
          </ul>
        </div>`;
  }

  const rows = copy.mocks.loan.rows
    .map(
      (row) => `            <li>
              <span class="who">${escape(row.initial)}</span>
              <span><b>${escape(row.name)}</b><span class="when">${escape(row.when)}</span></span>
              <span class="tag${row.late ? ' late' : ''}">${escape(row.tag)}</span>
            </li>`,
    )
    .join('\n');
  return `<div class="mock">
          <ul class="loan" role="img" aria-label="${escape(copy.mocks.loan.label)}">
${rows}
          </ul>
        </div>`;
}

function homePage(lang) {
  const copy = SITE[lang];
  const ids = copy.ids;

  const steps = copy.steps.items
    .map(
      (step, i) => `          <li class="step reveal" style="--i:${i}">
            <h3>${escape(step.title)}</h3>
            <p>${escape(step.body)}</p>
          </li>`,
    )
    .join('\n');

  const chain = copy.steps.chain
    .map((level) => `          <li><b>${escape(level)}</b></li>`)
    .join('\n');

  const cards = copy.features.items
    .map(
      (feature, i) => `          <li class="card tone-${feature.tone} reveal" style="--i:${i % 3}">
            <span class="pill">${ICONS[feature.icon]}</span>
            <h3>${escape(feature.title)}</h3>
            <p>${escape(feature.body)}</p>
          </li>`,
    )
    .join('\n');

  const rows = copy.detail.items
    .map((item) => {
      const points = item.points.map((point) => `            <li>${escape(point)}</li>`).join('\n');
      return `      <article class="row">
        <div class="reveal">
          <span class="eyebrow">${escape(item.eyebrow)}</span>
          <h3>${escape(item.title)}</h3>
          <p>${escape(item.body)}</p>
          <ul class="points">
${points}
          </ul>
        </div>
        <div class="row-media reveal">${detailMock(copy, item.mock)}</div>
      </article>`;
    })
    .join('\n');

  const pillars = copy.pillars.items
    .map(
      (pillar, i) => `          <li class="pillar reveal" style="--i:${i}">
            <span class="pill">${ICONS[pillar.icon]}</span>
            <h3>${escape(pillar.title)}</h3>
            <p>${escape(pillar.body)}</p>
          </li>`,
    )
    .join('\n');

  // `name` regroupe les questions en accordéon : en ouvrir une referme la
  // précédente. Là où l'attribut n'est pas encore compris, elles s'ouvrent
  // simplement toutes — le contenu reste atteignable, c'est ce qui compte.
  const faq = copy.faq.items
    .map(
      (item) => `        <details name="faq">
          <summary>${escape(item.q)}</summary>
          <p class="answer">${withMailto(escape(item.a))}</p>
        </details>`,
    )
    .join('\n');

  const body = `${header(lang)}

  <main id="main">
    <div class="wrap">
      <div class="hero">
        <div>
          <p class="pun">${escape(copy.hero.pun)}</p>
          <h1>${escape(copy.hero.title)}</h1>
          <p class="lede">${escape(copy.hero.body)}</p>
          <div class="hero-actions">
            <span class="badge">${escape(copy.hero.badge)}</span>
            <a class="ghost" href="#${ids.features}">${escape(copy.hero.cta)}</a>
          </div>
          <p class="hero-note">${escape(copy.hero.note)}</p>
        </div>
${heroMock(copy)}
      </div>
    </div>

    <section class="section section-alt" id="${ids.how}" data-spy-target>
      <div class="wrap">
        <div class="section-head reveal">
          <h2>${escape(copy.steps.title)}</h2>
          <p class="lede">${escape(copy.steps.lede)}</p>
        </div>
        <ol class="steps">
${steps}
        </ol>
        <ol class="chain reveal" role="img" aria-label="${escape(copy.steps.chainLabel)}">
${chain}
        </ol>
      </div>
    </section>

    <section class="section" id="${ids.features}" data-spy-target>
      <div class="wrap">
        <div class="section-head reveal">
          <h2>${escape(copy.features.title)}</h2>
          <p class="lede">${escape(copy.features.lede)}</p>
        </div>
        <ul class="grid">
${cards}
        </ul>
      </div>
    </section>

    <section class="section section-alt" id="${ids.detail}">
      <div class="wrap">
        <div class="section-head reveal">
          <h2>${escape(copy.detail.title)}</h2>
        </div>
${rows}
      </div>
    </section>

    <section class="section" id="${ids.pillars}" data-spy-target>
      <div class="wrap">
        <div class="section-head reveal">
          <h2>${escape(copy.pillars.title)}</h2>
        </div>
        <ul class="pillars">
${pillars}
        </ul>
        <p style="margin-top:2.5rem"><a href="${FILES.privacy[lang]}">${escape(copy.pillars.link)}</a></p>
      </div>
    </section>

    <section class="section section-alt" id="${ids.faq}" data-spy-target>
      <div class="wrap">
        <div class="section-head reveal">
          <h2>${escape(copy.faq.title)}</h2>
        </div>
        <div class="faq reveal">
${faq}
        </div>
      </div>
    </section>

    <section class="cta">
      <div class="wrap">
        <h2>${escape(copy.cta.title)}</h2>
        <p>${escape(copy.cta.body)}</p>
        <a class="mailto" href="mailto:${CONTACT}">${CONTACT}</a>
      </div>
    </section>
  </main>`;

  return shell({
    lang,
    file: FILES.home[lang],
    title: copy.title,
    description: copy.description,
    body,
    structured: [
      {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'Céoù',
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'Android, iOS',
        inLanguage: ['fr', 'en'],
        description: copy.description,
        url: `${ORIGIN}/`,
        // Ni publicité ni achat dans l'app : le déclarer ici est exact
        // aujourd'hui, et devra être retiré le jour où ça cesserait de
        // l'être — une donnée structurée est une affirmation publique.
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
        privacyPolicy: `${ORIGIN}/${FILES.privacy[lang]}`,
      },
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: copy.faq.items.map((item) => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: { '@type': 'Answer', text: item.a },
        })),
      },
    ],
  });
}

// === La politique de confidentialité =====================================

function privacyPage(lang) {
  const policy = legal.policy[lang];
  const deletion = legal.deletion[lang];
  const copy = SITE[lang];

  // Le sommaire est construit à partir des sections elles-mêmes : une
  // section ajoutée à la politique y apparaît sans qu'on y pense, et on ne
  // peut pas s'y retrouver avec une entrée qui ne mène nulle part.
  const entries = [
    ...policy.sections.map((section) => ({ id: slug(section.heading), label: section.heading })),
    { id: DELETION_ANCHOR[lang], label: deletion.heading },
    { id: 'contact', label: copy.contact.heading },
  ];

  const toc = entries
    .map((entry) => `            <li><a href="#${entry.id}">${escape(entry.label)}</a></li>`)
    .join('\n');

  const sections = policy.sections
    .map(
      (section) => `        <section id="${slug(section.heading)}" data-spy-target>
          <h2>${escape(section.heading)}</h2>
          <p>${withMailto(escape(section.body))}</p>
        </section>`,
    )
    .join('\n');

  const paragraphs = deletion.paragraphs
    .map((text) => `          <p>${withMailto(escape(text))}</p>`)
    .join('\n');

  const body = `${header(lang, { base: FILES.home[lang] })}

  <main id="main">
    <div class="wrap doc-layout">
      <nav class="doc-toc" data-spy aria-label="${escape(copy.docToc)}">
        <h2>${escape(copy.docToc)}</h2>
        <ul>
${toc}
        </ul>
      </nav>

      <div class="doc">
        <h1>${escape(policy.title)}</h1>
        <p class="updated">${escape(policy.updated)}</p>

${sections}

        <section class="highlight" id="${DELETION_ANCHOR[lang]}" data-spy-target>
          <h2>${escape(deletion.heading)}</h2>
${paragraphs}
        </section>

        <section id="contact" data-spy-target>
          <h2>${escape(copy.contact.heading)}</h2>
          <p>${escape(copy.contact.body)}<a href="mailto:${CONTACT}">${CONTACT}</a></p>
        </section>

        <a class="doc-back" href="${FILES.home[lang]}">${escape(copy.docBack)}</a>
      </div>
    </div>
  </main>`;

  return shell({
    lang,
    file: FILES.privacy[lang],
    bodyClass: 'doc-page',
    title: `${policy.title} — Céoù`,
    description:
      lang === 'fr'
        ? "Politique de confidentialité de l'application Céoù, et demande de suppression de compte."
        : 'Privacy policy of the Céoù app, and account deletion requests.',
    body,
  });
}

// === Écriture ============================================================

const outDir = join(root, 'site');
mkdirSync(outDir, { recursive: true });

for (const lang of ['fr', 'en']) {
  writeFileSync(join(outDir, FILES.home[lang]), homePage(lang), 'utf8');
  writeFileSync(join(outDir, FILES.privacy[lang]), privacyPage(lang), 'utf8');
}

// LE SEUL FICHIER QUI N'EST PAS DU TEXTE. Il ne sert qu'aux vignettes de
// partage — quand quelqu'un colle l'adresse dans une conversation — et à
// l'icône d'un raccourci posé sur un écran d'accueil. C'est l'icône de
// l'app, copiée : deux images différentes pour la même chose finiraient par
// ne plus se ressembler.
copyFileSync(join(root, 'assets/icon.png'), join(outDir, 'og-image.png'));

const pages = ['fr', 'en'].flatMap((lang) => [FILES.home[lang], FILES.privacy[lang]]);
console.log(`site/ : ${pages.join(', ')}, og-image.png`);
console.log(`ancres de suppression : #${DELETION_ANCHOR.fr} (fr), #${DELETION_ANCHOR.en} (en)`);
console.log(`langue alternee : ${FILES.home.fr} <-> ${FILES.home[OTHER.fr]}`);
