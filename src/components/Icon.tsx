import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

// Emoji-as-icon rendering isn't reliable across Android OEMs/versions (showed
// as tofu boxes on a real Samsung device) — a bundled vector icon font always
// renders the same glyph regardless of the system's emoji font.
export type IconName =
  // Habitation types
  | 'maison'
  | 'appartement'
  | 'garage'
  | 'cave'
  | 'cellier'
  | 'box'
  | 'vehicule'
  | 'autre'
  // Emplacement presets
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
  // Plan shapes
  | 'rectangle'
  | 'circle'
  | 'triangle'
  // Generic UI
  | 'pencil'
  | 'chevron'
  | 'empty'
  | 'camera'
  | 'addPhoto'
  | 'move'
  | 'history'
  | 'plan'
  | 'piece'
  | 'conteneur'
  | 'objet'
  | 'delete'
  | 'add'
  | 'home'
  | 'back'
  | 'close'
  | 'search';

const GLYPHS: Record<IconName, keyof typeof MaterialCommunityIcons.glyphMap> = {
  maison: 'home-variant',
  appartement: 'office-building',
  garage: 'garage',
  cave: 'home-floor-b',
  cellier: 'food-variant',
  box: 'package-variant-closed',
  vehicule: 'car',
  autre: 'help-circle-outline',

  armoire: 'wardrobe-outline',
  dressing: 'hanger',
  commode: 'dresser',
  etagere: 'bookshelf',
  placard: 'door-closed',
  bureau: 'desk',
  table_de_chevet: 'lamp',
  tiroir: 'tray',
  coffre: 'treasure-chest',
  boite_a_gants: 'car-door',

  rectangle: 'vector-rectangle',
  circle: 'vector-circle',
  triangle: 'vector-triangle',

  pencil: 'pencil',
  chevron: 'chevron-right',
  empty: 'tray-remove',
  camera: 'camera',
  addPhoto: 'image-plus',
  move: 'swap-horizontal',
  history: 'history',
  plan: 'floor-plan',
  piece: 'door-open',
  conteneur: 'archive',
  objet: 'cube-outline',
  delete: 'trash-can-outline',
  add: 'plus',
  home: 'home-outline',
  back: 'arrow-left',
  close: 'close',
  search: 'magnify',
};

type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
};

export function Icon({ name, size = 22, color = '#2D2A26' }: IconProps) {
  return <MaterialCommunityIcons name={GLYPHS[name]} size={size} color={color} />;
}
