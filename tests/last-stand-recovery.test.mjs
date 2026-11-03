import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import {
  readyLastStand,
  historicalPhysical,
  waitingLastStand,
  recoverSeat,
} from './last-stand-helper.mjs';
import { reachPhysical } from './physical-helper.mjs';
import { scenarioInput } from './scenario-helper.mjs';
import { readSession, readBackup, signBackup } from './skill-test-helper.mjs';
import { startHost } from './host-helper.mjs';

test('P2 selections, real fate costs and rewards survive packless crash, retries and signed tampering', async (t) => {
  const ready = await waitingLastStand(t);
  let host = ready.host;
  t.after(() => host.stop());
  const before = await readBackup(host),
    at = await readSession(host);
  await host.stop('SIGKILL');
  for (const path of [
    ready.scenarioPath,
    ready.physicalPath,
    ready.lastStandPath,
    join(host.dataDir, 'physical-fronts.json'),
  ])
    await rm(path);
  host = await startHost({ LOTR_DATA_DIR: host.dataDir });
  assert.deepEqual((await readBackup(host)).payload, before.payload);
  const intent = { kind: 'physical-choice', option: 'inspiration' },
    requestId = randomUUID();
  const results = await Promise.all([
    scenarioInput(host, ready.player, intent, { requestId }, at),
    scenarioInput(host, ready.player, intent, { requestId }, at),
    scenarioInput(host, ready.player, intent, { requestId: randomUUID() }, at),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 200, 409]);
  const bodies = await Promise.all(results.filter((r) => r.status === 200).map((r) => r.json()));
  assert.deepEqual(bodies[0].receipt, bodies[1].receipt);
  assert.equal(
    (
      await scenarioInput(
        host,
        ready.player,
        { kind: 'physical-choice', option: 'resolve' },
        { requestId },
        at,
      )
    ).status,
    409,
  );
  const paid = await readBackup(host);
  assert.equal(paid.payload.state.preparation.heroes[0].inspiration, 0);
  assert.deepEqual(
    paid.payload.state.physical.snapshot.lastStand.selections,
    before.payload.state.physical.snapshot.lastStand.selections,
  );
  await host.stop('SIGKILL');
  host = await startHost({ LOTR_DATA_DIR: host.dataDir });
  assert.deepEqual((await readBackup(host)).payload, paid.payload);
  let r = await scenarioInput(host, ready.player, { kind: 'physical-choice', option: 'resolve' });
  assert.equal(r.status, 200, await r.clone().text());
  const committed = await readBackup(host),
    stable = await readSession(host);
  assert.equal(committed.payload.state.preparation.heroes[0].inspiration, 1);
  assert.equal(committed.payload.state.physical.snapshot.lastStand.selections[0].returned, 5);
  for (const [caseIndex, edit] of [
    (b) => b.payload.state.physical.snapshot.lastStand.selections[0].difficulty++,
    (b) =>
      (b.payload.state.physical.snapshot.lastStand.selections[0].instructionId =
        'invented-fear-instruction-0'),
    (b) => (b.payload.state.physical.snapshot.lastStand.selections[0].stat = 'wit'),
    (b) => (b.payload.state.physical.snapshot.lastStand.selections[0].outcome = 'fail'),
    (b) => b.payload.state.physical.snapshot.lastStand.heroes[0].difficulty++,
    (b) =>
      (b.payload.state.physical.snapshot.lastStand.random[0].index =
        (b.payload.state.physical.snapshot.lastStand.random[0].index + 1) % 5),
    (b) =>
      b.payload.state.physical.snapshot.lastStand.titles.push({
        heroId: 'hero-1',
        cardId: 'invented-title-1',
        copy: 'invented-title-1:1',
        source: 'invented',
        removed: false,
        pending: false,
      }),
    (b) =>
      b.payload.state.physical.snapshot.resolution.resources.preparation.heroes[0].inspiration++,
    (b) =>
      (b.payload.state.physical.runs[0].answers.at(-1).evidence.playerId =
        ready.other.body.player.id),
    (b) => (b.payload.state.physical.snapshot.parents[0].returnCount = 0),
    (b) =>
      (b.payload.state.scenario.instances[0].settled =
        !b.payload.state.scenario.instances[0].settled),
    (b) => {
      const p = b.payload.state.physical,
        removed = p.runs[0].answers.pop();
      p.snapshot.resolution.history.pop();
      b.payload.state.scenario.commands = b.payload.state.scenario.commands.filter(
        (c) => c.requestId !== removed.evidence.requestId,
      );
      b.payload.commands = b.payload.commands.filter(
        (c) => c.requestId !== removed.evidence.requestId,
      );
    },
  ].entries()) {
    const changed = structuredClone(committed);
    edit(changed);
    signBackup(changed);
    r = await host.request('/api/restores', {
      backup: changed,
      generation: stable.generation,
      expectedRevision: stable.revision,
      confirmed: true,
    });
    assert.equal(r.status, 422, `tamper case ${caseIndex}`);
    assert.deepEqual(await readSession(host), stable);
  }
  r = await host.request('/api/restores', {
    backup: paid,
    generation: stable.generation,
    expectedRevision: stable.revision,
    confirmed: true,
  });
  assert.equal(r.status, 200, await r.clone().text());
  const restored = await readBackup(host);
  for (const key of ['physical', 'preparation', 'journey', 'scenario', 'skillTest'])
    assert.deepEqual(restored.payload.state[key], paid.payload.state[key]);
  assert.deepEqual(restored.payload.commands, paid.payload.commands);
  await recoverSeat(host, ready.player);
  r = await scenarioInput(host, ready.player, { kind: 'physical-choice', option: 'resolve' });
  assert.equal(r.status, 200, await r.clone().text());
  assert.equal((await readBackup(host)).payload.state.preparation.heroes[0].inspiration, 1);
});

