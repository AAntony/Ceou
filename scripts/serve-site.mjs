import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

// LE SITE, SERVI EN LOCAL, POUR LE RELIRE AVANT DE LE DÉPOSER.
//
// Ouvrir site/index.html directement dans un navigateur ne suffit pas : en
// « file: », les adresses canoniques, le défilement de la fenêtre et les
// observateurs de visibilité ne se comportent pas comme sur un vrai serveur,
// et on validerait une page dans des conditions qui n'existent nulle part.
//
// Aucune dépendance, comme le site lui-même :
//
//   node scripts/serve-site.mjs        puis http://localhost:4321
//
// Ce fichier ne part PAS en ligne — il vit dans scripts/, pas dans site/.

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'site');
const port = Number(process.env.PORT) || 4321;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  // `normalize` puis la vérification du préfixe : sans elles, un chemin
  // contenant « .. » sortirait du dossier et servirait n'importe quoi du
  // disque. C'est un serveur de développement, pas une raison de le laisser.
  const file = normalize(join(root, path === '/' ? 'index.html' : path));
  if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('404 — ' + path);
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
}).listen(port, () => console.log(`site/ sur http://localhost:${port}`));
