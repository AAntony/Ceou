import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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
//  - L'en-tête, le pied de page et le style sont communs aux quatre pages.
//    Écrits quatre fois, ils se désaccorderaient au premier changement.
//
// RIEN DE DISTANT : ni police, ni feuille de style, ni script, ni image
// hébergée ailleurs. Le logo est un SVG écrit dans la page. Trois raisons :
// le site s'affiche partout, y compris là où tout est bloqué ; il ne peut
// pas casser parce qu'un tiers a bougé ; et il n'apprend rien à personne sur
// qui le consulte — ce qui serait malvenu sur un site dont une page promet
// justement de ne pas faire ça.
//
//   node scripts/build-site.mjs
//
// puis déposer site/ par FTP — voir scripts/site.md.

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const legal = JSON.parse(readFileSync(join(root, 'src/features/legal/privacyPolicy.json'), 'utf8'));

const CONTACT = 'contact@ceou.eu';

// Les noms de fichiers et les ancres partent dans les fiches de store, où une
// adresse déposée est recopiée ailleurs et ne se corrige jamais partout.
// À FIGER une fois la première soumission faite.
const FILES = {
  home: { fr: 'index.html', en: 'en.html' },
  privacy: { fr: 'confidentialite.html', en: 'privacy.html' },
};
const DELETION_ANCHOR = { fr: 'suppression-de-compte', en: 'account-deletion' };

const OTHER = { fr: 'en', en: 'fr' };

// === Le contenu de l'accueil =============================================
//
// Il ne vit PAS dans privacyPolicy.json : ce texte n'appartient qu'au site,
// l'app n'en connaît pas un mot. Le mélanger au texte juridique ferait croire
// que les deux ont la même exigence — l'un se relit avant chaque publication,
// l'autre se réécrit quand on veut.

