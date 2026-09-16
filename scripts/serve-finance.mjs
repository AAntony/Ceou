import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const port = Number(process.env.FINANCE_PORT || 8094);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('FINANCE_PORT invalide.');
const files = new Map([
  ['/', ['index.html', 'text/html']], ['/styles.css', ['styles.css', 'text/css']],
  ['/app.mjs', ['app.mjs', 'text/javascript']], ['/model.mjs', ['model.mjs', 'text/javascript']],
  ['/voice-usage.sql', ['voice-usage.sql', 'text/plain']],
]);
const server = createServer(async (req, res) => {
  const headers = {
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  };
  if (![ `127.0.0.1:${port}`, `localhost:${port}` ].includes(req.headers.host) || !['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(403, headers); res.end('Accès refusé'); return;
  }
  const entry = files.get(req.url?.split('?')[0]);
  if (!entry) { res.writeHead(404, headers); res.end('Introuvable'); return; }
  try {
    const data = await readFile(fileURLToPath(new URL(`../tools/finance/${entry[0]}`, import.meta.url)));
    res.writeHead(200, { ...headers, 'Content-Type': `${entry[1]}; charset=utf-8` });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch { res.writeHead(500, headers); res.end('Fichier indisponible'); }
});
server.on('error', error => { console.error(`Impossible de démarrer le tableau de bord : ${error.message}`); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`Tableau de bord financier privé : http://127.0.0.1:${port}`));
