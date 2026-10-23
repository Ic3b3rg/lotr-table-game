import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import QRCode from 'qrcode';
import { CommandSchema, JoinSchema, RecoverSchema } from '../shared/protocol';
import { ApiError } from './errors';
import { headers, input, json } from './http';
import { addresses } from './network';
import { Store, publicSession } from './store';
import { identity, joinPlayer, recoverPlayer, setIdentity } from './identity';
import { performCommand } from './commands';
import { RestoreSchema } from './backup-format';

const config = z
  .object({ port: z.coerce.number().int().min(0).max(65535), bind: z.ipv4() })
  .parse({ port: process.env.LOTR_PORT ?? 4317, bind: process.env.LOTR_BIND ?? '0.0.0.0' });
process.umask(0o077);
const store = new Store();
let port = config.port;
const staticFiles = new Map([
  ['/', 'index.html'],
  ['/join', 'index.html'],
  ['/app.js', 'app.js'],
  ['/style.css', 'style.css'],
]);
const attempts = new Map<string, { count: number; endsAt: number }>();

function limitRecovery(address: string) {
  const now = Date.now();
  for (const [key, bucket] of attempts) if (bucket.endsAt <= now) attempts.delete(key);
  const bucket = attempts.get(address) ?? { count: 0, endsAt: now + 60_000 };
  if (bucket.count >= 30 || (!attempts.has(address) && attempts.size >= 1024))
    throw new ApiError(
      429,
      'TOO_MANY_ATTEMPTS',
      'Troppi tentativi di ingresso o recupero. Attendi un minuto e riprova.',
    );
  bucket.count++;
  attempts.set(address, bucket);
}