const HOME = {
  fr: {
    lang: 'fr',
    title: 'Céoù — sais toujours où sont tes affaires',
    description:
      "Céoù note où tu ranges tes affaires, pièce par pièce, et te le redit quand tu l'as oublié. Hors ligne, sans publicité, hébergé dans l'Union européenne.",
    switchLabel: 'English',
    nav: { privacy: 'Confidentialité' },
    hero: {
      wordmark: 'Céoù',
      pun: 'Comme « c’est où ? »',
      title: 'Range une fois. Retrouve toujours.',
      body: "Céoù retient où tu poses tes affaires — quelle pièce, quel meuble, quelle boîte — et te le redit le jour où tu ne t'en souviens plus.",
      soon: 'Bientôt sur Android et iOS.',
    },
    featuresTitle: 'Ce que Céoù sait faire',
    features: [
      {
        title: 'Range comme chez toi',
        body: 'Logement, pièce, meuble, boîte, objet. La même logique que ton appartement — pas une liste à plat où tout se ressemble.',
      },
      {
        title: 'Retrouve d’un mot',
        body: 'Tape « perceuse ». Céoù répond dans quelle boîte, dans quel meuble, dans quelle pièce, dans quel logement.',
      },
      {
        title: 'Demande à voix haute',
        body: '« Où sont mes clés ? » Pose la question, l’assistant répond. Il peut même ranger un objet à ta place, sans que tu touches l’écran.',
      },
      {
        title: 'Le plan de ton logement',
        body: 'Dessine tes pièces, pose tes meubles dessus, retrouve un objet d’un coup d’œil. Et si tu préfères lire, le même plan existe en liste.',
      },
      {
        title: 'Photographie, scanne',
        body: 'Une photo par objet, pour reconnaître sans lire. Un code-barre pour retrouver un nom tout seul. Une photo de tiroir pour créer plusieurs objets d’un coup.',
      },
      {
        title: 'Prête sans oublier',
        body: 'Note à qui tu prêtes, et ce qu’on t’a prêté. Céoù te rappelle ce qui n’est pas revenu — l’objet, lui, garde sa place au retour.',
      },
    ],
    pillars: [
      {
        title: 'Pensé pour être lisible',
        body: 'Le texte grossit jusqu’à deux fois sans que rien ne se casse ni ne se tronque. Le plan se lit aussi en liste, pour qui ne voit pas l’écran ou ne peut pas le pincer. Thème sombre, grandes cibles, contrastes vérifiés un par un.',
      },
      {
        title: 'Marche sans réseau',
        body: 'Une cave, un garage, un box en sous-sol : Céoù continue de répondre sur ce qu’il sait déjà, enregistre ce que tu changes, et l’envoie tout seul au retour du réseau.',
      },
      {
        title: 'Tes données restent les tiennes',
        body: 'Hébergées dans l’Union européenne. Jamais vendues, jamais de publicité, jamais partagées au-delà de ce que tu choisis. Tout se supprime depuis l’application, définitivement.',
      },
    ],
    closing: {
      title: 'Une question ?',
      body: 'Écris, on répond.',
    },
    contact: {
      heading: 'Contact',
      body: "Pour toute question sur tes données, ou pour exercer un droit d'accès, de rectification ou d'export : ",
    },
    footer: { privacy: 'Confidentialité', tagline: 'Céoù — sais toujours où sont tes affaires' },
  },

  en: {
    lang: 'en',
    title: 'Ceou — always know where your things are',
    description:
      'Ceou remembers where you put your things, room by room, and tells you when you have forgotten. Works offline, no ads, hosted in the European Union.',
    switchLabel: 'Français',
    nav: { privacy: 'Privacy' },
    hero: {
      wordmark: 'Céoù',
      pun: 'French for “where is it?”',
      title: 'Put it away once. Find it every time.',
      body: 'Ceou remembers where you put your things — which room, which piece of furniture, which box — and tells you on the day you cannot remember.',
      soon: 'Coming soon to Android and iOS.',
    },
    featuresTitle: 'What Ceou does',
    features: [
      {
        title: 'Organised like your home',
        body: 'Home, room, furniture, box, item. The same logic as your flat — not a flat list where everything looks alike.',
      },
      {
        title: 'Find it with one word',
        body: 'Type “drill”. Ceou answers which box, in which piece of furniture, in which room, in which home.',
      },
      {
        title: 'Just ask out loud',
        body: '“Where are my keys?” Ask, and the assistant answers. It can even put an item away for you, without you touching the screen.',
      },
      {
        title: 'A plan of your home',
        body: 'Draw your rooms, place your furniture on them, spot an item at a glance. And if you would rather read, the same plan exists as a list.',
      },
      {
        title: 'Photograph, scan',
        body: 'A photo per item, to recognise without reading. A barcode to fetch a name on its own. A photo of a drawer to create several items at once.',
      },
      {
        title: 'Lend without forgetting',
        body: 'Record who you lent to, and what was lent to you. Ceou reminds you what has not come back — and the item keeps its place for its return.',
      },
    ],
    pillars: [
      {
        title: 'Built to be readable',
        body: 'Text grows to twice its size without breaking or truncating anything. The plan can also be read as a list, for anyone who cannot see the screen or pinch it. Dark theme, large targets, contrasts checked one by one.',
      },
      {
        title: 'Works without a network',
        body: 'A cellar, a garage, a basement storage unit: Ceou keeps answering from what it already knows, records what you change, and sends it on its own once the network is back.',
      },
      {
        title: 'Your data stays yours',
        body: 'Hosted in the European Union. Never sold, never used for advertising, never shared beyond what you choose. Everything can be deleted from the app, permanently.',
      },
    ],
    closing: {
      title: 'A question?',
      body: 'Write to us, we answer.',
    },
    contact: {
      heading: 'Contact',
      body: 'For any question about your data, or to exercise a right of access, correction or export: ',
    },
    footer: { privacy: 'Privacy', tagline: 'Ceou — always know where your things are' },
  },
};

// === Habillage commun ====================================================

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

// Le repère de l'app : la goutte bleue percée d'un rond clair, reprise telle
// quelle de docs/index.html pour que la page d'atterrissage des e-mails et le
// site portent le même signe.
const MARK = `<svg class="mark" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M32 6c-9.4 0-17 7.6-17 17 0 12.8 17 35 17 35s17-22.2 17-35c0-9.4-7.6-17-17-17z" fill="currentColor"/>
      <circle cx="32" cy="22" r="7.5" fill="var(--sand)"/>
    </svg>`;

