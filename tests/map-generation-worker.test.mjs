import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { randomUUID } from 'node:crypto';
import { build } from 'esbuild';
import { catalogFixture } from './fixtures/catalog.mjs';
import { generatorFixture } from './fixtures/map-freeze.mjs';
import {
  parseGeneratorPack,
  deriveContext,
  runGenerationAttempt,
  digest,
} from '../dist/map-freeze-library.mjs';

// Exercise the actual service handlers while controlling the external Worker
// and timer boundary. No threads, sockets, clock waits or application data.
const bundle = await build({
  entryPoints: ['src/server/map-generation.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  write: false,
  logLevel: 'silent',
});
const require = createRequire(import.meta.url);
for (const lateEvent of ['exit', 'error', 'message']) {
  test(`un worker scaduto non altera la ripresa con un evento ${lateEvent} tardivo`, () => {
    const workers = [],
      timers = [];
    class FakeWorker extends EventEmitter {
      constructor() {
        super();
        workers.push(this);
      }
      terminate() {
        return Promise.resolve(0);
      }
    }
    const module = { exports: {} };
    runInNewContext(bundle.outputFiles[0].text, {
      module,
      exports: module.exports,
      require: (name) => (name === 'node:worker_threads' ? { Worker: FakeWorker } : require(name)),
      process,
      console,
      Buffer,
      URL: class {},
      setTimeout: (fn) => {
        timers.push(fn);
        return timers.length;
      },
      clearTimeout() {},
    });
    const content = catalogFixture();
    content.heroes.forEach((hero) => (hero.maxHands = 2));
    const playerId = randomUUID();
    const state = {
      content,
      preparation: {
        status: 'prepared',
        heroes: [
          { heroId: 'hero-4', playerId, roleId: 'role-4', itemCopies: ['bow:1', 'armor:1'] },
          { heroId: 'hero-2', playerId, roleId: 'role-2', itemCopies: ['sword:1', 'rare-armor:1'] },
        ],
      },
      generation: randomUUID(),
      revision: 0,
      mapGeneration: null,
      journey: null,
      round: null,
      scout: null,
      skillTest: null,
    };
    const pack = parseGeneratorPack(generatorFixture(content));
    const store = {
      read: () => structuredClone(state),
      updateGeneration(generation, id, change) {
        if (
          generation !== state.generation ||
          state.mapGeneration?.status !== 'pending' ||
          state.mapGeneration.job.id !== id
        )
          return false;
        change(state);
        state.revision++;
        return true;
      },
    };
    const service = new module.exports.MapGenerationService(store, 'unused');
    service.pack = () => pack;
    const context = deriveContext(pack, state);
    const fingerprints = { packFingerprint: digest(pack), contextFingerprint: digest(context) };
    service.apply(state, playerId, {
      type: 'GENERATE_ADVENTURE_MAP',
      requestId: randomUUID(),
      expectedRevision: 0,
      requestedSeed: 1,
      agreed: true,
      ...fingerprints,
    });
    service.activate();
    timers[0]();
    assert.equal(state.mapGeneration.status, 'paused');
    assert.equal(state.mapGeneration.reason, 'administrative-stop');
    const job = structuredClone(state.mapGeneration.job);
    service.apply(state, playerId, {
      type: 'RESUME_ADVENTURE_MAP',
      requestId: randomUUID(),
      expectedRevision: state.revision,
      jobId: job.id,
      agreed: true,
      ...fingerprints,
    });
    service.activate();
    assert.equal(workers.length, 2);
    assert.equal(state.mapGeneration.status, 'pending');
    const result = runGenerationAttempt(pack, context, job);
    workers[0].emit(lateEvent, lateEvent === 'message' ? result : new Error('expired'));
    assert.equal(state.mapGeneration.status, 'pending');
    workers[1].emit('message', result);
    assert.equal(state.mapGeneration.status, 'frozen');
    service.close();
  });
}
