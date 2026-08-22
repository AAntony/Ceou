/*
 * Sert le dernier APK construit localement, sur le réseau Wi-Fi, pour
 * l'installer sur le téléphone sans câble.
 *
 * POURQUOI PLUTOT QU'UN CLOUD : pendant qu'on ajuste quelque chose de visuel,
 * un APK se reconstruit et se réinstalle plusieurs fois d'affilée. Le faire
 * monter puis redescendre par Internet à chaque essai coûte des minutes à
 * chaque tour, pour un fichier qui n'a besoin de traverser que la pièce. Rien
 * ne sort du réseau local.
 *
 * Le serveur n'expose QUE ce fichier : pas de listing, pas de chemin
 * arbitraire, aucun autre fichier du disque n'est accessible. Il reste
 * néanmoins joignable par tout appareil du réseau tant qu'il tourne — c'est
 * un outil de développement, à couper une fois l'installation faite (Ctrl+C).
 *
 * LANCEMENT : node scripts/serve-apk.js [port]   (port par défaut : 8090)
 */

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const qrcode = require('qrcode-generator');

const PORT = Number(process.argv[2]) || 8090;
const APK = path.join(__dirname, '..', 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
const ROUTE = '/ceou.apk';

if (!fs.existsSync(APK)) {
  console.error("\n  Aucun APK trouve. Construis-le d'abord :");
  console.error('  cd android && ./gradlew assembleRelease\n');
  process.exit(1);
}

/**
 * Adresses IPv4 joignables depuis le réseau, la plus probable en tête.
 *
 * Le classement n'est pas cosmétique : une machine a souvent plusieurs
 * cartes — VPN, machines virtuelles, Docker — et prendre simplement la
 * première donne une adresse que le téléphone ne peut pas joindre. Le
 * 192.168.x.x est presque toujours celle du Wi-Fi domestique ; le 10.x.x.x
 * est plus souvent un tunnel VPN, on le garde en dernier recours.
 */
function lanAddresses() {
  const found = [];
  for (const cards of Object.values(os.networkInterfaces())) {
    for (const card of cards || []) {
      if (card.family === 'IPv4' && !card.internal) found.push(card.address);
    }
  }
  const rank = (ip) => (ip.startsWith('192.168.') ? 0 : ip.startsWith('172.') ? 1 : 2);
  return found.sort((a, b) => rank(a) - rank(b));
}

function printQr(text) {
  // typeNumber 0 = le plus petit qui contient la donnée ; correction 'L',
  // suffisante pour un écran (aucune salissure ni pliure, contrairement à un
  // QR imprimé).
  const qr = qrcode(0, 'L');
  qr.addData(text);
  qr.make();
  const size = qr.getModuleCount();
  const dark = '  ';
  const light = '██';
  // Marge de 2 modules : sans zone de silence, beaucoup de lecteurs échouent.
  const blank = light.repeat(size + 4);
  console.log('\n' + blank + '\n' + blank);
  for (let row = 0; row < size; row++) {
    let line = light.repeat(2);
    for (let col = 0; col < size; col++) line += qr.isDark(row, col) ? dark : light;
    console.log(line + light.repeat(2));
  }
  console.log(blank + '\n' + blank);
}

const server = http.createServer((req, res) => {
  if (req.url !== ROUTE) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Rien ici.\n');
    return;
  }
  const { size } = fs.statSync(APK);
  res.writeHead(200, {
    // Le type MIME des paquets Android : sans lui, certains navigateurs
    // ouvrent le fichier au lieu de le télécharger.
    'Content-Type': 'application/vnd.android.package-archive',
    'Content-Length': size,
    'Content-Disposition': 'attachment; filename="ceou.apk"',
  });
  fs.createReadStream(APK).pipe(res);
  console.log(`  -> telechargement demande par ${req.socket.remoteAddress}`);
});

server.listen(PORT, '0.0.0.0', () => {
  const addresses = lanAddresses();
  const { size, mtime } = fs.statSync(APK);
  const url = addresses.length ? `http://${addresses[0]}:${PORT}${ROUTE}` : `http://localhost:${PORT}${ROUTE}`;

  console.log(`\n  APK    ${(size / 1048576).toFixed(0)} Mo, construit ${mtime.toLocaleString('fr-FR')}`);
  console.log(`  Adresse ${url}`);
  // Le serveur ecoute sur toutes les cartes : si la premiere adresse n'est
  // pas la bonne, les autres fonctionnent aussi, il suffit de les essayer.
  if (addresses.length > 1) console.log(`  Autres  ${addresses.slice(1).join(', ')}`);
  if (!addresses.length) console.log('  (aucune adresse reseau trouvee — le telephone ne pourra pas joindre ce PC)');
  printQr(url);
  console.log('  Scanne le QR avec l’appareil photo du telephone, ou tape l’adresse.');
  console.log('  Ctrl+C pour arreter le serveur.\n');
});
