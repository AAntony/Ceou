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
export function planIllustration(label) {
  return `<svg class="plan-svg" viewBox="0 0 320 210" role="img" aria-label="${label}">
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
  <g class="plan-pin">
    <circle cx="196" cy="150" r="15" fill="var(--accent)"/>
    <circle cx="196" cy="150" r="5.5" fill="var(--sand)"/>
  </g>
</svg>`;
}
