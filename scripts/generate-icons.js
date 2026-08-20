/*
 * Génère tous les assets d'icône à partir d'UNE seule source : assets/app_icon.png
 *
 * POURQUOI CE SCRIPT : les icônes ne sont pas un simple redimensionnement.
 * Android masque l'icône adaptative à un cercle/squircle et ne garantit que
 * le CENTRE de l'image — coller l'illustration pleine page en avant-plan
 * couperait le mot « Céoù » qui vit en bas. Il faut donc trois traitements
 * différents selon la cible, et les refaire à la main à chaque itération
 * d'icône serait une source d'erreur silencieuse.
 *
 * COMMENT LE LANCER (sharp n'est volontairement PAS une dépendance du
 * projet — c'est un binaire natif, et `npm ci` sur EAS a déjà été cassé une
 * fois par ce genre d'ajout, cf. commit 0c6f9ea) :
 *
 *   mkdir -p /tmp/imgtools && cd /tmp/imgtools && npm init -y && npm i sharp
 *   cd <racine du projet>
 *   SHARP=/tmp/imgtools/node_modules/sharp node scripts/generate-icons.js
 *
 * La source peut être un JPEG malgré son extension .png (c'est le cas
 * aujourd'hui) : tout est réencodé en PNG de toute façon.
 */

const path = require('path');
const sharp = require(process.env.SHARP || 'sharp');

const SRC = 'assets/app_icon.png';

// Android : l'icône adaptative fait 108dp dont seuls les 72dp centraux sont
// garantis visibles, soit 66,7 %. On inscrit le dessin dans cette zone sûre
// plutôt que de le laisser déborder — sinon le masque du lanceur rogne.
const SAFE_ZONE = 0.667;

const FOREGROUND_SIZE = 512;
const MONOCHROME_SIZE = 432;

/**
 * Détoure le glyphe clair de son fond uni.
 *
 * L'illustration est en aplat (bords échantillonnés à #3998E0, uniformes aux
 * quatre coins) et le dessin est blanc : l'écart de luminance suffit donc à
 * reconstruire une transparence propre, y compris sur les bords anticrénelés,
 * là où un simple « remplace telle couleur par du transparent » laisserait
 * un liseré bleu autour de chaque courbe.
 */
async function extractGlyph(color) {
  const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  // Luminance perçue du fond : sert de plancher. Tout ce qui est plus clair
  // devient d'autant plus opaque.
  const first = data[0];
  const bgLuma = 0.2126 * data[0] + 0.7152 * data[1] + 0.0722 * data[2];
  void first;

  const out = Buffer.alloc(width * height * 4);
  for (let i = 0, o = 0; i < data.length; i += channels, o += 4) {
    const luma = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    const alpha = Math.max(0, Math.min(255, Math.round(((luma - bgLuma) / (255 - bgLuma)) * 255)));
    out[o] = color[0];
    out[o + 1] = color[1];
    out[o + 2] = color[2];
    out[o + 3] = alpha;
  }

  return sharp(out, { raw: { width, height, channels: 4 } }).png();
}

/** Inscrit une image dans la zone sûre, centrée sur un canevas transparent. */
async function insetInSafeZone(pngBuffer, size) {
  const inner = Math.round(size * SAFE_ZONE);
  const scaled = await sharp(pngBuffer).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  const pad = Math.round((size - inner) / 2);
  return sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: scaled, top: pad, left: pad }])
    .png()
    .toBuffer();
}

async function main() {
  const meta = await sharp(SRC).metadata();
  console.log(`source : ${SRC} — ${meta.format} ${meta.width}x${meta.height}`);

  // Couleur de fond réelle, échantillonnée sur un coin plutôt que codée en
  // dur : si l'illustration change de teinte, le fond adaptatif suit.
  const corner = await sharp(SRC).extract({ left: 0, top: 0, width: 24, height: 24 }).stats();
  const rgb = corner.channels.slice(0, 3).map((c) => Math.round(c.mean));
  const hex = '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
  console.log(`fond détecté : ${hex}`);

  // 1. Icône principale (iOS + repli) : pleine page, opaque, telle quelle.
  await sharp(SRC).resize(1024, 1024).flatten({ background: hex }).png().toFile('assets/icon.png');
  console.log('  icon.png                   1024x1024  pleine page');

  // 2. Favicon web.
  await sharp(SRC).resize(48, 48).flatten({ background: hex }).png().toFile('assets/favicon.png');
  console.log('  favicon.png                  48x48    pleine page');

  // 3. Fond de l'icône adaptative : aplat de la couleur détectée.
  await sharp({
    create: { width: FOREGROUND_SIZE, height: FOREGROUND_SIZE, channels: 4, background: { r: rgb[0], g: rgb[1], b: rgb[2], alpha: 1 } },
  })
    .png()
    .toFile('assets/android-icon-background.png');
  console.log(`  android-icon-background.png 512x512    aplat ${hex}`);

  // 4. Avant-plan : le glyphe blanc détouré, inscrit dans la zone sûre. Le
  //    fond bleu ne doit PAS y figurer, sinon il se superposerait à la
  //    couche de fond et un carré apparaîtrait dès qu'un lanceur applique
  //    son effet de parallaxe entre les deux couches.
  const whiteGlyph = await (await extractGlyph([255, 255, 255])).toBuffer();
  await sharp(await insetInSafeZone(whiteGlyph, FOREGROUND_SIZE)).toFile('assets/android-icon-foreground.png');
  console.log('  android-icon-foreground.png 512x512    glyphe détouré, zone sûre');

  // 5. Icône monochrome (thème Android 13+) : le système la recolore
  //    lui-même, elle doit donc être une silhouette et non un dessin coloré.
  const blackGlyph = await (await extractGlyph([0, 0, 0])).toBuffer();
  await sharp(await insetInSafeZone(blackGlyph, MONOCHROME_SIZE)).toFile('assets/android-icon-monochrome.png');
  console.log('  android-icon-monochrome.png 432x432    silhouette, zone sûre');

  console.log('\nTermine. Les icones natives demandent un NOUVEAU BUILD EAS : une');
  console.log('mise a jour OTA ne peut pas les remplacer.');
}

main().catch((error) => {
  console.error(`Echec : ${error.message}`);
  console.error(`Astuce : lancer avec SHARP=<chemin>/node_modules/sharp node ${path.basename(__filename)}`);
  process.exit(1);
});
