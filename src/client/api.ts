import { ErrorSchema } from '../shared/protocol';

export class RequestError extends Error {
  constructor(readonly code: string, message: string) { super(message); }
}

export async function request(path: string, body?: unknown): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(path, {
      ...(body === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
      signal: controller.signal,
    });
    const result: unknown = await response.json();
    if (!response.ok) {
      const parsed = ErrorSchema.safeParse(result);
      throw new RequestError(parsed.success ? parsed.data.error.code : 'REQUEST_FAILED', parsed.success ? parsed.data.error.message : 'Il PC non ha completato la richiesta.');
    }
    return result;
  } finally { clearTimeout(timer); }
}

// getRandomValues also works on a LAN HTTP origin.
// https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues
export function randomIntent() {
  return Array.from(crypto.getRandomValues(new Uint8Array(12)), value => value.toString(16).padStart(2, '0')).join('').toUpperCase();
}
