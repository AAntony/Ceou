// LES MINI-ÉCRANS DES TUTORIELS, REDESSINÉS POUR LE SITE.
//
// Pendant de src/features/tutoriels/Demos.tsx : les mêmes treize écrans, le
// même décor d'un bout à l'autre (des ciseaux dans une boîte, une perceuse
// achetée chez Darty), et SURTOUT les mêmes mots — lus dans fr.json et
// en.json, jamais réécrits ici. Seul le dessin est refait, en HTML, avec les
// jetons du site : il suit le thème sombre et grandit avec le texte, comme
// dans l'app.
//
// DES ILLUSTRATIONS, PAS DES ÉCRANS. Le dessin porte `aria-hidden`, et c'est
// la légende visible dessous qui est lue. Sans ça, un lecteur d'écran
// énumérerait les libellés d'une interface factice — « Avec facture, Sans
// facture, Darty, 249,00 € » — que personne ne peut atteindre.
//
// UN ÉCRAN AJOUTÉ DANS L'APP DOIT L'ÊTRE ICI AUSSI : le générateur refuse de
// produire une page qui annoncerait un mini-écran qu'il ne sait pas dessiner
// (voir tutorials.mjs).

import { ICONS } from './icons.mjs';
import { escape as e } from './layout.mjs';

/** La vignette grise d'un objet ou d'un document, à gauche d'une rangée. */
const thumb = (icon, extra = '') => `<span class="d-thumb${extra}">${ICONS[icon]}</span>`;

/** Un nom en gras et, dessous, où il se trouve. */
const text = (title, sub) => `<span class="d-text"><b>${e(title)}</b><span>${e(sub)}</span></span>`;

