// LE GABARIT COMMUN AUX QUATRE PAGES.
//
// En-tête, pied de page, en-tête HTML et script : écrits une fois. Répétés
// dans chaque page, ils se désaccorderaient au premier changement — et le
// premier symptôme serait un menu qui n'a pas les mêmes entrées selon la
// page où on se trouve.

import { CONTACT, DELETION_ANCHOR as DELETION, FILES, ORIGIN, OTHER, SITE } from './content.mjs';
import { FAVICON, MARK } from './icons.mjs';
import { STYLE } from './style.mjs';

export function escape(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** Rend cliquable l'adresse de contact citée au fil d'un paragraphe. */
export function withMailto(html) {
  return html.replaceAll(CONTACT, `<a href="mailto:${CONTACT}">${CONTACT}</a>`);
}

/** Une donnée déposée dans un <script type="application/ld+json">. */
function jsonLd(data) {
  // Le seul échappement qui compte ici : une chaîne contenant « </script> »
  // fermerait la balise depuis l'intérieur. Le reste, JSON s'en charge.
  return JSON.stringify(data, null, 2).replaceAll('<', String.fromCharCode(92) + 'u003c');
}

// LE SCRIPT DE LA PAGE, ET IL NE FAIT QUE DU CONFORT.
//
// Menu repliable, ombre de l'en-tête, apparitions au défilement, lien de
// menu souligné pour la section qu'on lit. Rien de ce qu'il fait n'est
// nécessaire pour lire la page : la classe `js` posée en tête de document
// conditionne les règles CSS correspondantes, et sans elle tout s'affiche
// d'un coup. Un script bloqué doit coûter une animation, jamais un contenu.
const SCRIPT = `(function () {
  var top = document.querySelector('.top');
  var burger = top && top.querySelector('.burger');

  if (burger) {
    var setOpen = function (open) {
      top.setAttribute('data-open', open ? 'true' : 'false');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      burger.setAttribute('aria-label', open ? burger.getAttribute('data-label-close') : burger.getAttribute('data-label-open'));
    };
    burger.addEventListener('click', function () {
      setOpen(top.getAttribute('data-open') !== 'true');
    });
    // Un lien suivi referme le panneau : sur telephone il recouvre le haut
    // de la page, et on atterrirait sur une section cachee par le menu.
    Array.prototype.forEach.call(top.querySelectorAll('.nav a'), function (a) {
      a.addEventListener('click', function () { setOpen(false); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && top.getAttribute('data-open') === 'true') {
        setOpen(false);
        burger.focus();
      }
    });
  }

  var spySections = Array.prototype.slice.call(document.querySelectorAll('[data-spy-target]'));
  var spyLinks = Array.prototype.slice.call(document.querySelectorAll('[data-spy] a[href*="#"]'));

  var onScroll = function () {
    if (top) { top.classList.toggle('is-stuck', window.scrollY > 8); }
    if (!spySections.length) { return; }
    var current = null;
    for (var i = 0; i < spySections.length; i++) {
      if (spySections[i].getBoundingClientRect().top <= 130) { current = spySections[i]; }
    }
    // Arrive en bas, la derniere section peut n'avoir jamais franchi la
    // ligne : on la designe quand meme, sinon le menu revient au debut.
    if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4) {
      current = spySections[spySections.length - 1];
    }
    var id = current ? current.id : '';
    for (var j = 0; j < spyLinks.length; j++) {
      var href = spyLinks[j].getAttribute('href');
      if (id && href.slice(href.indexOf('#') + 1) === id) {
        spyLinks[j].setAttribute('aria-current', 'true');
      } else {
        spyLinks[j].removeAttribute('aria-current');
      }
    }
  };

  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) { return; }
    ticking = true;
    window.requestAnimationFrame(function () { onScroll(); ticking = false; });
  }, { passive: true });
  onScroll();

  var reveal = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
  var revealAll = function () {
    for (var k = 0; k < reveal.length; k++) { reveal[k].classList.add('in'); }
  };

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) { return; }
        entry.target.classList.add('in');
        // Une fois entre, on cesse d'observer : l'animation ne se rejoue
        // pas en remontant, et le navigateur n'a plus rien a surveiller.
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.06 });
    reveal.forEach(function (el) { io.observe(el); });

    // FILET DE SECURITE, ET IL A DEJA SERVI.
    //
    // Un observateur peut exister sans jamais repondre : page rendue hors
    // ecran, onglet en veille, moteur qui n'appelle pas le premier rappel.
    // Le contenu resterait alors a opacite nulle, c'est-a-dire invisible.
    // Si rien n'a ete revele au bout de neuf dixiemes de seconde, on
    // montre tout : mieux vaut perdre l'animation que la page. Le delai est
    // choisi bien au-dela du premier rappel d'un observateur en bonne sante
    // — immediat — et assez court pour qu'un ecran vide ne s'installe pas.
    window.setTimeout(function () {
      if (!document.querySelector('.reveal.in')) { revealAll(); }
    }, 900);
  } else {
    revealAll();
  }
}());`;

/**
 * L'en-tête de navigation.
 *
 * `base` vaut '' sur l'accueil (les ancres visent la page courante) et le nom
 * de l'accueil sur les pages de politique — d'où le menu ramène vers la
 * section demandée plutôt que de ne rien faire.
 */
export function header(lang, { base = '' } = {}) {
  const copy = SITE[lang];
  const links = copy.nav
    .map((item) => `        <a href="${base}#${copy.ids[item.to]}">${escape(item.label)}</a>`)
    .join('\n');

  return `  <header class="top" data-open="false">
    <div class="wrap top-inner">
      <a class="brand" href="${FILES.home[lang]}">
        ${MARK}
        <span>Céoù</span>
      </a>
      <button class="burger" type="button" aria-expanded="false" aria-controls="site-nav"
              aria-label="${escape(copy.menu.open)}"
              data-label-open="${escape(copy.menu.open)}" data-label-close="${escape(copy.menu.close)}">
        <span></span>
      </button>
      <nav class="nav" id="site-nav"${base ? '' : ' data-spy'} aria-label="${escape(copy.footer.nav)}">
${links}
        <a href="${FILES.privacy[lang]}">${escape(copy.navPrivacy)}</a>
        <span class="nav-sep" aria-hidden="true"></span>
        <a class="lang" href="${FILES.home[OTHER[lang]]}" hreflang="${OTHER[lang]}" lang="${OTHER[lang]}"
           title="${escape(copy.switchTitle)}">${escape(copy.switchLabel)}</a>
      </nav>
    </div>
  </header>`;
}

export function footer(lang) {
  const copy = SITE[lang];
  const links = copy.nav
    .map((item) => `            <li><a href="${FILES.home[lang]}#${copy.ids[item.to]}">${escape(item.label)}</a></li>`)
    .join('\n');

  return `  <div class="wrap">
    <footer class="foot">
      <div class="foot-grid">
        <div>
          <span class="brand">${MARK}<span>Céoù</span></span>
          <p class="tagline">${escape(copy.footer.tagline)}</p>
          <p class="eu">${escape(copy.footer.eu)}</p>
        </div>
        <div>
          <h2>${escape(copy.footer.nav)}</h2>
          <ul>
${links}
          </ul>
        </div>
        <div>
          <h2>${escape(copy.footer.legal)}</h2>
          <ul>
            <li><a href="${FILES.privacy[lang]}">${escape(copy.footer.privacy)}</a></li>
            <li><a href="${FILES.privacy[lang]}#${escape(DELETION[lang])}">${escape(copy.footer.deletion)}</a></li>
            <li><a href="mailto:${CONTACT}">${CONTACT}</a></li>
            <li><a href="${FILES.home[OTHER[lang]]}" hreflang="${OTHER[lang]}" lang="${OTHER[lang]}">${escape(copy.switchLabel)}</a></li>
          </ul>
        </div>
      </div>
    </footer>
  </div>`;
}

/**
 * Le document complet.
 *
 * `file` est le nom du fichier engendré : il sert à l'adresse canonique et à
 * la carte de partage, qui n'acceptent ni l'une ni l'autre un chemin relatif.
 */
export function shell({ lang, file, title, description, body, bodyClass = '', structured = [] }) {
  const other = OTHER[lang];
  const isHome = file === FILES.home[lang];
  // UNE SEULE FORME D'ADRESSE PAR PAGE. `index.html` répond aussi à la racine
  // nue, et déclarer l'une comme canonique tout en pointant l'autre depuis la
  // page voisine donnerait deux adresses pour une même page — ce qui divise
  // ce qu'un moteur en sait au lieu de l'additionner.
  const url = (name) => `${ORIGIN}/${name === 'index.html' ? '' : name}`;
  const canonical = url(file);
  const alternate = url(isHome ? FILES.home[other] : FILES.privacy[other]);
  const defaultUrl = url(isHome ? FILES.home.fr : FILES.privacy.fr);

  const ld = structured
    .map((data) => `  <script type="application/ld+json">\n${jsonLd(data)}\n  </script>`)
    .join('\n');

  return `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escape(title)}</title>
  <meta name="description" content="${escape(description)}">
  <link rel="canonical" href="${canonical}">
  <link rel="alternate" hreflang="${other}" href="${alternate}">
  <link rel="alternate" hreflang="${lang}" href="${canonical}">
  <link rel="alternate" hreflang="x-default" href="${defaultUrl}">
  <link rel="icon" href="${FAVICON}">
  <link rel="apple-touch-icon" href="og-image.png">
  <meta name="theme-color" content="#FFFBF8" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#191714" media="(prefers-color-scheme: dark)">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Céoù">
  <meta property="og:locale" content="${lang === 'fr' ? 'fr_FR' : 'en_GB'}">
  <meta property="og:title" content="${escape(title)}">
  <meta property="og:description" content="${escape(description)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${ORIGIN}/og-image.png">
  <meta property="og:image:width" content="1024">
  <meta property="og:image:height" content="1024">
  <meta name="twitter:card" content="summary">
  <!-- Posee avant tout affichage : les regles d'animation en dependent, et
       la poser plus tard ferait clignoter la page une fois construite. -->
  <script>document.documentElement.classList.add('js');</script>
  <style>${STYLE}</style>
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ''}>
  <div class="progress" aria-hidden="true"></div>
  <a class="skip" href="#main">${escape(SITE[lang].skip)}</a>
${body}
${footer(lang)}
${ld}
  <script>${SCRIPT}</script>
</body>
</html>
`;
}
