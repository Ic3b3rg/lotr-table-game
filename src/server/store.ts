import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { ReceiptSchema, type Receipt } from '../shared/protocol';
import { ApiError } from './errors';
import { StateSchema, parseState, type State } from './state';
import { loadCatalog } from './catalog';
import { BackupCommandSchema, checksum, type BackupPayload, type Restore } from './backup-format';
export type { State } from './state';

export function dataDirectory() {
  if (process.env.LOTR_DATA_DIR) return resolve(process.env.LOTR_DATA_DIR);
  if (process.platform === 'darwin')
    return join(homedir(), 'Library', 'Application Support', 'LotrTavolo');
  if (process.platform === 'win32')
    return join(process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'), 'LotrTavolo');
  return join(process.env.XDG_DATA_HOME ?? join(homedir(), '.local', 'share'), 'lotr-tavolo');
}

export class Store {
  private readonly db: DatabaseSync;
  readonly cookieSecret: string;

  constructor(readonly directory = dataDirectory()) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    // FULL commits are acknowledged before an action returns success.
    // https://nodejs.org/download/release/v24.11.1/docs/api/sqlite.html#class-databasesync
    this.db = new DatabaseSync(join(directory, 'session.sqlite'));
    this.db.exec(
      'PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=1000; CREATE TABLE IF NOT EXISTS session (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL) STRICT; CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;',
    );
    this.db.exec(
      'CREATE TABLE IF NOT EXISTS commands (player_id TEXT NOT NULL, request_id TEXT NOT NULL, fingerprint TEXT NOT NULL, result TEXT, PRIMARY KEY (player_id, request_id)) STRICT;',
    );
    const initial: State = {
      schemaVersion: 2,
      id: randomUUID(),
      generation: randomUUID(),
      revision: 0,
      updatedAt: new Date().toISOString(),
      players: [],
      demo: null,
      content: null,
    };
    this.db
      .prepare('INSERT OR IGNORE INTO session (id, data) VALUES (1, ?)')
      .run(JSON.stringify(initial));
    this.db
      .prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)')
      .run('cookie-secret', randomBytes(32).toString('hex'));
    const secret = this.db.prepare('SELECT value FROM settings WHERE key = ?').get('cookie-secret');
    if (typeof secret?.value !== 'string') throw new Error('Chiave locale non disponibile');
    this.cookieSecret = secret.value;
    this.upgradeUnversionedSession();
    const saved = this.read(); // Fail on incompatible data; never replace it with a blank table.
    const path = process.env.LOTR_CONTENT_PACK ?? join(directory, 'catalog.json');
    if (!saved.content && (process.env.LOTR_CONTENT_PACK || existsSync(path))) {
      const catalog = loadCatalog(path);
      this.update((state) => {
        state.content = catalog;
        advance(state);
      });
    }
  }

  private upgradeUnversionedSession() {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const row = this.db.prepare('SELECT data FROM session WHERE id = 1').get();
      if (typeof row?.data !== 'string') throw new Error('Salvataggio non disponibile');
      const raw: unknown = JSON.parse(row.data);
      const migrated = parseState(raw);
      this.db.prepare('UPDATE session SET data = ? WHERE id = 1').run(JSON.stringify(migrated));
      this.db.exec('COMMIT');
    } catch (error) {
      if (this.db.isTransaction) this.db.exec('ROLLBACK');
      throw error;
    }
  }

  read(): State {
    const row = this.db.prepare('SELECT data FROM session WHERE id = 1').get();
    if (typeof row?.data !== 'string') throw new Error('Salvataggio non disponibile');
    return StateSchema.parse(JSON.parse(row.data));
  }

  update<T>(change: (state: State) => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const state = this.read();
      const result = change(state);
      this.db.prepare('UPDATE session SET data = ? WHERE id = 1').run(JSON.stringify(state));
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      if (this.db.isTransaction) this.db.exec('ROLLBACK');
      throw error;
    }
  }

  close() {
    this.db.close();
  }

  backup() {
    this.db.exec('BEGIN');
    try {
      const state = this.read();
      const commands = this.db
        .prepare(
          'SELECT player_id, request_id, fingerprint, result FROM commands ORDER BY player_id, request_id',
        )
        .all()
        .map((row) => {
          if (typeof row.result !== 'string') throw new Error('Conferma non disponibile');
          return BackupCommandSchema.parse({
            playerId: row.player_id,
            requestId: row.request_id,
            fingerprint: row.fingerprint,
            receipt: JSON.parse(row.result),
          });
        });
      const payload: BackupPayload = { state, commands };
      const result = {
        format: 'lotr-offline-session',
        formatVersion: 1,
        exportedAt: new Date().toISOString(),
        payload,
        checksum: checksum(payload),
      };
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      if (this.db.isTransaction) this.db.exec('ROLLBACK');
      throw error;
    }
  }

  restore(body: Restore) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const current = this.read();
      if (current.generation !== body.generation || current.revision !== body.expectedRevision)
        throw new ApiError(
          409,
          'TABLE_CHANGED',
          'Il tavolo è cambiato. Controlla lo stato prima di confermare di nuovo il ripristino.',
        );
      const state: State = {
        ...body.backup.payload.state,
        generation: randomUUID(),
        revision: body.backup.payload.state.revision + 1,
        updatedAt: new Date().toISOString(),
      };
      this.db.prepare('UPDATE session SET data = ? WHERE id = 1').run(JSON.stringify(state));
      this.db.exec('DELETE FROM commands');
      const insert = this.db.prepare(
        'INSERT INTO commands (player_id, request_id, fingerprint, result) VALUES (?, ?, ?, ?)',
      );
      for (const command of body.backup.payload.commands)
        insert.run(
          command.playerId,
          command.requestId,
          command.fingerprint,
          JSON.stringify(command.receipt),
        );
      this.db.exec('COMMIT');
    } catch (error) {
      if (this.db.isTransaction) this.db.exec('ROLLBACK');
      throw error;
    }
  }

  once(
    playerId: string,
    requestId: string,
    generation: string,
    fingerprint: string,
    apply: (state: State) => Receipt,
  ): Receipt {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const state = this.read();
      if (state.generation !== generation)
        throw new ApiError(
          409,
          'SESSION_CHANGED',
          'La sessione è cambiata. Recupera il tuo posto.',
        );
      if (!state.players.some((player) => player.id === playerId))
        throw new ApiError(401, 'SEAT_REQUIRED', 'Riprendi il tuo posto per continuare.');
      const claimed = this.db
        .prepare(
          'INSERT OR IGNORE INTO commands (player_id, request_id, fingerprint) VALUES (?, ?, ?)',
        )
        .run(playerId, requestId, fingerprint);
      if (claimed.changes === 0) {
        const previous = this.db
          .prepare(
            'SELECT fingerprint, result FROM commands WHERE player_id = ? AND request_id = ?',
          )
          .get(playerId, requestId);
        if (previous?.fingerprint !== fingerprint)
          throw new ApiError(
            409,
            'INTENT_CHANGED',
            'La stessa richiesta contiene una scelta diversa.',
          );
        if (typeof previous.result !== 'string')
          throw new Error('Conferma precedente non disponibile');
        const result = ReceiptSchema.parse(JSON.parse(previous.result));
        this.db.exec('COMMIT');
        return result;
      }
      const count = this.db.prepare('SELECT COUNT(*) AS total FROM commands').get();
      if (Number(count?.total) > 5000)
        throw new ApiError(
          409,
          'DEMO_LIMIT',
          'È stato raggiunto il limite di prove per questa sessione.',
        );
      const result = apply(state);
      this.db.prepare('UPDATE session SET data = ? WHERE id = 1').run(JSON.stringify(state));
      this.db
        .prepare('UPDATE commands SET result = ? WHERE player_id = ? AND request_id = ?')
        .run(JSON.stringify(result), playerId, requestId);
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      if (this.db.isTransaction) this.db.exec('ROLLBACK');
      throw error;
    }
  }
}

export function advance(state: State) {
  state.revision++;
  state.updatedAt = new Date().toISOString();
}

export function publicSession(state: State) {
  return {
    schemaVersion: state.schemaVersion,
    id: state.id,
    generation: state.generation,
    revision: state.revision,
    updatedAt: state.updatedAt,
    players: state.players.map(({ id, name }) => ({ id, name })),
    demo: state.demo,
    catalog: state.content ? { id: state.content.id, label: state.content.label } : null,
  };
}
