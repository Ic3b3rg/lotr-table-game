import { existsSync, statSync } from 'node:fs';
import { randomInt, randomUUID } from 'node:crypto';
import { Worker } from 'node:worker_threads';
import { z } from 'zod';
import type { MapGenerationCommand, Receipt } from '../shared/protocol';
import {
  GenerationOfferSchema,
  IncomingPoolsSchema,
  AttemptRecordSchema,
  HistorySchema,
  type GenerationOffer,
  type GenerationJob,
} from '../shared/generated-map';
import {
  loadGeneratorPack,
  deriveContext,
  GENERATION_POLICY,
  type GeneratorPack,
} from '../map-freeze/pack';
import { validateProjection } from '../map-freeze/validate';
import { digest } from '../map-freeze/hash';
import type { State } from './state';
import type { Store } from './store';
import { ApiError } from './errors';

const failed = z.strictObject({
  status: z.literal('failed'),
  record: AttemptRecordSchema,
  incoming: IncomingPoolsSchema,
  history: HistorySchema,
  retry: z.boolean(),
});
export class MapGenerationService {
  private cancelled = new WeakSet<Worker>();
  private cached: { stamp: string; pack: GeneratorPack } | null = null;
  private active: { id: string; generation: string; worker: Worker; timer: NodeJS.Timeout } | null =
    null;
  constructor(
    private store: Store,
    readonly path: string,
  ) {}
  get configured() {
    return Boolean(process.env.LOTR_GENERATOR_PACK) || existsSync(this.path);
  }
  private pack(fresh = false) {
    const st = statSync(this.path),
      stamp = `${st.mtimeMs}:${st.size}`;
    if (!fresh && this.cached?.stamp === stamp) return this.cached.pack;
    const pack = loadGeneratorPack(this.path);
    this.cached = { stamp, pack };
    return pack;
  }
  isLegacy(state: State) {
    return Boolean(state.journey || state.round || state.scout || state.skillTest);
  }
  gatesPlay(state: State) {
    return Boolean(
      state.mapGeneration ||
        (this.configured && !this.isLegacy(state) && state.preparation?.status === 'prepared'),
    );
  }
  offer(state: State): GenerationOffer {
    const g = state.mapGeneration;
    const base = {
      packFingerprint: null,
      contextFingerprint: null,
      jobId: null,
      attempt: null,
      running: false,
      canResume: false,
    };
    if (g?.status === 'frozen')
      return GenerationOfferSchema.parse({
        ...base,
        kind: 'frozen',
        jobId: g.id,
        message: 'La mappa è salvata. L’avvio dell’avventura è ancora da completare.',
      });
    if (g) {
      const running = this.active?.id === g.job.id && this.active.generation === state.generation;
      let matches = false;
      try {
        matches =
          digest(this.pack()) === g.job.packFingerprint &&
          digest(deriveContext(this.pack(), state)) === g.job.contextFingerprint;
      } catch {}
      return GenerationOfferSchema.parse({
        ...base,
        kind: g.status,
        packFingerprint: g.job.packFingerprint,
        contextFingerprint: g.job.contextFingerprint,
        jobId: g.job.id,
        attempt: g.job.attempt + 1,
        running,
        canResume:
          !running &&
          matches &&
          g.job.attempt < GENERATION_POLICY.maxAttempts &&
          g.requests.length < 65,
        message: running
          ? 'Il PC sta creando la mappa. Potete tenere aperti i vostri schermi.'
          : !matches
            ? 'La creazione è salvata. Sul PC serve lo stesso materiale usato per iniziarla.'
            : g.status === 'pending'
              ? 'La creazione è stata interrotta. Un partecipante può riprenderla.'
              : g.reason === 'attempt-batch-limit'
                ? 'La ricerca richiede altro tempo. Potete riprenderla dal punto salvato.'
                : 'Il PC non ha completato la creazione. Potete riprovare; nessuna mappa parziale è stata aperta.',
      });
    }
    if (!this.configured || this.isLegacy(state))
      return { ...base, kind: 'legacy', message: 'Questo tavolo usa il percorso precedente.' };
    try {
      const pack = this.pack(),
        context = deriveContext(pack, state);
      return {
        ...base,
        kind: 'ready',
        packFingerprint: digest(pack),
        contextFingerprint: digest(context),
        message: 'I mazzi sono pronti. Concordate la creazione della mappa per questa compagnia.',
      };
    } catch {
      return {
        ...base,
        kind: 'unavailable',
        message:
          state.preparation?.status === 'prepared'
            ? 'Il materiale per creare questa mappa non è disponibile o non corrisponde alla compagnia. Controllate il pacchetto sul PC.'
            : 'Preparate prima tutti gli eroi e i mazzi.',
      };
    }
  }
  apply(state: State, playerId: string, command: MapGenerationCommand) {
    if (state.revision !== command.expectedRevision)
      throw new ApiError(
        409,
        'TABLE_CHANGED',
        'Il tavolo è cambiato. Controlla lo stato aggiornato prima di confermare.',
      );
    let pack: GeneratorPack, context;
    try {
      pack = this.pack(true);
      context = deriveContext(pack, state);
    } catch {
      throw new ApiError(
        409,
        'GENERATOR_UNAVAILABLE',
        'Il materiale per questa compagnia non è disponibile sul PC.',
      );
    }
    if (digest(pack) !== command.packFingerprint || digest(context) !== command.contextFingerprint)
      throw new ApiError(
        409,
        'GENERATION_CONTEXT_CHANGED',
        'La compagnia o il materiale sono cambiati. Controlla e riprova.',
      );
    const request = { playerId, requestId: command.requestId, type: command.type };
    if (command.type === 'GENERATE_ADVENTURE_MAP') {
      if (state.mapGeneration || this.isLegacy(state))
        throw new ApiError(
          409,
          'MAP_ALREADY_REQUESTED',
          'La mappa è già stata richiesta o il tavolo ha già iniziato un altro percorso.',
        );
      const seed = command.requestedSeed ?? randomInt(-2147483648, 2147483648);
      state.mapGeneration = {
        status: 'pending',
        job: {
          id: randomUUID(),
          packFingerprint: digest(pack),
          contextFingerprint: digest(context),
          context,
          requestedSeed: seed,
          seed,
          attempt: 0,
          incoming: pack.template.selection.incoming,
          attempts: [],
          policy: GENERATION_POLICY,
        },
        requests: [request],
      };
    } else {
      const g = state.mapGeneration;
      if (
        !g ||
        g.status === 'frozen' ||
        g.job.id !== command.jobId ||
        g.job.packFingerprint !== command.packFingerprint ||
        g.job.contextFingerprint !== command.contextFingerprint ||
        g.requests.length >= 65 ||
        this.active?.id === g.job.id
      )
        throw new ApiError(
          409,
          'GENERATION_CHANGED',
          'Questa creazione è già ripresa o è cambiata. Guarda lo stato aggiornato.',
        );
      if (g.status === 'paused' && g.reason === 'attempt-limit')
        throw new ApiError(
          409,
          'GENERATION_LIMIT',
          'La ricerca ha raggiunto il limite previsto sul PC. Nessuna mappa è stata aperta.',
        );
      state.mapGeneration = { status: 'pending', job: g.job, requests: [...g.requests, request] };
    }
    return generationReceipt(state, command.requestId, command.type);
  }
  activate() {
    const state = this.store.read(),
      g = state.mapGeneration;
    if (g?.status !== 'pending') return;
    if (this.active) {
      if (this.active.id === g.job.id && this.active.generation === state.generation) return;
      this.cancel();
    }
    this.run(state.generation, g.job, 0);
  }
  private run(generation: string, job: GenerationJob, batch: number) {
    let pack: GeneratorPack;
    try {
      pack = this.pack(true);
      if (digest(pack) !== job.packFingerprint) throw new Error('Pack changed');
    } catch {
      this.pause(generation, job.id, 'worker-failed');
      return;
    }
    const worker = new Worker(new URL('./map-generation-worker.mjs', import.meta.url), {
      workerData: { pack, job },
      resourceLimits: { maxOldGenerationSizeMb: GENERATION_POLICY.workerHeapMiB },
    });
    const timer = setTimeout(() => {
      void worker.terminate();
      this.pause(generation, job.id, 'administrative-stop');
      this.active = null;
    }, GENERATION_POLICY.workerWallMilliseconds);
    this.active = { id: job.id, generation, worker, timer };
    let delivered = false;
    const clear = () => {
      clearTimeout(timer);
      if (this.active?.worker === worker) this.active = null;
    };
    worker.once('message', (raw: unknown) => {
      delivered = true;
      clear();
      if (this.cancelled.has(worker)) return;
      try {
        if (
          raw &&
          typeof raw === 'object' &&
          'status' in raw &&
          raw.status === 'frozen' &&
          'projection' in raw
        ) {
          const projection = validateProjection(raw.projection);
          if (
            projection.contextFingerprint !== job.contextFingerprint ||
            projection.packFingerprint !== job.packFingerprint ||
            projection.requestedSeed !== job.requestedSeed ||
            projection.successfulSeed !== job.seed ||
            digest(projection.attempts) !== digest(job.attempts)
          )
            throw new Error('Worker context changed');
          this.store.updateGeneration(generation, job.id, (state) => {
            const g = state.mapGeneration!;
            state.mapGeneration = {
              status: 'frozen',
              id: job.id,
              projection,
              requests: g.requests,
            };
          });
          return;
        }
        const result = failed.parse(raw);
        if (
          result.record.index !== job.attempt ||
          result.record.seed !== job.seed ||
          result.record.incomingFingerprint !== digest(job.incoming) ||
          result.record.retainedFingerprint !== digest(result.incoming) ||
          result.record.historyFingerprint !== digest(result.history)
        )
          throw new Error('Worker attempt changed');
        if (!result.retry || job.attempt >= 63) {
          this.pause(
            generation,
            job.id,
            job.attempt >= 63
              ? 'attempt-limit'
              : result.record.status === 'administrative-stop'
                ? 'administrative-stop'
                : 'source-operation-exception',
            result.record,
          );
          return;
        }
        const next: GenerationJob = {
          ...job,
          attempt: job.attempt + 1,
          seed: (job.seed + 1) | 0,
          incoming: result.incoming,
          attempts: [...job.attempts, result.record],
        };
        const paused = batch + 1 >= GENERATION_POLICY.attemptsPerActivation;
        const saved = this.store.updateGeneration(generation, job.id, (state) => {
          const requests = state.mapGeneration!.requests;
          state.mapGeneration = paused
            ? {
                status: 'paused',
                job: next,
                requests,
                reason: 'attempt-batch-limit',
                failure: null,
              }
            : { status: 'pending', job: next, requests };
        });
        if (saved && !paused) this.run(generation, next, batch + 1);
      } catch (error) {
        console.error(
          'Generazione non completata:',
          error instanceof Error ? error.message : 'errore',
        );
        this.pause(generation, job.id, 'worker-failed');
      }
    });
    worker.once('error', () => {
      clear();
      if (this.cancelled.has(worker)) return;
      this.pause(generation, job.id, 'worker-failed');
    });
    worker.once('exit', () => {
      clear();
      if (!delivered && !this.cancelled.has(worker))
        this.pause(generation, job.id, 'worker-failed');
    });
  }
  private pause(
    generation: string,
    id: string,
    reason:
      | 'worker-failed'
      | 'administrative-stop'
      | 'attempt-limit'
      | 'source-operation-exception',
    failure: z.infer<typeof AttemptRecordSchema> | null = null,
  ) {
    this.store.updateGeneration(generation, id, (state) => {
      const g = state.mapGeneration!;
      if (g.status !== 'frozen')
        state.mapGeneration = {
          status: 'paused',
          job: g.job,
          requests: g.requests,
          reason,
          failure,
        };
    });
  }
  cancel() {
    if (this.active) {
      clearTimeout(this.active.timer);
      this.cancelled.add(this.active.worker);
      void this.active.worker.terminate();
      this.active = null;
    }
  }
}
export function generationReceipt(
  state: State,
  requestId: string,
  type: MapGenerationCommand['type'],
): Receipt {
  const g = state.mapGeneration!;
  return {
    requestId,
    type,
    appliedRevision: state.revision,
    jobId: g.status === 'frozen' ? g.id : g.job.id,
    status: g.status,
    projectionFingerprint: g.status === 'frozen' ? g.projection.fingerprint : null,
  };
}
