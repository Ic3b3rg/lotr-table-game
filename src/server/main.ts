import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import QRCode from 'qrcode';
import { JoinSchema, type Session } from '../shared/protocol';
import { ApiError } from './errors';
import { headers, input, json } from './http';
import { addresses } from './network';

const config = z.object({ port: z.coerce.number().int().min(0).max(65535), bind: z.ipv4() }).parse({ port: process.env.LOTR_PORT ?? 4317, bind: process.env.LOTR_BIND ?? '0.0.0.0' });
const session: Session = { id: randomUUID(), revision: 0, updatedAt: new Date().toISOString(), players: [] };
let port = config.port;
const staticFiles = new Map([['/', 'index.html'], ['/join', 'index.html'], ['/app.js', 'app.js'], ['/style.css', 'style.css']]);

// Node HTTP accepts local connections; browser clients use the same origin.
// https://nodejs.org/download/release/v24.11.1/docs/api/http.html#httpcreateserveroptions-requestlistener
const server = createServer(async (req, res) => {
  headers(res);
  try {
    const host = req.headers.host ?? '';
    const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`, ...addresses(port, session.id).map(item => `${item.address}:${port}`)]);
    if (!allowedHosts.has(host)) throw new ApiError(403, 'HOST_DENIED', 'Apri l’indirizzo mostrato dal PC.');
    if (req.headers.origin && req.headers.origin !== `http://${host}`) throw new ApiError(403, 'ORIGIN_DENIED', 'Apri la sessione direttamente dal suo indirizzo.');
    const url = new URL(req.url ?? '/', `http://${host}`);
    if (req.method === 'GET' && url.pathname === '/api/session') return json(res, session);
    if (req.method === 'GET' && url.pathname === '/api/host') return json(res, { addresses: addresses(port, session.id) });
    if (req.method === 'GET' && url.pathname === '/api/qr') {
      const selected = addresses(port, session.id).find(item => item.address === url.searchParams.get('address'));
      if (!selected) throw new ApiError(422, 'INVALID_ADDRESS', 'Scegli un indirizzo del PC.');
      const svg = await QRCode.toString(selected.joinUrl, { type: 'svg', errorCorrectionLevel: 'M', margin: 4, width: 256 });
      res.writeHead(200, { 'content-type': 'image/svg+xml' });
      return res.end(svg);
    }
    if (req.method === 'POST' && url.pathname === '/api/players') {
      const body = await input(req, JoinSchema);
      if (session.players.length >= 5) throw new ApiError(409, 'TABLE_FULL', 'Il tavolo ha già cinque giocatori.');
      const player = { id: randomUUID(), name: body.name };
      session.players.push(player);
      session.revision++;
      session.updatedAt = new Date().toISOString();
      return json(res, { player, session }, 201);
    }
    const asset = staticFiles.get(url.pathname);
    if (req.method === 'GET' && asset) {
      const content = await readFile(new URL(`./public/${asset}`, import.meta.url));
      const type = asset.endsWith('.html') ? 'text/html' : asset.endsWith('.css') ? 'text/css' : 'text/javascript';
      res.writeHead(200, { 'content-type': `${type}; charset=utf-8` });
      return res.end(content);
    }
    throw new ApiError(404, 'NOT_FOUND', 'Questa pagina non esiste.');
  } catch (error) {
    if (error instanceof ApiError) return json(res, { error: { code: error.code, message: error.message } }, error.status);
    console.error('Richiesta non completata:', error instanceof Error ? error.message : 'errore sconosciuto');
    json(res, { error: { code: 'INTERNAL_ERROR', message: 'Il PC non ha completato la richiesta. Riprova.' } }, 500);
  }
});
server.requestTimeout = 15_000;
server.headersTimeout = 10_000;
server.on('error', error => { console.error(`Avvio non riuscito: ${error.message}. Controlla indirizzo e porta LOTR_PORT.`); process.exitCode = 1; });
server.listen(config.port, config.bind, () => {
  const actual = server.address();
  if (!actual || typeof actual === 'string') throw new Error('Indirizzo host non disponibile');
  port = actual.port;
  console.log(`HOST_READY http://127.0.0.1:${port}`);
  console.log('Apri il tavolo nel browser. Per fermare l’host premi Ctrl+C.');
});
process.once('SIGTERM', () => server.close());
process.once('SIGINT', () => server.close());
