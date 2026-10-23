import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { z } from 'zod';
import type { JoinSchema, Player } from '../shared/protocol';
import { ApiError } from './errors';
import { Store, advance, type State } from './store';

const hashCode = (code: string) => createHash('sha256').update(code).digest('hex');
const publicPlayer = ({ id, name }: Player): Player => ({ id, name });

export function sameGeneration(state: State, generation: string) {
  if (state.generation !== generation)
    throw new ApiError(
      409,
      'SESSION_CHANGED',
      'La sessione è cambiata. Ricarica e recupera il tuo posto.',
    );
}

export function joinPlayer(store: Store, body: z.infer<typeof JoinSchema>) {
  return store.update((state) => {
    sameGeneration(state, body.generation);
    const recoveryHash = hashCode(body.recoveryCode);
    const previous = state.players.find((player) => player.requestId === body.requestId);
    if (previous) {
      if (previous.name !== body.name || previous.recoveryHash !== recoveryHash)
        throw new ApiError(
          409,
          'INTENT_CHANGED',
          'Questo ingresso è già stato registrato con dati diversi.',
        );
      return publicPlayer(previous);
    }
    if (state.players.some((player) => player.recoveryHash === recoveryHash))
      throw new ApiError(409, 'CODE_IN_USE', 'Usa un nuovo codice personale per un nuovo posto.');
    if (state.players.length >= 5)
      throw new ApiError(409, 'TABLE_FULL', 'Il tavolo ha già cinque giocatori.');
    const player = { id: randomUUID(), name: body.name, recoveryHash, requestId: body.requestId };
    state.players.push(player);
    advance(state);
    return publicPlayer(player);
  });
}

export function recoverPlayer(store: Store, code: string, generation: string) {
  const state = store.read();
  sameGeneration(state, generation);
  const player = state.players.find((player) => player.recoveryHash === hashCode(code));
  if (!player)
    throw new ApiError(
      401,
      'INVALID_CODE',
      'Codice personale non riconosciuto. Controlla di essere nel tavolo corretto.',
    );
  return publicPlayer(player);
}

function signature(store: Store, playerId: string) {
  return createHmac('sha256', store.cookieSecret)
    .update(`${store.read().generation}:${playerId}`)
    .digest('base64url');
}

export function setIdentity(res: ServerResponse, store: Store, player: Player) {
  // HTTP is confined to the local table; SameSite + Origin checks guard writes.
  // HttpOnly keeps the browser credential out of client JavaScript and storage.
  res.setHeader(
    'set-cookie',
    `lotr-seat=${player.id}.${signature(store, player.id)}; Path=/api; Max-Age=31536000; HttpOnly; SameSite=Strict`,
  );
}

export function identity(req: IncomingMessage, store: Store): Player | null {
  const value = req.headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('lotr-seat='))
    ?.slice('lotr-seat='.length);
  const [id, supplied] = value?.split('.') ?? [];
  if (!id || !supplied) return null;
  const player = store.read().players.find((player) => player.id === id);
  if (!player) return null;
  const expected = signature(store, id);
  const suppliedBytes = Buffer.from(supplied);
  const expectedBytes = Buffer.from(expected);
  if (
    suppliedBytes.length !== expectedBytes.length ||
    !timingSafeEqual(suppliedBytes, expectedBytes)
  )
    return null;
  return publicPlayer(player);
}
