// "circle" retiré (Phase 7) : simplifie l'éditeur à des pièces rectangulaires
// uniquement (cas réel quasi systématique pour un plan d'architecte). Les
// formes "circle" déjà en base ne sont pas perdues : PlanCanvas les traite
// comme des rectangles (leur width/height définissent déjà une bounding box).
// Un seul type possible désormais : plus de sélecteur, juste un bouton
// "Ajouter une pièce" (voir plan/[id].tsx) qui crée directement ce type.
export type PlanShapeType = 'rectangle';

export const DEFAULT_SHAPE_SIZE = 80;
export const MIN_SHAPE_SIZE = 30;
export const MAX_SHAPE_SIZE = 300;

// Zone où les pièces peuvent réellement être posées — fixe, indépendante de
// la taille d'écran. 1200×1200 laisse la place à un vrai plan multi-pièces
// (une dizaine de pièces à taille courante). Le viewport (mesuré via
// onLayout dans PlanCanvas) borne le zoom/pan pour qu'on ne puisse JAMAIS
// dézoomer au-delà de "toute la feuille visible" ni glisser en dehors
// (pattern "contain, avec pan une fois zoomé" des visionneuses d'image/PDF)
// — la feuille reste donc une zone visiblement limitée, jamais un vide
// panoramique sans borne. ARTBOARD_*/CANVAS_BACKGROUND ci-dessous rendent
// cette limite visible (fond + bord de la feuille sur un fond distinct).
export const WORLD_WIDTH = 1200;
export const WORLD_HEIGHT = 1200;

// Repli avant la toute première mesure de layout — le vrai zoom minimum est
// calculé dynamiquement dans PlanCanvas (taille du viewport vs WORLD_*) pour
// que "dézoomer au maximum" affiche exactement toute la feuille.
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 3;

// Fond de la zone déplaçable (en dehors de la feuille), volontairement plus
// sombre/saturé que la feuille elle-même pour qu'on distingue au premier
// coup d'œil "dans la zone utile" de "en dehors".
export const CANVAS_BACKGROUND = '#E4DED2';
export const ARTBOARD_BACKGROUND = '#FFFDFA';
export const ARTBOARD_BORDER = '#B8AF9C';

// Surlignage "Voir sur le plan" côté pièce : contour vert plus épais,
// suffisamment saturé pour rester lisible sur n'importe quelle couleur de
// sol pastel. La pastille d'Emplacement correspondante utilise son propre
// rouge (contour + petite flèche, voir PlanPinLayer.tsx) plutôt que du vert.
export const HIGHLIGHT_GREEN_BORDER = '#4CAF50';

// Palette pastel — volontairement distincte de celle des résultats de
// recherche (src/features/search/palette.ts, 4 teintes par TYPE D'ENTITÉ) :
// ici on distingue des PIÈCES entre elles sur un même plan. 15 teintes pour
// plus de variété. Les 5 dernières ont été ajoutées APRÈS les 10 premières
// (jamais insérées au milieu) : roomColorForForme() indexe dans ce tableau
// par hash, un réordonnancement changerait silencieusement la couleur de
// pièces déjà coloriées automatiquement.
export const ROOM_COLOR_PALETTE: string[] = [
  '#F3C6D9',
  '#C9E4C5',
  '#FCE8A8',
  '#BEE3DB',
  '#D7C9F2',
  '#F6D8B8',
  '#BFD7EA',
  '#D6CFC7',
  '#C8CDD3',
  '#E8D5C4',
  '#F4BFC0',
  '#B8E8E0',
  '#E3BFE0',
  '#DCE8AE',
  '#C2C9E8',
];

// Couleur PAR PIÈCE INDIVIDUELLE (pas par catégorie) : un hash déterministe
// sur l'id de la FORME (pas de la pièce — une forme sans piece_id doit quand
// même avoir une couleur) garantit que la même pièce garde toujours la même
// couleur d'une session à l'autre, et que deux pièces voisines sont
// visuellement distinctes même si elles partagent la même catégorie (deux
// Chambres côte à côte) ou n'ont pas de catégorie du tout.
export function roomColorForForme(formeId: string): string {
  let hash = 0;
  for (let i = 0; i < formeId.length; i++) hash = (hash * 31 + formeId.charCodeAt(i)) >>> 0;
  return ROOM_COLOR_PALETTE[hash % ROOM_COLOR_PALETTE.length];
}

// Assombrit une couleur hex #RRGGBB d'un facteur 0..1 (0 = inchangée, 1 =
// noir) — dérive la couleur de contour depuis la couleur de sol plutôt que
// de maintenir une deuxième valeur à la main.
export function shade(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const darken = (channel: number) => Math.round(channel * (1 - factor));
  const toHex = (channel: number) => channel.toString(16).padStart(2, '0');
  return `#${toHex(darken(r))}${toHex(darken(g))}${toHex(darken(b))}`;
}
