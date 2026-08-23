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

// La feuille et la zone qui l'entoure suivent maintenant le thème
// (colors.surface / colors.sandDark dans PlanCanvas) : une feuille blanche
// éclatante au milieu d'une app en sombre se voit de l'autre bout de la
// pièce. Le principe ne change pas — le pourtour reste plus soutenu que la
// feuille, pour distinguer d'un coup d'œil « dans la zone utile » de
// « en dehors ».

// === Murs =================================================================
// Le defaut le plus visible de l'ancien rendu : une piece etait un aplat
// pastel avec un contour de 2px de sa propre couleur assombrie. Deux pieces
// accolees produisaient donc DEUX contours cote a cote -- une couture, pas
// une cloison -- et le remplissage d'une piece dessinee plus tard pouvait
// recouvrir le contour de sa voisine.
//
// Desormais : un seul trait a l'encre, epais, identique pour toutes les
// pieces, et dessine EN DERNIER (voir les trois passes de PlanCanvas). Deux
// pieces accolees posent leur trait exactement au meme endroit : les deux se
// superposent et se lisent comme un mur unique.
export const WALL_COLOR = '#2D2A26';

// DEUX epaisseurs, et c'est la convention des plans d'architecte : le mur qui
// ferme le logement est porteur, on le trace epais ; une cloison entre deux
// pieces est fine. Le contour du logement se detache alors d'un coup d'oeil et
// les refends passent au second plan -- exactement ce qu'un plan doit donner a
// lire en premier.
//
// Le classement n'est PAS saisi par l'utilisateur, il se DEDUIT : un pan de mur
// qui longe le mur d'une voisine est une cloison, tout le reste ferme le
// logement (voir wallSegments dans walls.ts).
export const WALL_WIDTH = 5;
export const WALL_WIDTH_INNER = 2;

// Le tableau d'une porte : les deux petits traits perpendiculaires aux
// extremites de l'ouverture. Sans eux, un trou dans une cloison fine ne se lit
// plus comme une porte mais comme un mur mal ferme -- c'est ce qui rend
// l'ouverture lisible maintenant que les cloisons ne font plus que 2.
//
// C'est le DEBORD de part et d'autre des faces du mur : la longueur totale du
// trait suit donc l'epaisseur du mur perce, sans quoi le meme tableau
// paraitrait demesure sur une cloison et timide sur une facade.
export const DOOR_JAMB_LENGTH = 2.5;
export const DOOR_JAMB_WIDTH = 1.8;

// Largeur d'une ouverture, en unites de la feuille (une piece courante fait
// 120 a 260 de large). Fixe pour toutes les portes : la regler ne dirait
// rien de plus sur l'endroit ou l'on passe.
export const DOOR_WIDTH = 44;

// Le morceau de mur minimum entre deux ouvertures d'un meme mur. En dessous,
// les deux portes se lisent comme une seule baie -- et rien n'empechait
// jusqu'ici de les poser exactement au meme endroit (voir freeDoorPosition).
export const DOOR_MIN_GAP = 10;

// La couleur de la piece passe en TEINTE plutot qu'en aplat : c'est la
// structure (les murs) qui porte le contraste, la couleur ne sert plus qu'a
// distinguer les pieces entre elles.
export const ROOM_FILL_OPACITY = 0.5;

// « Voir sur le plan » n'entoure plus la PIÈCE d'un cadre vert. Deux
// signaux pour une seule réponse — un cadre autour de la pièce ET une puce
// mise en avant — et le vert n'appartenait à aucune palette de l'app. Seule
// la puce de l'Emplacement se met en avant désormais (voir PlanPinLayer).

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

// Dérive la couleur de contour depuis la couleur de sol plutôt que de
// maintenir une deuxième valeur à la main. Réexportée depuis lib/color.ts,
// où elle sert aussi à l'adaptation des pastels au thème sombre.
export { shade } from '../../lib/color';