// Un plan miniature, dessiné plutôt que photographié : c'est l'écran le plus
// reconnaissable de l'app, et une capture aurait vieilli au premier
// changement d'interface. Les pastels sont ceux de la palette des pièces.
const ILLUSTRATION = `<svg class="plan" viewBox="0 0 320 210" role="img" aria-labelledby="planTitle">
      <title id="planTitle">PLAN_TITLE</title>
      <rect x="8" y="8" width="304" height="194" rx="14" fill="var(--card)" stroke="var(--line)"/>
      <g opacity="0.55">
        <rect x="28" y="28" width="128" height="92" rx="4" fill="#BFD7EA"/>
        <rect x="156" y="28" width="128" height="52" rx="4" fill="#C9E4C5"/>
        <rect x="156" y="80" width="128" height="40" rx="4" fill="#FCE8A8"/>
        <rect x="28" y="120" width="256" height="62" rx="4" fill="#BEE3DB"/>
      </g>
      <g stroke="var(--ink)" fill="none" stroke-linecap="round">
        <!-- Deux epaisseurs, comme sur le plan de l'app : le mur qui ferme
             le logement est porteur et se trace epais, une cloison entre
             deux pieces est fine. Les trous sont des portes. -->
        <path d="M28 28h256v154H28z" stroke-width="3.5"/>
        <g stroke-width="2">
          <path d="M156 28v30M156 74v46"/>
          <path d="M156 80h48M232 80h52"/>
          <path d="M28 120h72M132 120h152"/>
        </g>
      </g>
      <circle cx="196" cy="150" r="15" fill="var(--blue)"/>
      <circle cx="196" cy="150" r="5.5" fill="var(--sand)"/>
    </svg>`;

