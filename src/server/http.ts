import type { IncomingMessage, ServerResponse } from 'node:http';
import type { z } from 'zod';
import { ApiError } from './errors';

export function headers(res: ServerResponse) {
  res.setHeader(
    'content-security-policy',
    "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  );
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('referrer-policy', 'no-referrer');
  res.setHeader('x-frame-options', 'DENY');
  res.setHeader('cache-control', 'no-store');
}

export function json(res: ServerResponse, body: unknown, status = 200) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

export async function input<S extends z.ZodType>(
  req: IncomingMessage,
  schema: S,
): Promise<z.output<S>> {
  if (req.headers['content-type']?.split(';')[0] !== 'application/json') {
    throw new ApiError(415, 'CONTENT_TYPE', 'Invia dati in formato JSON.');
  }
  let bytes = 0;
  const limit = 4_194_304;
  if (Number(req.headers['content-length']) > limit) {
    req.resume();
    throw new ApiError(413, 'TOO_LARGE', 'Il file o la richiesta sono troppo grandi.');
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes <= limit) chunks.push(chunk);
  }
  if (bytes > limit)
    throw new ApiError(413, 'TOO_LARGE', 'Il file o la richiesta sono troppo grandi.');
  let body: unknown;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new ApiError(400, 'INVALID_JSON', 'Il file o la richiesta non contengono JSON valido.');
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    throw new ApiError(422, 'INVALID_INPUT', 'Controlla i dati inseriti o la versione del file.');
  return parsed.data;
}
