import type { IconName } from '../../components/Icon';

export const DEFAULT_ICON: IconName = 'autre';

// Couleur affichée pour une Pièce sans couleur explicitement choisie — seule
// définition, réutilisée à la fois par la liste des Pièces d'une Habitation
// (PieceList.tsx) et par le Plan (PlanCanvas.tsx) : la couleur d'une Pièce
// doit être IDENTIQUE partout où elle apparaît, ce repli y compris — sinon
// une pièce sans couleur choisie ressortirait teal dans un écran et d'une
// autre teinte automatique dans l'autre.
export const DEFAULT_PIECE_COLOR = '#DBF7F4';

// Les trois "get*Icon" ci-dessous (habitation/emplacement/pièce) ne sont
// qu'une recherche par clé avec repli sur DEFAULT_ICON — factorisé une fois
// ici plutôt que répété à l'identique pour chacune des trois listes.
function iconLookup<K extends string>(list: { key: K; icon: IconName }[]): (key: K | string | null) => IconName {
  return (key) => list.find((item) => item.key === key)?.icon ?? DEFAULT_ICON;
}

export type HabitationTypeKey = 'maison' | 'appartement' | 'garage' | 'cave' | 'cellier' | 'box' | 'vehicule' | 'autre';

export type HabitationTypeDefinition = {
  key: HabitationTypeKey;
  icon: IconName;
  /** Pas de couche Pièce visible dans l'UI : une Pièce unique est créée et gérée en silence. */
  singleSpace: boolean;
};

export const HABITATION_TYPES: HabitationTypeDefinition[] = [
  { key: 'maison', icon: 'maison', singleSpace: false },
  { key: 'appartement', icon: 'appartement', singleSpace: false },
  { key: 'garage', icon: 'garage', singleSpace: true },
  { key: 'cave', icon: 'cave', singleSpace: true },
  { key: 'cellier', icon: 'cellier', singleSpace: true },
  { key: 'box', icon: 'box', singleSpace: true },
  { key: 'vehicule', icon: 'vehicule', singleSpace: true },
  { key: 'autre', icon: 'autre', singleSpace: true },
];

export function isSingleSpaceHabitation(type: string): boolean {
  return HABITATION_TYPES.find((t) => t.key === type)?.singleSpace ?? true;
}

export const getHabitationIcon = iconLookup(HABITATION_TYPES);

export type EmplacementPresetKey =
  | 'armoire'
  | 'dressing'
  | 'commode'
  | 'etagere'
  | 'placard'
  | 'bureau'
  | 'table_de_chevet'
  | 'tiroir'
  | 'coffre'
  | 'boite_a_gants'
  | 'autre';

export type EmplacementPresetDefinition = {
  key: EmplacementPresetKey;
  icon: IconName;
};

export const EMPLACEMENT_PRESETS: EmplacementPresetDefinition[] = [
  { key: 'armoire', icon: 'armoire' },
  { key: 'dressing', icon: 'dressing' },
  { key: 'commode', icon: 'commode' },
  { key: 'etagere', icon: 'etagere' },
  { key: 'placard', icon: 'placard' },
  { key: 'bureau', icon: 'bureau' },
  { key: 'table_de_chevet', icon: 'table_de_chevet' },
  { key: 'tiroir', icon: 'tiroir' },
  { key: 'coffre', icon: 'coffre' },
  { key: 'boite_a_gants', icon: 'boite_a_gants' },
  { key: 'autre', icon: 'autre' },
];

export const getEmplacementIcon = iconLookup(EMPLACEMENT_PRESETS);

export type PieceTypeKey =
  | 'sejour'
  | 'salle_a_manger'
  | 'cuisine'
  | 'chambre'
  | 'salle_de_bain'
  | 'toilette'
  | 'bureau'
  | 'dressing'
  | 'buanderie'
  | 'entree'
  | 'couloir'
  | 'cave'
  | 'cellier'
  | 'grenier'
  | 'garage'
  | 'atelier'
  | 'debarras'
  | 'balcon'
  | 'jardin'
  | 'autre';

export type PieceTypeDefinition = {
  key: PieceTypeKey;
  icon: IconName;
};

// Suggestions communes à la plupart des habitations — pas de contrainte
// stricte, "Autre" + le champ Nom restent toujours modifiables librement.
export const PIECE_TYPES: PieceTypeDefinition[] = [
  { key: 'sejour', icon: 'sejour' },
  { key: 'salle_a_manger', icon: 'salle_a_manger' },
  { key: 'cuisine', icon: 'cuisine' },
  { key: 'chambre', icon: 'chambre' },
  { key: 'salle_de_bain', icon: 'salle_de_bain' },
  { key: 'toilette', icon: 'toilette' },
  { key: 'bureau', icon: 'bureau' },
  { key: 'dressing', icon: 'dressing' },
  { key: 'buanderie', icon: 'buanderie' },
  { key: 'entree', icon: 'entree' },
  { key: 'couloir', icon: 'couloir' },
  { key: 'cave', icon: 'cave' },
  { key: 'cellier', icon: 'cellier' },
  { key: 'grenier', icon: 'grenier' },
  { key: 'garage', icon: 'garage' },
  { key: 'atelier', icon: 'atelier' },
  { key: 'debarras', icon: 'debarras' },
  { key: 'balcon', icon: 'balcon' },
  { key: 'jardin', icon: 'jardin' },
  { key: 'autre', icon: 'autre' },
];

export const getPieceIcon = iconLookup(PIECE_TYPES);

export type ConteneurPresetKey = 'boite' | 'bac' | 'panier' | 'malle' | 'valise' | 'sac' | 'autre';

export type ConteneurPresetDefinition = {
  key: ConteneurPresetKey;
  icon: IconName;
};

// Volontairement court. Un Conteneur est un contenant physique banal ; sept
// entrées couvrent ce qu'on croise vraiment dans un logement, et une liste
// plus longue rendrait le choix plus lent que la saisie du nom.
export const CONTENEUR_PRESETS: ConteneurPresetDefinition[] = [
  { key: 'boite', icon: 'boite' },
  { key: 'bac', icon: 'bac' },
  { key: 'panier', icon: 'panier' },
  { key: 'malle', icon: 'malle' },
  { key: 'valise', icon: 'valise' },
  { key: 'sac', icon: 'sac' },
  { key: 'autre', icon: 'autre' },
];

export const getConteneurIcon = iconLookup(CONTENEUR_PRESETS);
