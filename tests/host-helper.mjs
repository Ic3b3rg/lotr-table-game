import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';

export async function startHost(extraEnv = {}) {
  const ownsDirectory = !extraEnv.LOTR_DATA_DIR;
  const dataDir = extraEnv.LOTR_DATA_DIR ?? (await mkdtemp(join(tmpdir(), 'lotr-host-test-')));
  const child = spawn(process.execPath, ['dist/host.mjs'], {
    env: {
      ...process.env,
      LOTR_BIND: '127.0.0.1',
      LOTR_PORT: '0',
      LOTR_DATA_DIR: dataDir,
      ...extraEnv,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let diagnostics = '';
  child.stderr.on('data', (chunk) => {
    diagnostics += chunk;
  });
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Host non avviato: ${diagnostics}`));
    }, 8000);
    child.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Host terminato (${code}): ${diagnostics}`));
    });
    child.stdout.on('data', (chunk) => {
      const match = String(chunk).match(/HOST_READY (http:\/\/[^\s]+)/);
      if (match) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    });
  });
  return {
    url,
    dataDir,
    async stop(signal = 'SIGTERM') {
      if (child.exitCode !== null || child.signalCode !== null) return;
      const exited = once(child, 'exit');
      child.kill(signal);
      await exited;
    },
    async dispose() {
      await this.stop();
      if (ownsDirectory) await rm(dataDir, { recursive: true, force: true });
    },
    async request(path, body, cookie) {
      return fetch(url + path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
          ...(cookie ? { cookie } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    },
  };
}

export async function joinPlayer(host, name) {
  const session = await (await host.request('/api/session')).json();
  const recoveryCode = randomBytes(12).toString('hex').toUpperCase();
  const input = { name, requestId: randomUUID(), recoveryCode, generation: session.generation };
  const response = await host.request('/api/players', input);
  const body = await response.json();
  return {
    status: response.status,
    body,
    recoveryCode,
    input,
    cookie: response.headers.get('set-cookie')?.split(';')[0],
  };
}
