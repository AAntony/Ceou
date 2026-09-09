// LES COULEURS DE PIÈCE DU PLAN, DANS LES DEUX THÈMES.
//
// Le plan miniature de l'accueil reprend les pastels que l'app pose sur les
// pièces. En thème sombre, les poser tels quels ne marche pas — et l'app le
// sait déjà : src/lib/color.ts documente la mesure, « un pastel dilué de
// moitié sur du presque noir perd sa couleur avant de perdre sa clarté », la
// saturation tombant entre 1 % et 19 %. Seize gris là où le clair donne
// seize couleurs.
//
// D'OÙ L'IMPORT PLUTÔT QU'UNE COPIE. `tintForDark` est calibrée (plafond de
// saturation, plancher pour les quasi-neutres, clarté cible) et réécrite ici
// elle dériverait en silence. Node lit le TypeScript en retirant les types ;
// color.ts s'y prête parce qu'il n'importe rien.

// L'avertissement de Node porte sur l'absence de « type » dans package.json,
// qu'on ne va pas ajouter pour un script d'outillage : ce champ changerait le
// chargement de tout le projet Expo. On le tait, et seulement lui.
const emitWarning = process.emitWarning;
process.emitWarning = (warning, ...rest) => {
  if (String(warning).includes('Reparsing as ES module')) return;
  emitWarning(warning, ...rest);
};
// Import DYNAMIQUE et non statique : un import statique est hissé en tête de
// module, il se ferait avant la ligne ci-dessus et l'avertissement sortirait
// quand même.
const { tintForDark } = await import('../../src/lib/color.ts');
process.emitWarning = emitWarning;

// Quatre teintes tirées de ROOM_COLOR_PALETTE (features/plans/constants.ts),
// choisies éloignées les unes des autres pour que les quatre pièces du
// dessin se distinguent au premier coup d'oeil. Recopiées et non importées :
// ce module-là dépend d'un chemin sans extension, que Node ne résout pas.
export const ROOM_PASTELS = ['#BFD7EA', '#C9E4C5', '#FCE8A8', '#BEE3DB'];

export const ROOM_TINTS_DARK = ROOM_PASTELS.map(tintForDark);

// L'app pose ses pastels à 50 % par-dessus la feuille. Le calcul sombre, lui,
// rend déjà la couleur finale : la diluer une seconde fois la ramènerait au
// gris qu'il vient d'éviter.
export const ROOM_OPACITY_LIGHT = 0.55;
export const ROOM_OPACITY_DARK = 1;
