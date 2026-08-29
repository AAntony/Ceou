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

// UN PASTEL CLAIR, TRADUIT POUR LE THÈME SOMBRE.
//
// Le défaut qu'elle corrige : sur le plan, la couleur d'une pièce était posée
// à 50 % d'opacité par-dessus la feuille. Cette feuille suit le thème depuis
// l'arrivée du sombre — elle y vaut #201E1A — et un pastel dilué de moitié
// sur du presque noir perd sa couleur avant de perdre sa clarté. Mesuré sur
// les 16 teintes de la palette : la saturation du résultat tombait entre 1 %
// et 19 %. Seize gris, là où le thème clair donne seize couleurs.
//
// La cause est arithmétique. Un pastel est clair ET peu contrasté d'un canal
// à l'autre (#F3C6D9 : 243/198/217, soit 45 d'écart). Réduire de moitié
// réduit l'écart de moitié aussi — 23 — et 23 d'écart autour d'une clarté
// moyenne, l'oeil le lit comme du gris.
//
// D'où une VRAIE conversion plutôt qu'un assombrissement : on garde la
// teinte, on RELÈVE la saturation, et on descend la clarté. C'est exactement
// ce que font déjà à la main les jetons `*-light` de global.css côté sombre
// (coral-light #12324D, teal-light #123A35) : même teinte, saturation forte,
// clarté basse. Ici le calcul le fait pour une palette de 16 valeurs qu'on ne
// va pas maintenir en double.
const DARK_TINT_LIGHTNESS = 0.24;
// Plafond de saturation : sans lui un pastel déjà vif (#FCE8A8, 92 %)
// donnerait un aplat criard qui volerait la vedette aux murs — or c'est la
// STRUCTURE qui doit porter le plan, la couleur ne sert qu'à distinguer les
// pièces entre elles.
const DARK_TINT_MAX_SATURATION = 0.55;
// Les deux quasi-neutres de la palette (#D6CFC7, #C8CDD3) descendent à 13 %
// de saturation : sans ce relèvement ils redeviendraient le gris qu'on
// essaie justement d'éviter. Avec, ils donnent un brun chaud et un bleu
// froid — distincts l'un de l'autre, et distincts de la feuille.
const DARK_TINT_SATURATION_GAIN = 1.15;
const DARK_TINT_SATURATION_FLOOR = 0.18;

export function tintForDark(hex: string): string {
  const [hue, saturation] = toHsl(hex);
  return fromHsl(
    hue,
    Math.min(DARK_TINT_MAX_SATURATION, saturation * DARK_TINT_SATURATION_GAIN + DARK_TINT_SATURATION_FLOOR),
    DARK_TINT_LIGHTNESS,
  );
}

// TSL plutôt que RVB : c'est le seul espace où « garder la teinte, changer la
// saturation et la clarté » s'écrit directement. Conversions standard, gardées
// privées — rien d'autre dans l'app n'a besoin de raisonner en TSL.
function toHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  if (max === min) return [0, 0, lightness];

  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue: number;
  if (max === r) hue = (g - b) / delta + (g < b ? 6 : 0);
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  return [hue / 6, saturation, lightness];
}

function fromHsl(hue: number, saturation: number, lightness: number): string {
  const toHex = (channel: number) => Math.round(channel * 255).toString(16).padStart(2, '0');
  if (saturation === 0) {
    const grey = toHex(lightness);
    return `#${grey}${grey}${grey}`;
  }

  const q = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;
  const channel = (offset: number) => {
    let t = hue + offset;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return `#${toHex(channel(1 / 3))}${toHex(channel(0))}${toHex(channel(-1 / 3))}`;
}