const STYLE = `    :root {
      color-scheme: light dark;
      --sand: #FFFBF8;
      --card: #FFFFFF;
      --ink: #2D2A26;
      --ink-soft: #6B6459;
      --blue: #1591EA;
      --link: #0B5E9E;
      --line: rgba(45, 42, 38, 0.12);
      --chip: #F1F7FC;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --sand: #191714;
        --card: #201E1A;
        --ink: #F4F0E9;
        --ink-soft: #A8A094;
        --blue: #1591EA;
        --link: #8FCBF7;
        --line: rgba(244, 240, 233, 0.14);
        --chip: #12324D;
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--sand);
      color: var(--ink);
      font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui, sans-serif;
      -webkit-text-size-adjust: 100%;
    }
    .wrap { width: 100%; max-width: 62rem; margin: 0 auto; padding: 0 1.25rem; }
    a { color: var(--link); }

    /* En-tête : le nom à gauche, le strict nécessaire à droite. */
    .top { display: flex; align-items: center; gap: 1rem; padding: 1.5rem 0; }
    .brand { display: flex; align-items: center; gap: 0.6rem; margin-right: auto; color: var(--blue); text-decoration: none; }
    .brand .mark { width: 26px; height: 26px; display: block; }
    .brand span { font-size: 1.125rem; font-weight: 700; color: var(--ink); letter-spacing: -0.01em; }
    .top nav { display: flex; gap: 1.25rem; font-size: 0.9375rem; }

    /* Accueil */
    .hero { padding: 2rem 0 3.5rem; display: grid; gap: 2.5rem; align-items: center; }
    @media (min-width: 52rem) { .hero { grid-template-columns: 1.05fr 1fr; padding: 3.5rem 0 5rem; } }
    .pun { margin: 0 0 0.75rem; font-size: 0.875rem; color: var(--ink-soft); }
    .hero h1 { margin: 0 0 1rem; font-size: clamp(2rem, 6vw, 3rem); line-height: 1.1; letter-spacing: -0.02em; }
    .lede { margin: 0 0 1.5rem; font-size: 1.125rem; color: var(--ink-soft); max-width: 34rem; }
    .soon { display: inline-block; margin: 0; padding: 0.5rem 0.9rem; border-radius: 999px;
            background: var(--chip); color: var(--link); font-size: 0.875rem; font-weight: 600; }
    .plan { width: 100%; height: auto; display: block; }

    /* Sections */
    section { padding: 3rem 0; border-top: 1px solid var(--line); }
    h2 { margin: 0 0 1.75rem; font-size: 1.5rem; line-height: 1.25; letter-spacing: -0.01em; }
    h3 { margin: 0 0 0.4rem; font-size: 1.0625rem; line-height: 1.3; }
    p { margin: 0; color: var(--ink-soft); }

    .grid { display: grid; gap: 1rem; }
    @media (min-width: 40rem) { .grid { grid-template-columns: repeat(2, 1fr); } }
    @media (min-width: 58rem) { .grid { grid-template-columns: repeat(3, 1fr); } }
    .card { padding: 1.5rem; border: 1px solid var(--line); border-radius: 18px; background: var(--card); }

    .pillars { display: grid; gap: 2rem; }
    @media (min-width: 52rem) { .pillars { grid-template-columns: repeat(3, 1fr); gap: 2.5rem; } }
    .pillars h3 { color: var(--ink); }

    .closing { text-align: center; }
    .closing p { margin-bottom: 1rem; }
    .mailto { font-size: 1.125rem; font-weight: 600; }

    footer { padding: 2.5rem 0 3.5rem; border-top: 1px solid var(--line); font-size: 0.875rem; color: var(--ink-soft); }
    footer .links { display: flex; flex-wrap: wrap; gap: 1.25rem; margin-bottom: 0.75rem; }

    /* Pages de la politique : une colonne étroite, faite pour être lue —
       en-tête et pied de page compris, sans quoi le logo se calerait sur la
       largeur du site et le texte sur la sienne, deux bords gauches
       différents sur un grand écran. */
    .doc-page .wrap { max-width: 44rem; }
    /* padding-top/bottom et NON le raccourci : la forme courte remettrait
       les marges latérales de .wrap à zéro, et le texte irait toucher le
       bord de l'écran alors que l'en-tête garderait les siennes. */
    .doc { padding-top: 1rem; padding-bottom: 3rem; }
    .doc h1 { margin: 0 0 0.35rem; font-size: 1.75rem; line-height: 1.25; }
    .updated { margin: 0 0 2.5rem; color: var(--ink-soft); font-size: 0.9375rem; }
    .doc section { padding: 0; border: 0; margin-bottom: 1.75rem; }
    .doc h2 { margin: 0 0 0.5rem; font-size: 1.0625rem; line-height: 1.35; }
    .doc p { margin: 0 0 0.75rem; }
    .doc p:last-child { margin-bottom: 0; }
    .highlight { padding: 1.25rem; border: 1px solid var(--line); border-radius: 14px; background: var(--chip); }
    /* Ciblée depuis la fiche Play Store : elle doit se distinguer dès
       l'arrivée, sans quoi le lecteur atterrit au milieu d'un mur de texte. */
    .highlight:target { border-color: var(--link); }`;

function shell({ lang, title, description, alternate, body, bodyClass = '' }) {
  return `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escape(title)}</title>
  <meta name="description" content="${escape(description)}">
  <link rel="alternate" hreflang="${OTHER[lang]}" href="${alternate}">
  <style>
${STYLE}
  </style>
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ''}>
${body}
</body>
</html>
`;
}

function header(lang) {
  const copy = HOME[lang];
  return `  <div class="wrap">
    <div class="top">
      <a class="brand" href="${FILES.home[lang]}">
        ${MARK}
        <span>Céoù</span>
      </a>
      <nav>
        <a href="${FILES.privacy[lang]}">${escape(copy.nav.privacy)}</a>
        <a href="${FILES.home[OTHER[lang]]}">${escape(copy.switchLabel)}</a>
      </nav>
    </div>
  </div>`;
}

function footer(lang) {
  const copy = HOME[lang];
  return `  <div class="wrap">
    <footer>
      <div class="links">
        <a href="${FILES.privacy[lang]}">${escape(copy.footer.privacy)}</a>
        <a href="mailto:${CONTACT}">${CONTACT}</a>
        <a href="${FILES.home[OTHER[lang]]}">${escape(copy.switchLabel)}</a>
      </div>
      <p>${escape(copy.footer.tagline)}</p>
    </footer>
  </div>`;
}

