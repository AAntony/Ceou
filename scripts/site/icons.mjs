// LES DESSINS DU SITE, TOUS ÉCRITS DANS LA PAGE.
//
// Aucun fichier d'icônes, aucune police d'icônes, rien de distant. Trois
// raisons, les mêmes que pour le reste du site : il s'affiche partout, y
// compris là où les requêtes vers un tiers sont bloquées ; il ne peut pas
// casser parce que quelqu'un a bougé un fichier ailleurs ; et il n'apprend
// rien à personne sur qui le consulte — ce qui serait malvenu sur un site
// dont une page promet justement de ne pas faire ça.
//
// Tout est tracé en `currentColor` : une icône prend la couleur de la
// pastille qui la porte, et le thème sombre n'a rien de spécial à faire.

/** Enveloppe commune : même grille, même épaisseur, mêmes extrémités. */
function stroke(paths) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

export const ICONS = {
  // Une maison, et une boîte dedans : la hiérarchie de l'app en un dessin.
  home: stroke('<path d="M3 10.6 12 3.5l9 7.1"/><path d="M5.6 9.6V20h12.8V9.6"/><rect x="9" y="13" width="6" height="4.6" rx="1"/>'),
  // Un carton vu de trois quarts : la vignette d'un objet dans les listes.
  box: stroke('<path d="M3.6 7.5 12 3.5l8.4 4v9L12 20.5 3.6 16.5v-9Z"/><path d="M3.6 7.5 12 11.6l8.4-4.1"/><path d="M12 11.6v8.9"/>'),
  search: stroke('<circle cx="10.6" cy="10.6" r="6.6"/><path d="m15.4 15.4 4.6 4.6"/>'),
  mic: stroke('<rect x="9" y="3" width="6" height="10.5" rx="3"/><path d="M5.6 11.4a6.4 6.4 0 0 0 12.8 0"/><path d="M12 17.8V21"/>'),
  // Un plan : deux pièces, et un trou dans la cloison — une porte.
  plan: stroke('<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M10.6 4.5v4.2M10.6 12.4v7.1"/><path d="M10.6 12.4h9.9"/>'),
  // Les quatre coins du cadre de visée, et l'objectif au milieu.
  scan: stroke('<path d="M4 8.6V6.4a2.4 2.4 0 0 1 2.4-2.4h2.2"/><path d="M20 8.6V6.4A2.4 2.4 0 0 0 17.6 4h-2.2"/><path d="M4 15.4v2.2A2.4 2.4 0 0 0 6.4 20h2.2"/><path d="M20 15.4v2.2a2.4 2.4 0 0 1-2.4 2.4h-2.2"/><circle cx="12" cy="12" r="3.1"/>'),
  // Une boîte prise dans une boucle : elle est sortie, elle revient.
  loan: stroke('<path d="M12 3.8a8.2 8.2 0 1 1-7.8 5.7"/><path d="M4.2 4.2v5.3h5.3"/><rect x="9.2" y="9.2" width="5.6" height="5.6" rx="1.4"/>'),

  // Un A et une flèche de taille : le réglage qui compte le plus ici.
  a11y: stroke('<path d="M3.6 19 8.8 5.4 14 19"/><path d="M5.6 14.6h6.4"/><path d="M18.6 8.4v10.2M18.6 8.4l-2 2.2M18.6 8.4l2 2.2"/>'),
  // Des ondes barrées.
  offline: stroke('<path d="M3.6 9.3A13 13 0 0 1 9.4 6.2"/><path d="M20.4 9.3a13 13 0 0 0-4.3-2.8"/><path d="M7 12.9a8 8 0 0 1 2.2-1.4"/><path d="M17 12.9a8 8 0 0 0-1.9-1.3"/><circle cx="12" cy="17.6" r="1.15" fill="currentColor" stroke="none"/><path d="M3.4 3.4 20.6 20.6"/>'),
  shield: stroke('<path d="M12 3.4 19 6v6.1c0 4.2-2.9 7.3-7 8.5-4.1-1.2-7-4.3-7-8.5V6l7-2.6Z"/><path d="m9.1 12 2.1 2.1 3.7-3.9"/>'),

  // L'étape franchie, dans la frise d'avancement.
  check: stroke('<path d="m5.5 12.4 4.2 4.2 8.8-9.2"/>'),
  // Une flèche qui sort du cadre : ce lien quitte le site.
  external: stroke('<path d="M13.5 4.5h6v6"/><path d="M19.5 4.5 11 13"/><path d="M17.5 14.2v3.4a2 2 0 0 1-2 2H6.4a2 2 0 0 1-2-2V8.5a2 2 0 0 1 2-2h3.4"/>'),

  // --- Les tutoriels : le sommaire, les encadrés et les mini-écrans. ---

  // Un fanion planté : le point de départ.
  flag: stroke('<path d="M5.5 21V4"/><path d="M5.5 4.5h11.2l-2.2 3.8 2.2 3.8H5.5"/>'),
  people: stroke('<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0"/><path d="M15.5 5.6a3.2 3.2 0 0 1 0 6"/><path d="M17.6 14.4a5.5 5.5 0 0 1 2.9 5.1"/>'),
  qr: stroke('<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2.5v2.5H14zM17.5 17.5H20V20h-2.5zM14 20h1M20 14v1"/>'),
  // Un ticket de caisse, dentelé en bas.
  receipt: stroke('<path d="M6 3.5h12v17l-2.4-1.5-2.4 1.5-2.4-1.5-2.4 1.5L6 20.5Z"/><path d="M9 8h6M9 11.5h6M9 15h3.5"/>'),
  bulb: stroke('<path d="M9.5 18h5M10.5 21h3"/><path d="M12 3.5a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.1v.6h5v-.6c0-.8.4-1.6 1.1-2.1A6 6 0 0 0 12 3.5Z"/>'),
  // La hiérarchie de l'app, niveau par niveau : la pièce, le meuble, l'objet.
  door: stroke('<path d="M6 20V4.8a.8.8 0 0 1 .8-.8h10.4a.8.8 0 0 1 .8.8V20"/><path d="M4 20h16"/><circle cx="14.6" cy="12.4" r="0.9" fill="currentColor" stroke="none"/>'),
  drawers: stroke('<rect x="4" y="4" width="16" height="14.5" rx="1.8"/><path d="M4 8.9h16M4 13.7h16"/><path d="M10.5 6.4h3M10.5 11.3h3M10.5 16.1h3"/><path d="M6.5 18.5V20M17.5 18.5V20"/>'),
  tag: stroke('<path d="M3.8 12.6 11.4 5a2 2 0 0 1 1.4-.6h5.4a1.4 1.4 0 0 1 1.4 1.4v5.4a2 2 0 0 1-.6 1.4l-7.6 7.6a1.6 1.6 0 0 1-2.3 0l-5.3-5.3a1.6 1.6 0 0 1 0-2.3Z"/><circle cx="15.6" cy="8.4" r="1.3"/>'),
  move: stroke('<path d="M12 3.5v17M3.5 12h17"/><path d="m9.5 6 2.5-2.5L14.5 6M9.5 18l2.5 2.5 2.5-2.5M6 9.5 3.5 12 6 14.5M18 9.5l2.5 2.5-2.5 2.5"/>'),
  export: stroke('<path d="M12 14.5V3.8"/><path d="m8 7.6 4-4 4 4"/><path d="M5.5 12.5v5.7a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-5.7"/>'),
  back: stroke('<path d="m14.5 5.5-6.5 6.5 6.5 6.5"/>'),
  camera: stroke('<path d="M4 8.2a2 2 0 0 1 2-2h2l1.5-2.2h5L16 6.2h2a2 2 0 0 1 2 2v9.6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/><circle cx="12" cy="12.8" r="3.4"/>'),
  alert: stroke('<path d="M10.3 4.4 3.2 17a2 2 0 0 0 1.7 3h14.2a2 2 0 0 0 1.7-3L13.7 4.4a2 2 0 0 0-3.4 0Z"/><path d="M12 9.5v4.2"/><circle cx="12" cy="16.9" r="0.9" fill="currentColor" stroke="none"/>'),
};

