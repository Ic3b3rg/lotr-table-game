import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { PlayerSchema, SessionSchema } from '../shared/protocol';

const PrivatePlayerSchema = PlayerSchema.extend({ recoveryHash: z.string().regex(/^[a-f0-9]{64}$/), requestId: z.string() });
export const StateSchema = SessionSchema.extend({ players: z.array(PrivatePlayerSchema).max(5) });
export type State = z.infer<typeof StateSchema>;

export function dataDirectory() {
  if (process.env.LOTR_DATA_DIR) return resolve(process.env.LOTR_DATA_DIR);
  if (process.platform === 'darwin') return join(homedir(), 'Library', 'Application Support', 'LotrTavolo');
  if (process.platform === 'win32') return join(process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'), 'LotrTavolo');
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
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=1000; CREATE TABLE IF NOT EXISTS session (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL) STRICT; CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;');
    const initial: State = { id: randomUUID(), generation: randomUUID(), revision: 0, updatedAt: new Date().toISOString(), players: [] };
    this.db.prepare('INSERT OR IGNORE INTO session (id, data) VALUES (1, ?)').run(JSON.stringify(initial));
    this.db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run('cookie-secret', randomBytes(32).toString('hex'));
    const secret = this.db.prepare('SELECT value FROM settings WHERE key = ?').get('cookie-secret');
    if (typeof secret?.value !== 'string') throw new Error('Chiave locale non disponibile');
    this.cookieSecret = secret.value;
    this.read(); // Fail on incompatible data; never replace it with a blank table.
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

  close() { this.db.close(); }
}

export function advance(state: State) {
  state.revision++;
  state.updatedAt = new Date().toISOString();
}

export function publicSession(state: State) {
  return { id: state.id, generation: state.generation, revision: state.revision, updatedAt: state.updatedAt, players: state.players.map(({ id, name }) => ({ id, name })) };
}
