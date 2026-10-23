// Throwaway visual prototype: no session store, player identities or API mutations.
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve('src/client/prototypes/diorama');
await mkdir('.scratch/diorama', { recursive: true });
await build({
  entryPoints: [root + '/app.ts'],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: ['safari15', 'chrome100'],
  outfile: '.scratch/diorama/app.js',
});
const routes = new Map([
  ['/', [root + '/index.html', 'text/html']],
  ['/prototype/diorama', [root + '/index.html', 'text/html']],
  ['/app.js', [resolve('.scratch/diorama/app.js'), 'text/javascript']],
  ['/style.css', [root + '/style.css', 'text/css']],
  ...['terrain.png', 'ranger.png', 'sentinel.png', 'portrait.png', 'direction-comp.png'].map(
    (name) => ['/assets/' + name, [root + '/assets/' + name, 'image/png']],
  ),
  ['/assets/cormorant-garamond.ttf', [root + '/assets/cormorant-garamond.ttf', 'font/ttf']],
]);
const server = createServer(async (req, res) => {
  const route = routes.get(new URL(req.url ?? '/', 'http://localhost').pathname);
  if (!route || !['GET', 'HEAD'].includes(req.method ?? '')) {
    res.writeHead(404).end('Prototipo non trovato.');
    return;
  }
  try {
    const body = await readFile(route[0]);
    res.writeHead(200, {
      'content-type': route[1],
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {
    res.writeHead(500).end('Risorsa del prototipo mancante.');
  }
});
server.on('error', (error) => {
  console.error('Avvio del prototipo non riuscito:', error.message);
  process.exitCode = 1;
});
server.listen(Number(process.env.LOTR_PROTOTYPE_PORT ?? 4320), '127.0.0.1', () => {
  const address = server.address();
  if (address && typeof address !== 'string')
    console.log(`PROTOTYPE_READY http://127.0.0.1:${address.port}/prototype/diorama`);
});