// LE REPÈRE DE CÉOÙ : la goutte percée d'un rond clair. Repris tel quel de
// docs/index.html pour que la page d'atterrissage des e-mails et le site
// portent le même signe — deux logos proches mais différents feraient douter
// qu'on soit au bon endroit.
export const MARK = `<svg class="mark" viewBox="0 0 64 64" fill="none" aria-hidden="true">
  <path d="M32 6c-9.4 0-17 7.6-17 17 0 12.8 17 35 17 35s17-22.2 17-35c0-9.4-7.6-17-17-17z" fill="currentColor"/>
  <circle cx="32" cy="22" r="7.5" fill="var(--sand)"/>
</svg>`;

// LA MÊME GOUTTE, EN FAVICON, écrite dans l'adresse plutôt que déposée en
// fichier : un octet de plus dans la page, une requête de moins, et rien à
// re-téléverser le jour où le site déménage. Le fond est peint en dur — un
// favicon ne connaît pas les variables de la page qui l'appelle.
export const FAVICON =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
      '<rect width="64" height="64" rx="14" fill="#FFFBF8"/>' +
      '<path d="M32 8c-8.8 0-16 7.2-16 16 0 12 16 32 16 32s16-20 16-32c0-8.8-7.2-16-16-16z" fill="#1591EA"/>' +
      '<circle cx="32" cy="23" r="7" fill="#FFFBF8"/>' +
      '</svg>',
  );