test('a schema13 gate produced by the released executable migrates without play and continues once through HTTP', async (t) => {
  const ready = await readyLastStand(t);
  await rm(ready.lastStandPath);
  await reachPhysical(ready);
  const legacy = await readBackup(ready.host),
    original = legacy.payload.state.physical;
  const old = await historicalPhysical();
  const p = old.freezePhysical(
    original.raw,
    original.binding,
    original.heroes,
    original.entropy,
    original.rawSha256,
    original.fronts,
  );
  const run = original.runs[0];
  old.openPhysical(p, run.source, run.program, run.context, run.spatial, run.id);
  old.validatePhysical(p);
  assert.deepEqual(p, original);
  legacy.payload.state.physical = p;
  legacy.payload.state.schemaVersion = 13;
  signBackup(legacy);
  const at = await readSession(ready.host);
  let r = await ready.host.request('/api/restores', {
    backup: legacy,
    generation: at.generation,
    expectedRevision: at.revision,
    confirmed: true,
  });
  assert.equal(r.status, 200, await r.clone().text());
  const migrated = await readBackup(ready.host);
  assert.equal(migrated.payload.state.schemaVersion, 15);
  assert.deepEqual(migrated.payload.state.physical, p);
  assert.deepEqual(migrated.payload.commands, legacy.payload.commands);
  await recoverSeat(ready.host, ready.player);
  const missing = await scenarioInput(ready.host, ready.player, {
    kind: 'physical-continue-last-stand',
    rules: 'source-last-stand-v1',
  });
  assert.equal(missing.status, 409);
  assert.deepEqual((await readBackup(ready.host)).payload, migrated.payload);
  // Install the reviewed instruction file; only the next explicit command freezes it.
  const { writeFile } = await import('node:fs/promises');
  const { compileLastStand } = await import('../dist/physical-resolution-library.mjs');
  const { inventedLastStand } = await import('./fixtures/last-stand.mjs');
  await writeFile(
    ready.lastStandPath,
    JSON.stringify(compileLastStand(p.raw, inventedLastStand(p.raw))),
  );
  const pending = await readSession(ready.host),
    requestId = randomUUID();
  r = await scenarioInput(
    ready.host,
    ready.player,
    { kind: 'physical-continue-last-stand', rules: 'source-last-stand-v1' },
    { requestId },
    pending,
  );
  assert.equal(r.status, 200, await r.clone().text());
  const receipt = (await r.json()).receipt;
  const retry = await scenarioInput(
    ready.host,
    ready.player,
    { kind: 'physical-continue-last-stand', rules: 'source-last-stand-v1' },
    { requestId },
    pending,
  );
  assert.equal(retry.status, 200);
  assert.deepEqual((await retry.json()).receipt, receipt);
  const continued = await readBackup(ready.host);
  assert.equal(continued.payload.state.physical.snapshot.lastStand.selections.length, 1);
  for (const key of ['decks', 'areas', 'random', 'rngCursor'])
    assert.deepEqual(continued.payload.state.physical.snapshot[key], p.snapshot[key]);
  assert.deepEqual(
    continued.payload.state.physical.snapshot.resolution.resources,
    p.snapshot.resolution.resources,
  );
});