const RENDER = {
  // LE FIL DU GUIDE DE DÉMARRAGE : chaque niveau contient le suivant. Les
  // teintes sont celles de la chaîne de l'accueil, pour qu'on reconnaisse la
  // même idée d'une page à l'autre.
  rangement: (d) => {
    const levels = [
      ['home', 'habitation'],
      ['door', 'piece'],
      ['drawers', 'emplacement'],
      ['box', 'conteneur'],
      ['tag', 'objet'],
    ];
    const items = levels
      .map(([icon, key], i) => `<li style="--lvl:${i}"><span class="d-rail-dot">${ICONS[icon]}</span><b>${e(d[key])}</b></li>`)
      .join('');
    return `<ol class="d-rail">${items}</ol>`;
  },

  // La réponse, c'est le chemin — pas le nom, qu'on connaissait déjà.
  recherche: (d) => `<div class="d-card d-field">${ICONS.search}<span>${e(d.query)}</span></div>
    <div class="d-card">${thumb('tag')}${text(d.result, d.path)}</div>`,

  // L'anneau est sur la tuile dont parle l'étape, et sur aucune autre.
  'tuile-facture': (d) => `<p class="d-heading">${text(d.objet, d.lieu)}</p>
    <div class="d-tiles">
      <span class="d-tile"><span class="d-badge">${ICONS.move}</span>${e(d.move)}</span>
      <span class="d-tile"><span class="d-badge">${ICONS.loan}</span>${e(d.loan)}</span>
      <span class="d-tile is-pulse"><span class="d-badge">${ICONS.receipt}</span>${e(d.facture)}</span>
    </div>`,

  // Les deux onglets sont la moitié de la leçon : le second dit ce qui manque.
  dossier: (d) => `<div class="d-tabs"><span class="is-on">${e(d.tab_with)}</span><span>${e(d.tab_without)}</span></div>
    <div class="d-card d-stack">
      <span class="d-line">${thumb('receipt', ' is-tall')}${text(d.vendor, d.date)}<b class="d-amount">${e(d.amount)}</b></span>
      <span class="d-chips"><span class="d-chip">${ICONS.tag}${e(d.objet_1)}</span><span class="d-chip">${ICONS.tag}${e(d.objet_2)}</span></span>
    </div>`,

  export: (d) => `<div class="d-card d-bar">${ICONS.back}<b>${e(d.title)}</b><span class="d-round is-pulse">${ICONS.export}</span></div>`,

  // La réponse est une phrase, pas une liste : Céoù la dit à voix haute.
  voix: (d) => `<p class="d-primary">${ICONS.mic}${e(d.button)}</p><div class="d-line"><span class="d-mic is-pulse">${ICONS.mic}</span><b>${e(d.question)}</b></div>
    <p class="d-answer">${ICONS.check}<span>${e(d.answer)}</span></p>`,

  'scan-ia': (d) => {
    const rows = ['objet_1', 'objet_2', 'objet_3'].map((key) => `<li>${ICONS.check}${e(d[key])}</li>`).join('');
    return `<div class="d-photo">${ICONS.camera}</div>
    <p class="d-label">${e(d.title)}</p>
    <ul class="d-checks">${rows}</ul>
    <span class="d-primary">${e(d.confirm)}</span>`;
  },

  // Deux formes et trois puces, rien de plus : une pièce est une FORME, un
  // rangement est un POINT posé dedans. Un plan réaliste noierait l'idée.
  plan: (d) => `<div class="d-card d-plan">
      <span class="d-room is-teal"><b>${e(d.piece_1)}</b><span class="d-pill">1</span></span>
      <span class="d-room is-mustard"><b>${e(d.piece_2)}</b></span>
    </div>
    <span class="d-pill">${e(d.mode)}</span><div class="d-card">${thumb('tag')}${text(d.item, d.storage)}</div>`,

  demenagement: (d) => `<p class="d-heading">${e(d.title)}</p><div class="d-chips">${d.phases.map((phase,i)=>`<span class="d-chip">${i+1} · ${e(phase)}</span>`).join('')}</div><p class="d-pill">${e(d.action)}</p><div class="d-card">${thumb('box')}${text(d.box,d.contents)}</div>`,

  pret: (d) => `<div class="d-card d-stack">
      <b>${e(d.objet)}</b>
      <span class="d-meta">${ICONS.loan}${e(d.who)}</span>
      <span class="d-meta">${e(d.due)}</span>
      <span class="d-pill is-outline">${e(d.action)}</span>
    </div>`,

  // Le droit se règle par habitation : la rangée met le logement et le droit
  // sur la même ligne.
  amis: (d) => `<p class="d-heading">${e(d.section)}</p><p class="d-label is-plain">${e(d.code_label)}</p>
    <div class="d-card d-code"><b>${e(d.code)}</b>${ICONS.qr}</div>
    <div class="d-card d-home">${ICONS.home}<span class="d-grow">${e(d.habitation)}</span><span class="d-tag">${e(d.permission)}</span></div>`,

  invite: (d) => `<div class="d-card d-invite"><span>${e(d.label)}</span><b>${e(d.code)}</b><span>${e(d.note)}</span></div>`,

  // L'aperçu est déjà à la taille choisie : « grande » ne veut rien dire tant
  // qu'on n'a pas vu une vraie rangée grandir.
  affichage: (d) => `<p class="d-heading">${e(d.section)}</p><p class="d-label is-plain">${e(d.title)}</p>
    <div class="d-tabs"><span>${e(d.normal)}</span><span class="is-on">${e(d.large)}</span><span>${e(d.huge)}</span></div>
    <div class="d-card is-large">${thumb('tag')}${text(d.preview_name, d.preview_location)}</div>`,

  // L'objet est déjà là, bandeau ou pas : c'est toute la leçon du chapitre.
  'hors-ligne': (d) => `<p class="d-offline">${ICONS.alert}<b>${e(d.banner)}</b></p>
    <div class="d-card">${thumb('tag')}${text(d.objet, d.lieu)}<span class="d-ok">${ICONS.check}</span></div>`,
};

export const DEMO_IDS = Object.keys(RENDER);

/**
 * Un mini-écran et sa légende.
 *
 * `demos` est le bloc `tutoriels.demos` d'une langue. Les identifiants de
 * l'app s'écrivent avec un tiret (`scan-ia`), leurs clés i18n avec un souligné
 * (`scan_ia`) : la conversion est faite ici, une fois.
 */
export function demo(id, demos) {
  const strings = demos[id.replaceAll('-', '_')];
  return `<figure class="demo">
            <div class="demo-screen" aria-hidden="true">
    ${RENDER[id](strings)}
            </div>
            <figcaption>${e(strings.caption)}</figcaption>
          </figure>`;
}
