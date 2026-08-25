export type RelPosition = { relX: number; relY: number };

// Où poser une puce qu'on vient d'ajouter. Toutes arrivaient au centre exact
// de la pièce (0.5 / 0.5) : elles s'empilaient donc les unes sur les autres,
// ET sur le nom de la pièce écrit à cet endroit précis. Deux ajouts de suite
// donnaient une seule puce visible. Les emplacements ci-dessous s'écartent du
// centre et se répartissent, quitte à être ensuite glissés là où ils sont
// vraiment.
//
// Sorti de PlanPinLayer : le calcul est purement géométrique, et il est
// désormais appelé depuis la couche de données (useCreateStarterPlan pose la
// première puce d'un plan sans qu'aucune vue n'existe encore). L'y laisser
// aurait fait remonter React Native et gesture-handler dans queries.ts.
//
// LE HAUT DE LA PIÈCE PORTE SON NOM (voir RoomLabelLayer) : la rangée médiane
// est descendue de 0,28 à 0,45 pour ne pas y déposer une puce d'emblée. Ce
// n'est plus une question de lisibilité — le nom est peint par-dessus tout et
// reste lisible quoi qu'il arrive — mais de propreté : une puce neuve qui
// arrive pile sous le nom fait désordre pour rien.
//
// Les puces déjà posées gardent la position où on les a glissées : ce tableau
// ne décide que de l'endroit où arrive une NOUVELLE puce.
const PIN_SLOTS: RelPosition[] = [
  { relX: 0.5, relY: 0.7 },
  { relX: 0.25, relY: 0.7 },
  { relX: 0.75, relY: 0.7 },
  { relX: 0.25, relY: 0.45 },
  { relX: 0.75, relY: 0.45 },
  { relX: 0.5, relY: 0.45 },
  { relX: 0.25, relY: 0.92 },
  { relX: 0.5, relY: 0.92 },
  { relX: 0.75, relY: 0.92 },
];

export function nextPinSlot(alreadyPlaced: number): RelPosition {
  return PIN_SLOTS[alreadyPlaced % PIN_SLOTS.length];
}
