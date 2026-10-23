import { spawn } from 'node:child_process';
import { once } from 'node:events';

export async function startHost(extraEnv = {}) {
  const child = spawn(process.execPath, ['dist/host.mjs'], {
    env: { ...process.env, LOTR_BIND: '127.0.0.1', LOTR_PORT: '0', ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let diagnostics = '';
  child.stderr.on('data', chunk => { diagnostics += chunk; });
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(new Error(`Host non avviato: ${diagnostics}`)); }, 8000);
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Host terminato (${code}): ${diagnostics}`)); });
    child.stdout.on('data', chunk => {
      const match = String(chunk).match(/HOST_READY (http:\/\/[^\s]+)/);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    });
  });
  return {
    url,
    async stop(signal = 'SIGTERM') {
      if (child.exitCode !== null || child.signalCode !== null) return;
      const exited = once(child, 'exit');
      child.kill(signal);
      await exited;
    },
    async request(path, body, cookie) {
      return fetch(url + path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(cookie ? { cookie } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    },
  };
}
