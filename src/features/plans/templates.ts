import { WORLD_HEIGHT, WORLD_WIDTH } from './constants';

// Départs de plan : quatre logements types déjà construits.
//
// Le moment le plus difficile d'un éditeur de plan est la page blanche.
// Demander de dessiner son logement rectangle par rectangle, au doigt, écarte
// d'emblée une partie des utilisateurs — or l'objectif est que ce soit
// faisable à tout âge. On ne dessine donc plus, on ajuste.
//
// La géométrie vit ICI et non en SQL : un gabarit se retouche à l'œil, en
// relisant le rendu, pas dans une migration.

export type TemplateRoom = {
  /** Nom donné à la Pièce créée (ou réutilisée si elle existe déjà). */
  name: string;
  /** Clé de PIECE_TYPES — porte l'icône de la pièce dans le reste de l'app. */
  presetKey: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PlanTemplate = {
  id: string;
  /** Clé i18n du nom du gabarit. */
  labelKey: string;
  rooms: TemplateRoom[];
};

// Les gabarits sont décrits dans un bloc de 300 × 260 posé à l'origine, puis
// centrés sur la feuille au moment de l'application. Décrire des coordonnées
// absolues à la main serait illisible et casserait si WORLD_* changeait.
const BLOCK_WIDTH = 300;
const BLOCK_HEIGHT = 260;
const OFFSET_X = Math.round((WORLD_WIDTH - BLOCK_WIDTH) / 2);
const OFFSET_Y = Math.round((WORLD_HEIGHT - BLOCK_HEIGHT) / 2);

export const PLAN_TEMPLATES: PlanTemplate[] = [
  {
    id: 'studio',
    labelKey: 'plans.templates.studio',
    rooms: [
      { name: 'Pièce principale', presetKey: 'sejour', x: 0, y: 0, width: 200, height: 260 },
      { name: 'Salle de bain', presetKey: 'salle_de_bain', x: 200, y: 0, width: 100, height: 260 },
    ],
  },
  {
    id: 'deux_pieces',
    labelKey: 'plans.templates.two_rooms',
    rooms: [
      { name: 'Séjour', presetKey: 'sejour', x: 0, y: 0, width: 180, height: 260 },
      { name: 'Chambre', presetKey: 'chambre', x: 180, y: 0, width: 120, height: 140 },
      { name: 'Cuisine', presetKey: 'cuisine', x: 180, y: 140, width: 120, height: 120 },
    ],
  },
  {
    id: 'trois_pieces',
    labelKey: 'plans.templates.three_rooms',
    rooms: [
      { name: 'Séjour', presetKey: 'sejour', x: 0, y: 0, width: 170, height: 160 },
      { name: 'Entrée', presetKey: 'entree', x: 0, y: 160, width: 170, height: 100 },
      { name: 'Cuisine', presetKey: 'cuisine', x: 170, y: 0, width: 130, height: 90 },
      { name: 'Chambre', presetKey: 'chambre', x: 170, y: 90, width: 130, height: 90 },
      { name: 'Salle de bain', presetKey: 'salle_de_bain', x: 170, y: 180, width: 130, height: 80 },
    ],
  },
  {
    id: 'maison',
    labelKey: 'plans.templates.house',
    rooms: [
      { name: 'Séjour', presetKey: 'sejour', x: 0, y: 0, width: 140, height: 130 },
      { name: 'Cuisine', presetKey: 'cuisine', x: 140, y: 0, width: 110, height: 130 },
      { name: 'Entrée', presetKey: 'entree', x: 250, y: 0, width: 50, height: 130 },
      { name: 'Chambre', presetKey: 'chambre', x: 0, y: 130, width: 160, height: 130 },
      { name: 'Salle de bain', presetKey: 'salle_de_bain', x: 160, y: 130, width: 140, height: 130 },
    ],
  },
];

/** Coordonnées absolues sur la feuille, prêtes pour apply_plan_template. */
export function templateRoomsForWorld(template: PlanTemplate) {
  return template.rooms.map((room) => ({
    name: room.name,
    preset_key: room.presetKey,
    x: room.x + OFFSET_X,
    y: room.y + OFFSET_Y,
    width: room.width,
    height: room.height,
  }));
}

export const TEMPLATE_BLOCK = { width: BLOCK_WIDTH, height: BLOCK_HEIGHT };
