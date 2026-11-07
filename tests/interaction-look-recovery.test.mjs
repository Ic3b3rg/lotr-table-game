import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { startHost } from './host-helper.mjs';
import {
  readyLook,
  reachLook,
  interact,
  readSession,
  readBackup,
  scenarioInput,
  ok,
} from './interaction-look-helper.mjs';
import { signBackup } from './skill-test-helper.mjs';
import { runtime } from './interaction-look-runtime.mjs';

test('pending private look survives SIGKILL and empty-host packless restore with full domain and receipts', async (t) => {
  const r = await readyLook(t);
  await reachLook(r);
  await ok(interact(r));
  const before = await readBackup(r.host),
    pending = before.payload.state.scenario.pending.id;
  const path = `/api/private/looks/${pending}?generation=${before.payload.state.generation}`;
  const privateBefore = await (await r.host.request(path, undefined, r.player.cookie)).json();
  await r.host.stop('SIGKILL');
  const restarted = await startHost({ LOTR_DATA_DIR: r.host.dataDir });
  t.after(() => restarted.stop());
  assert.deepEqual((await readBackup(restarted)).payload, before.payload);
  assert.deepEqual(
    await (await restarted.request(path, undefined, r.player.cookie)).json(),
    privateBefore,
  );
  const empty = await startHost();
  t.after(() => empty.dispose());
  const initial = await readSession(empty);
  await ok(
    empty.request('/api/restores', {
      backup: before,
      generation: initial.generation,
      expectedRevision: initial.revision,
      confirmed: true,
    }),
  );
  const restored = await readBackup(empty);
  for (const key of Object.keys(before.payload.state).filter(
    (k) => !['generation', 'revision', 'updatedAt'].includes(k),
  ))
    assert.deepEqual(restored.payload.state[key], before.payload.state[key], key);
  assert.deepEqual(restored.payload.commands, before.payload.commands);
  assert.equal((await empty.request(path, undefined, r.player.cookie)).status, 401);
  const recovered = await empty.request('/api/recover', {
    recoveryCode: r.player.recoveryCode,
    generation: restored.payload.state.generation,
  });
  assert.equal(recovered.status, 200);
  const actor = { ...r.player, cookie: recovered.headers.get('set-cookie').split(';')[0] };
  assert.equal((await empty.request(path, undefined, actor.cookie)).status, 409);
  const newPath = path.replace(before.payload.state.generation, restored.payload.state.generation);
  const privateRestored = await (await empty.request(newPath, undefined, actor.cookie)).json();
  assert.deepEqual(privateRestored, {
    ...privateBefore,
    generation: restored.payload.state.generation,
  });
  await ok(scenarioInput(empty, actor, { kind: 'physical-choice', option: 'continue' }));
  await ok(scenarioInput(empty, actor, { kind: 'ack' }));
  const done = (await readBackup(empty)).payload.state;
  assert.equal(done.scenario.play.attempts[0].returned, true);
  assert.equal(done.physical.snapshot.resolution.privateLooks.length, 1);
  assert.equal(done.round.heroes[0].actionsUsed, before.payload.state.round.heroes[0].actionsUsed);
  assert.deepEqual(done.journey.travel, before.payload.state.journey.travel);
});

test('resigned private result, reward, source, order and paired-history edits fail source derivation', async (t) => {
  const r = await readyLook(t);
  await reachLook(r);
  await ok(interact(r));
  const original = await readBackup(r.host);
  const edits = [
    (s) => {
      s.physical.snapshot.resolution.privateLooks[0].copy = s.preparation.heroes[0].deck[1];
    },
    (s) => {
      s.physical.snapshot.resolution.privateLooks[0].reward = 0;
    },
    (s) => {
      s.physical.snapshot.resolution.privateLooks[0].fate = 0;
    },
    (s) => {
      s.physical.snapshot.resolution.interactionWindow.completed.push('invented-free-effect');
    },
    (s) => {
      s.physical.runs.at(-1).source.parameterHash = 'b'.repeat(64);
    },
    (s) => {
      s.physical.cycle.records.at(-1).intent.instanceId = 'invented-other-owner';
      s.physical.runs.at(-1).source.instanceId = 'invented-other-owner';
    },
    (s) => {
      const result = s.physical.snapshot.resolution.privateLooks[0];
      result.copy = s.preparation.heroes[0].deck[1];
      result.skillId = result.copy.slice(0, result.copy.lastIndexOf(':'));
      s.physical.snapshot.resolution.resources.preparation.heroes[0].inspiration++;
      s.preparation.heroes[0].inspiration++;
    },
  ];
  for (const edit of edits) {
    const b = structuredClone(original);
    edit(b.payload.state);
    signBackup(b);
    assert.equal(runtime.BackupSchema.safeParse(b).success, false);
    const s = await readSession(r.host);
    const response = await r.host.request('/api/restores', {
      backup: b,
      generation: s.generation,
      expectedRevision: s.revision,
      confirmed: true,
    });
    assert.equal(response.status, 422);
    assert.deepEqual((await readBackup(r.host)).payload, original.payload);
  }
  // Forge agreeing front contexts, a freshly replayed physical snapshot and
  // current resource state. Preserve the frozen startup input: kernel
  // consistency and a new checksum cannot replace the actual source ledger.
  const paired = structuredClone(original),
    state = paired.payload.state,
    p = state.physical,
    [first, second] = state.preparation.heroes[0].deck;
  const swap = (preparation) => {
    const hero = preparation.heroes[0];
    hero.deck = hero.deck.map((copy) => (copy === first ? second : copy === second ? first : copy));
  };
  for (const run of p.runs) if (run.context) swap(run.context.preparation);
  p.snapshot = runtime.replayPhysical(p);
  state.preparation = structuredClone(p.snapshot.resolution.resources.preparation);
  assert.doesNotThrow(() => runtime.validatePhysical(p));
  assert.notEqual(
    p.snapshot.resolution.privateLooks[0].copy,
    original.payload.state.physical.snapshot.resolution.privateLooks[0].copy,
  );
  signBackup(paired);
  assert.notEqual(paired.checksum, original.checksum);
  assert.equal(runtime.BackupSchema.safeParse(paired).success, false);
  const s = await readSession(r.host);
  assert.equal(
    (
      await r.host.request('/api/restores', {
        backup: paired,
        generation: s.generation,
        expectedRevision: s.revision,
        confirmed: true,
      })
    ).status,
    422,
  );
  assert.deepEqual((await readBackup(r.host)).payload, original.payload);
});