// === L'accueil ===========================================================

function homePage(lang) {
  const copy = HOME[lang];
  const planTitle = lang === 'fr' ? 'Un plan de logement avec ses pièces et un repère' : 'A home plan with its rooms and a marker';

  const cards = copy.features
    .map(
      (feature) => `        <div class="card">
          <h3>${escape(feature.title)}</h3>
          <p>${escape(feature.body)}</p>
        </div>`,
    )
    .join('\n');

  const pillars = copy.pillars
    .map(
      (pillar) => `        <div>
          <h3>${escape(pillar.title)}</h3>
          <p>${escape(pillar.body)}</p>
        </div>`,
    )
    .join('\n');

  const body = `${header(lang)}

  <main>
    <div class="wrap">
      <div class="hero">
        <div>
          <p class="pun">${escape(copy.hero.pun)}</p>
          <h1>${escape(copy.hero.title)}</h1>
          <p class="lede">${escape(copy.hero.body)}</p>
          <p class="soon">${escape(copy.hero.soon)}</p>
        </div>
        ${ILLUSTRATION.replace('PLAN_TITLE', escape(planTitle))}
      </div>

      <section>
        <h2>${escape(copy.featuresTitle)}</h2>
        <div class="grid">
${cards}
        </div>
      </section>

      <section>
        <div class="pillars">
${pillars}
        </div>
      </section>

      <section class="closing">
        <h2>${escape(copy.closing.title)}</h2>
        <p>${escape(copy.closing.body)}</p>
        <p class="mailto"><a href="mailto:${CONTACT}">${CONTACT}</a></p>
      </section>
    </div>
  </main>

${footer(lang)}`;

  return shell({
    lang,
    title: copy.title,
    description: copy.description,
    alternate: FILES.home[OTHER[lang]],
    body,
  });
}

// === La politique de confidentialité =====================================

function privacyPage(lang) {
  const policy = legal.policy[lang];
  const deletion = legal.deletion[lang];
  const copy = HOME[lang];

  const sections = policy.sections
    .map(
      (section) => `      <section>
        <h2>${escape(section.heading)}</h2>
        <p>${withMailto(escape(section.body))}</p>
      </section>`,
    )
    .join('\n');

  const paragraphs = deletion.paragraphs
    .map((text) => `        <p>${withMailto(escape(text))}</p>`)
    .join('\n');

  const body = `${header(lang)}

  <main>
    <div class="wrap doc">
      <h1>${escape(policy.title)}</h1>
      <p class="updated">${escape(policy.updated)}</p>

${sections}

      <section class="highlight" id="${DELETION_ANCHOR[lang]}">
        <h2>${escape(deletion.heading)}</h2>
${paragraphs}
      </section>

      <section>
        <h2>${escape(copy.contact.heading)}</h2>
        <p>${escape(copy.contact.body)}<a href="mailto:${CONTACT}">${CONTACT}</a></p>
      </section>
    </div>
  </main>

${footer(lang)}`;

  return shell({
    lang,
    bodyClass: 'doc-page',
    title: `${policy.title} — Céoù`,
    description:
      lang === 'fr'
        ? "Politique de confidentialité de l'application Céoù, et demande de suppression de compte."
        : 'Privacy policy of the Ceou app, and account deletion requests.',
    alternate: FILES.privacy[OTHER[lang]],
    body,
  });
}

// === Écriture ============================================================

const outDir = join(root, 'site');
mkdirSync(outDir, { recursive: true });

for (const lang of ['fr', 'en']) {
  writeFileSync(join(outDir, FILES.home[lang]), homePage(lang), 'utf8');
  writeFileSync(join(outDir, FILES.privacy[lang]), privacyPage(lang), 'utf8');
  console.log(`site/${FILES.home[lang]} et site/${FILES.privacy[lang]} — ancre #${DELETION_ANCHOR[lang]}`);
}