/**
 * Le plan miniature de la section « en détail ».
 *
 * Dessiné et non photographié : c'est l'écran le plus reconnaissable de
 * l'app, et une capture aurait vieilli au premier changement d'interface.
 * Les pastels sont ceux de la palette des pièces, traduits pour le thème
 * sombre par la fonction de l'app (voir appColors.mjs) ; les deux epaisseurs de
 * trait sont celles du vrai plan — épais pour le mur qui ferme le logement,
 * fin pour une cloison entre deux pièces, et les trous sont des portes.
 */
export function planIllustration(label, lang = 'fr', decorative = false) {
  const names = lang === 'fr' ? ['Salon', 'Cuisine', 'Entrée', 'Garage'] : ['Living room', 'Kitchen', 'Hall', 'Garage'];
  return `<svg class="plan-svg" viewBox="0 0 320 210" ${decorative ? 'aria-hidden="true"' : `role="img" aria-label="${label}"`}>
  <rect x="8" y="8" width="304" height="194" rx="14" fill="var(--surface)" stroke="var(--line)"/>
  <g class="plan-rooms">
    <rect x="28" y="28" width="128" height="92" rx="4" fill="var(--room-1)"/>
    <rect x="156" y="28" width="128" height="52" rx="4" fill="var(--room-2)"/>
    <rect x="156" y="80" width="128" height="40" rx="4" fill="var(--room-3)"/>
    <rect x="28" y="120" width="256" height="62" rx="4" fill="var(--room-4)"/>
  </g>
  <g stroke="var(--ink)" fill="none" stroke-linecap="round">
    <path d="M28 28h256v154H28z" stroke-width="3.5"/>
    <g stroke-width="2">
      <path d="M156 28v30M156 74v46"/>
      <path d="M156 80h48M232 80h52"/>
      <path d="M28 120h72M132 120h152"/>
    </g>
  </g>
  <g fill="var(--ink)" font-family="system-ui, sans-serif" font-size="12" font-weight="600" text-anchor="middle">
    <text x="92" y="78">${names[0]}</text>
    <text x="220" y="59">${names[1]}</text>
    <text x="220" y="105">${names[2]}</text>
    <text x="88" y="154">${names[3]}</text>
  </g>
  <rect x="176" y="132" width="77" height="35" rx="6" fill="var(--surface)" stroke="var(--accent-strong)" stroke-width="1.5"/>
  <g class="plan-pin">
    <circle cx="212" cy="150" r="23" fill="var(--accent)" opacity="0.18"/>
    <circle cx="212" cy="150" r="12" fill="var(--accent-fill)"/>
    <path d="m207 150 3 3 6-6" fill="none" stroke="var(--on-accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;
}
