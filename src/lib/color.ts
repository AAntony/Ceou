// Assombrit une couleur hex #RRGGBB d'un facteur 0..1 (0 = inchangée, 1 =
// noir).
//
// Vit dans lib/ et non dans features/plans/ depuis l'arrivée du thème sombre :
// le calcul sert maintenant aussi à adapter les pastels d'entités, et lib/
// ne doit pas dépendre d'une feature. `features/plans/constants.ts` la
// réexporte, les appels existants n'ont pas bougé.
export function shade(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const darken = (channel: number) => Math.round(channel * (1 - factor));
  const toHex = (channel: number) => channel.toString(16).padStart(2, '0');
  return `#${toHex(darken(r))}${toHex(darken(g))}${toHex(darken(b))}`;
}