// Node HTTP accepts local connections; browser clients use the same origin.
// https://nodejs.org/download/release/v24.11.1/docs/api/http.html#httpcreateserveroptions-requestlistener
const server = createServer(async (req, res) => {
  headers(res);
  try {
    const host = req.headers.host ?? '';
    const session = publicSession(store.read());
    const lanAddresses = addresses(port, session.id, config.bind);
    const servedHosts =
      config.bind === '0.0.0.0'
        ? ['127.0.0.1', 'localhost', ...lanAddresses.map((item) => item.address)]
        : config.bind === '127.0.0.1'
          ? [config.bind, 'localhost']
          : [config.bind];
    const allowedHosts = new Set(servedHosts.map((address) => `${address}:${port}`));
    if (!allowedHosts.has(host))
      throw new ApiError(403, 'HOST_DENIED', 'Apri l’indirizzo mostrato dal PC.');
    if (req.headers.origin && req.headers.origin !== `http://${host}`)
      throw new ApiError(403, 'ORIGIN_DENIED', 'Apri la sessione direttamente dal suo indirizzo.');
    const url = new URL(req.url ?? '/', `http://${host}`);
    if (
      req.method === 'POST' &&
      (url.pathname === '/api/players' || url.pathname === '/api/recover')
    )
      limitRecovery(req.socket.remoteAddress ?? 'unknown');
    if (req.method === 'GET' && url.pathname === '/api/session') return json(res, session);
    const canManageBackups = () =>
      Boolean(
        identity(req, store) ||
          (req.socket.remoteAddress && req.socket.remoteAddress === req.socket.localAddress),
      );
    if (req.method === 'GET' && url.pathname === '/api/me')
      return json(res, { player: identity(req, store), canManageBackups: canManageBackups() });
    if (req.method === 'GET' && url.pathname === '/api/host')
      return json(res, { addresses: lanAddresses, isLoopbackOnly: config.bind.startsWith('127.') });
    if (req.method === 'GET' && url.pathname === '/api/qr') {
      const selected = lanAddresses.find(
        (item) => item.address === url.searchParams.get('address'),
      );
      if (!selected) throw new ApiError(422, 'INVALID_ADDRESS', 'Scegli un indirizzo del PC.');
      const svg = await QRCode.toString(selected.joinUrl, {
        type: 'svg',
        errorCorrectionLevel: 'M',
        margin: 4,
        width: 256,
      });
      res.writeHead(200, { 'content-type': 'image/svg+xml' });
      return res.end(svg);
    }
    if (req.method === 'POST' && url.pathname === '/api/players') {
      const body = await input(req, JoinSchema);
      const player = joinPlayer(store, body);
      setIdentity(res, store, player);
      return json(res, { player, session: publicSession(store.read()) }, 201);
    }
    if (req.method === 'POST' && url.pathname === '/api/recover') {
      const body = await input(req, RecoverSchema);
      const player = recoverPlayer(store, body.recoveryCode, body.generation);
      setIdentity(res, store, player);
      return json(res, { player });
    }
    if (req.method === 'POST' && url.pathname === '/api/commands') {
      const player = identity(req, store);
      if (!player)
        throw new ApiError(401, 'SEAT_REQUIRED', 'Entra o recupera il tuo posto per continuare.');
      const command = await input(req, CommandSchema);
      const receipt = performCommand(store, player.id, command);
      return json(res, { receipt, session: publicSession(store.read()) });
    }
    if (req.method === 'GET' && url.pathname === '/api/backups') {
      if (!canManageBackups())
        throw new ApiError(
          401,
          'SEAT_REQUIRED',
          'Entra o recupera il tuo posto per esportare la sessione.',
        );
      res.setHeader(
        'content-disposition',
        `attachment; filename="viaggi-${new Date().toISOString().slice(0, 10)}.json"`,
      );
      return json(res, store.backup());
    }
    if (req.method === 'POST' && url.pathname === '/api/restores') {
      if (!canManageBackups())
        throw new ApiError(
          401,
          'SEAT_REQUIRED',
          'Entra o recupera il tuo posto per ripristinare una copia.',
        );
      const body = await input(req, RestoreSchema);
      store.restore(body);
      res.setHeader('set-cookie', 'lotr-seat=; Path=/api; Max-Age=0; HttpOnly; SameSite=Strict');
      return json(res, { session: publicSession(store.read()) });
    }
    const asset = staticFiles.get(url.pathname);
    if (req.method === 'GET' && asset) {
      const content = await readFile(new URL(`./public/${asset}`, import.meta.url));
      const type = asset.endsWith('.html')
        ? 'text/html'
        : asset.endsWith('.css')
          ? 'text/css'
          : 'text/javascript';
      res.writeHead(200, { 'content-type': `${type}; charset=utf-8` });
      return res.end(content);
    }
    throw new ApiError(404, 'NOT_FOUND', 'Questa pagina non esiste.');
  } catch (error) {
    if (error instanceof ApiError)
      return json(res, { error: { code: error.code, message: error.message } }, error.status);
    console.error(
      'Richiesta non completata:',
      error instanceof Error ? error.message : 'errore sconosciuto',
    );
    json(
      res,
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Il PC non ha completato la richiesta. Riprova.',
        },
      },
      500,
    );
  }
});
server.requestTimeout = 15_000;
server.headersTimeout = 10_000;
server.on('error', (error) => {
  console.error(`Avvio non riuscito: ${error.message}. Controlla indirizzo e porta LOTR_PORT.`);
  process.exitCode = 1;
});
server.listen(config.port, config.bind, () => {
  const actual = server.address();
  if (!actual || typeof actual === 'string') throw new Error('Indirizzo host non disponibile');
  port = actual.port;
  console.log(`HOST_READY http://${config.bind === '0.0.0.0' ? '127.0.0.1' : config.bind}:${port}`);
  console.log('Apri il tavolo nel browser. Per fermare l’host premi Ctrl+C.');
});
function stop() {
  server.close(() => store.close());
}
process.once('SIGTERM', stop);
process.once('SIGINT', stop);
