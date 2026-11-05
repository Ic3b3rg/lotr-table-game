import { combatView } from '../combat/controller';
import { playableScenarioPrefab } from '../shared/clues';
import { scenarioView } from '../shared/scenario';
import { scenarioReceiptProblem } from '../scenario/validate';
import { explorationProblem, explorationSource } from '../shared/exploration';
import { digest } from '../map-freeze/hash';
import { physicalView } from '../physical-resolution/view';
import { sourceShadowAvailability } from '../scenario/round-source';
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { ReceiptSchema, type Receipt } from '../shared/protocol';
import { ApiError } from './errors';
import { StateSchema, parseState, type State } from './state';
import { loadCatalog } from './catalog';
import { MapGenerationService, generationReceipt } from './map-generation';
import { generationReceiptProblem } from './generation-state';
import { journeyBudgetProblem, loadJourneyPlan } from './journey-map';
import type { JourneyPlan } from '../shared/journey-map';
import { preparationView } from '../shared/preparation';
import { skillTestView } from '../shared/skill-tests';
import { physicalTitleSkills } from '../physical-resolution/title-skills';
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
  private validatedRead: { data: string; commands: string; state: State } | null = null;
  readonly cookieSecret: string;
  readonly journeyPlan: JourneyPlan | null;
  readonly generator: MapGenerationService;
  readonly scenarioPackPath: string;
  readonly physicalPackPath: string;

  constructor(readonly directory = dataDirectory()) {
    this.scenarioPackPath = process.env.LOTR_SCENARIO_PACK ?? join(directory, 'scenario.json');
    this.physicalPackPath =
      process.env.LOTR_PHYSICAL_PACK ?? join(directory, 'physical-content.json');
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
      schemaVersion: 25,
      physical: null,
      scenario: null,
      mapGeneration: null,
      id: randomUUID(),
      generation: randomUUID(),
      revision: 0,
      updatedAt: new Date().toISOString(),
      players: [],
      demo: null,
      content: null,
      preparation: null,
      skillTest: null,
      scout: null,
      round: null,
      journey: null,
      group: null,
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
    this.generator = new MapGenerationService(
      this,
      process.env.LOTR_GENERATOR_PACK ?? join(directory, 'map-generator.json'),
    );
    const saved = this.read(); // Fail on incompatible data; never replace it with a blank table.
    const mapPath = process.env.LOTR_MAP_PACK ?? join(directory, 'journey-map.json');
    this.journeyPlan = saved.mapGeneration
      ? null
      : saved.journey
        ? {
            definition: saved.journey.definition,
            hash: createHash('sha256')
              .update(JSON.stringify(saved.journey.definition))
              .digest('hex'),
          }
        : process.env.LOTR_MAP_PACK || existsSync(mapPath)
          ? loadJourneyPlan(mapPath)
          : null;
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
    const rows = this.db
      .prepare(
        'SELECT player_id,request_id,fingerprint,result FROM commands ORDER BY player_id,request_id',
      )
      .all();
    const commandData = JSON.stringify(rows);
    // Reuse proof only for byte-identical persisted state AND receipts. Every
    // write (including another SQLite connection) invalidates it; callers own
    // a clone, so an uncommitted mutation cannot change the validated value.
    if (this.validatedRead?.data === row.data && this.validatedRead.commands === commandData)
      return structuredClone(this.validatedRead.state);
    const state = StateSchema.parse(JSON.parse(row.data));
    if (state.mapGeneration) {
      const commands = rows.map((row) => {
        if (
          typeof row.player_id !== 'string' ||
          typeof row.request_id !== 'string' ||
          typeof row.result !== 'string' ||
          typeof row.fingerprint !== 'string'
        )
          throw new Error('Ricevuta non disponibile.');
        return {
          playerId: row.player_id,
          requestId: row.request_id,
          fingerprint: row.fingerprint,
          receipt: ReceiptSchema.parse(JSON.parse(row.result)),
        };
      });
      const problem =
        generationReceiptProblem(state, commands) ?? scenarioReceiptProblem(state, commands);
      if (problem) throw new Error(problem);
    }
    if (state.journey?.travel) {
      const receipts = rows.map((command) => {
        if (typeof command.result !== 'string') throw new Error('Conferma non disponibile');
        return ReceiptSchema.parse(JSON.parse(command.result));
      });
      const problem = journeyBudgetProblem(state, receipts);
      if (problem) throw new Error(problem);
    }
    this.validatedRead = { data: row.data, commands: commandData, state: structuredClone(state) };
    return state;
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
    this.generator.close();
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

  /** Clean attempt boundaries and final receipts share the same durable transaction. */
  updateGeneration(generation: string, jobId: string, change: (state: State) => void): boolean {
    return this.update((state) => {
      const current = state.mapGeneration;
      if (
        state.generation !== generation ||
        !current ||
        current.status !== 'pending' ||
        current.job.id !== jobId
      )
        return false;
      change(state);
      advance(state);
      StateSchema.parse(state);
      for (const request of state.mapGeneration!.requests) {
        const result = generationReceipt(state, request.requestId, request.type);
        const updated = this.db
          .prepare('UPDATE commands SET result = ? WHERE player_id = ? AND request_id = ?')
          .run(JSON.stringify(result), request.playerId, request.requestId);
        if (updated.changes !== 1) throw new Error('Ricevuta generazione mancante.');
      }
      return true;
    });
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
      if (state.mapGeneration) {
        StateSchema.parse(state);
        for (const request of state.mapGeneration.requests)
          this.db
            .prepare('UPDATE commands SET result = ? WHERE player_id = ? AND request_id = ?')
            .run(
              JSON.stringify(generationReceipt(state, request.requestId, request.type)),
              request.playerId,
              request.requestId,
            );
      }
      this.db.prepare('UPDATE session SET data = ? WHERE id = 1').run(JSON.stringify(state));
      this.db
        .prepare('UPDATE commands SET result = ? WHERE player_id = ? AND request_id = ?')
        .run(JSON.stringify(result), playerId, requestId);
      if (state.physical?.cycle) this.read();
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
  const projection =
    state.mapGeneration?.status === 'frozen' ? state.mapGeneration.projection : null;
  const physical = physicalView(
    state.physical,
    state.scenario?.pack.manifest.scope === 'original-encounter-v1',
    !!state.scenario?.conclusion?.campaign,
  );
  const nextShadow = sourceShadowAvailability(state);
  if (physical && nextShadow) physical.nextShadow = nextShadow;
  return {
    schemaVersion: state.schemaVersion,
    id: state.id,
    generation: state.generation,
    revision: state.revision,
    updatedAt: state.updatedAt,
    players: state.players.map(({ id, name }) => ({ id, name })),
    demo: state.demo,
    preparation: preparationView(
      state.preparation,
      state.skillTest,
      state.scout,
      state.physical?.snapshot.resolution?.revealed,
    ),
    scout: state.scout,
    round: state.round,
    journey: state.journey,
    group: state.group,
    mapGeneration: state.mapGeneration,
    scenario: scenarioView(state.scenario),
    ...(state.combat ? { combat: combatView(state) } : {}),
    encounterFingerprints: Object.fromEntries(
      (state.scenario?.instances ?? [])
        .filter((i) => playableScenarioPrefab(state.scenario!.pack, i.prefab!))
        .map((i) => [i.id, digest(i)]),
    ),
    explorationFingerprints: Object.fromEntries(
      state.scenario?.pack.manifest.exploration && projection
        ? projection.spaces.flatMap((s) => {
            const sc = state.scenario!,
              tile = sc.tiles.find((t) => t.source === s.tileSource)!;
            return tile.visible &&
              !tile.explored &&
              !explorationProblem(sc, projection, s.tileSource)
              ? [
                  [
                    sc.spaceBindings.find((b) => b.sourceId === s.id)!.id,
                    digest(explorationSource(sc, s.tileSource)),
                  ],
                ]
              : [];
          })
        : [],
    ),
    physical,
    skillTest: skillTestView(state.content, state.skillTest, physicalTitleSkills(state.physical)),
    catalog: state.content ? { id: state.content.id, label: state.content.label } : null,
  };
}
