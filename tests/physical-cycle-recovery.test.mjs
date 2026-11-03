import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { waitingCycle } from './physical-cycle-helper.mjs';
import { readSession, readBackup, signBackup } from './skill-test-helper.mjs';
import { command } from './preparation-helper.mjs';
import { startHost } from './host-helper.mjs';

test('ordinary child survives packless SIGKILL, concurrent retries, restore and re-signed history/spatial attacks', async (t) => {
  const ready = await waitingCycle(t);
  let host = ready.host;
  t.after(() => host.stop());
  const before = await readBackup(host),
    at = await readSession(host);
  assert.equal(at.round.heroes[0].turnEnded, false);
  await host.stop('SIGKILL');
  for (const path of [
    ready.scenarioPath,
    ready.physicalPath,
    join(host.dataDir, 'physical-fronts.json'),
  ])
    await rm(path);
  host = await startHost({ LOTR_DATA_DIR: host.dataDir });
  assert.deepEqual((await readBackup(host)).payload, before.payload);
  const { type: _, ...q } = at.physical.cycle.pending;
  const intent = {
    type: 'CYCLE_INPUT',
    ...q,
    input: { kind: 'physical-allocate', ability: ready.offer, damage: 0, fear: 1 },
    requestId: randomUUID(),
  };
  const results = await Promise.all([
    command(host, ready.other, intent, at),
    command(host, ready.other, intent, at),
    command(host, ready.other, { ...intent, requestId: randomUUID() }, at),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 200, 409]);
  const bodies = await Promise.all(results.filter((r) => r.status === 200).map((r) => r.json()));
  assert.deepEqual(bodies[0].receipt, bodies[1].receipt);
  assert.equal(
    (await command(host, ready.other, { ...intent, input: { ...intent.input, fear: 0 } }, at))
      .status,
    409,
  );
  const committed = await readBackup(host),
    stable = await readSession(host);
  assert.equal(stable.round.heroes[0].turnEnded, true);
  assert.equal(stable.journey.travel, null);
  assert.equal(
    committed.payload.commands.filter((c) => c.requestId === intent.requestId).length,
    1,
  );
  for (const edit of [
    (b) => (b.payload.state.physical.runs.at(-1).source.parameterHash = '0'.repeat(64)),
    (b) => (b.payload.state.physical.runs.at(-1).spatial.heroes[1].spaceId = 'another-space'),
    (b) => (b.payload.state.physical.runs.at(-1).spatial.connections = []),
    (b) => (b.payload.state.physical.heroes[0].spaceId = 'rewritten-initial-space'),
    (b) => (b.payload.state.physical.cycle.records[0].intent.heroId = 'hero-2'),
    (b) => (b.payload.state.round.heroes[0].turnEnded = false),
    (b) =>
      b.payload.state.physical.snapshot.resolution.resources.preparation.heroes[1].inspiration++,
    (b) => {
      const p = b.payload.state.physical;
      const id = p.cycle.records.at(-1).requestId;
      p.cycle.records.pop();
      b.payload.commands = b.payload.commands.filter((c) => c.requestId !== id);
    },
    (b) => {
      const p = b.payload.state.physical;
      const id = p.cycle.records.at(-1).requestId;
      p.cycle.records.pop();
      p.runs.at(-1).answers.pop();
      p.snapshot.resolution.history.pop();
      b.payload.commands = b.payload.commands.filter((c) => c.requestId !== id);
    },
  ]) {
    const changed = structuredClone(committed);
    edit(changed);
    signBackup(changed);
    const r = await host.request('/api/restores', {
      backup: changed,
      generation: stable.generation,
      expectedRevision: stable.revision,
      confirmed: true,
    });
    assert.equal(r.status, 422, await r.text());
    assert.deepEqual(await readSession(host), stable);
  }
  const broken = structuredClone(before);
  broken.payload.state.physical.cycle.pending = null;
  signBackup(broken);
  assert.equal(
    (
      await host.request('/api/restores', {
        backup: broken,
        generation: stable.generation,
        expectedRevision: stable.revision,
        confirmed: true,
      })
    ).status,
    422,
  );
  const r = await host.request('/api/restores', {
    backup: before,
    generation: stable.generation,
    expectedRevision: stable.revision,
    confirmed: true,
  });
  assert.equal(r.status, 200, await r.text());
  const after = await readBackup(host);
  for (const key of ['physical', 'preparation', 'round', 'journey', 'scenario', 'skillTest'])
    assert.deepEqual(after.payload.state[key], before.payload.state[key]);
  assert.deepEqual(after.payload.commands, before.payload.commands);
});
