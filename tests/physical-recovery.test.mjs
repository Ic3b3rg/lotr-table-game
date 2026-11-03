import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { readyPhysical, reachPhysical } from './physical-helper.mjs';
import { scenarioInput } from './scenario-helper.mjs';
import { startScenario } from './scenario-helper.mjs';
import { readSession, readBackup, signBackup } from './skill-test-helper.mjs';
import { startHost } from './host-helper.mjs';

const restore = async (host, backup) => {
  const s = await readSession(host);
  return host.request('/api/restores', {
    backup,
    generation: s.generation,
    expectedRevision: s.revision,
    confirmed: true,
  });
};
const recover = async (host, seat) => {
  const s = await readSession(host),
    r = await host.request('/api/recover', {
      generation: s.generation,
      recoveryCode: seat.recoveryCode,
    });
  assert.equal(r.status, 200);
  return { ...seat, cookie: r.headers.get('set-cookie').split(';')[0] };
};
test('HTTP: before placement a re-signed backup cannot move the frozen physical participants to another bound space', async (t) => {
  const { host, player } = await readyPhysical(t);
  assert.equal((await startScenario(host, player)).status, 200);
  const before = await readSession(host),
    backup = await readBackup(host);
  assert.equal(backup.payload.state.journey, null);
  const p = backup.payload.state.physical;
  const otherSpace = backup.payload.state.scenario.spaceBindings.find(
    (b) => b.id !== p.heroes[0].spaceId,
  ).id;
  for (const hero of p.heroes) hero.spaceId = otherSpace;
  signBackup(backup);
  assert.equal((await restore(host, backup)).status, 422);
  assert.deepEqual(await readSession(host), before);
});
test('HTTP: competing requests, duplicate intents, stale source and crash have one effect and stable receipt', async (t) => {
  const ready = await readyPhysical(t),
    { player, other } = ready;
  let host = ready.host;
  t.after(() => host.stop());
  const s = await reachPhysical(ready),
    requestId = randomUUID();
  const input = { kind: 'physical-prevent', damage: 1, fear: 1 };
  const results = await Promise.all([
    scenarioInput(host, other, input, { requestId }, s),
    scenarioInput(host, other, input, { requestId }, s),
    scenarioInput(host, other, input, { requestId: randomUUID() }, s),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 200, 409]);
  const bodies = await Promise.all(results.filter((r) => r.status === 200).map((r) => r.json()));
  assert.deepEqual(bodies[0].receipt, bodies[1].receipt);
  const committed = await readBackup(host);
  assert.equal(committed.payload.state.physical.runs[0].answers.length, 1);
  await host.stop('SIGKILL');
  host = await startHost({ LOTR_DATA_DIR: host.dataDir });
  assert.deepEqual((await readBackup(host)).payload, committed.payload);
  const retried = await scenarioInput(host, other, input, { requestId }, s);
  assert.equal(retried.status, 200);
  assert.deepEqual((await retried.json()).receipt, bodies[0].receipt);
  assert.equal(
    (
      await scenarioInput(
        host,
        other,
        { kind: 'physical-prevent', damage: 0, fear: 0 },
        { requestId },
        s,
      )
    ).status,
    409,
  );
  const now = await readSession(host);
  assert.equal(
    (
      await scenarioInput(
        host,
        player,
        { kind: 'physical-discard', damage: 1, fear: 1 },
        { sourceFingerprint: '0'.repeat(64) },
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await scenarioInput(
        host,
        player,
        { kind: 'physical-discard', damage: 1, fear: 1 },
        { pendingId: s.scenario.pending.id },
      )
    ).status,
    409,
  );
  assert.deepEqual(await readSession(host), now);
});

test('HTTP: every physical request survives restart and restore without any pack files', async (t) => {
  const ready = await readyPhysical(t);
  let host = ready.host,
    player = ready.player,
    other = ready.other;
  t.after(() => host.stop());
  await reachPhysical(ready);
  for (const path of [ready.scenarioPath, ready.physicalPath, ready.packPath]) await rm(path);
  let requests = 0;
  while ((await readSession(host)).scenario.pending.kind === 'physical') {
    const before = await readBackup(host);
    await host.stop('SIGKILL');
    host = await startHost({ LOTR_DATA_DIR: host.dataDir });
    assert.deepEqual((await readBackup(host)).payload, before.payload);
    assert.equal((await restore(host, before)).status, 200);
    const after = await readBackup(host);
    for (const key of [
      'physical',
      'scenario',
      'mapGeneration',
      'preparation',
      'scout',
      'skillTest',
      'journey',
      'round',
    ])
      assert.deepEqual(after.payload.state[key], before.payload.state[key], key);
    assert.deepEqual(after.payload.commands, before.payload.commands);
    assert.notEqual(after.payload.state.generation, before.payload.state.generation);
    player = await recover(host, player);
    other = await recover(host, other);
    const s = await readSession(host),
      input =
        s.physical.active.kind === 'prevent'
          ? { kind: 'physical-prevent', damage: 1, fear: 1 }
          : { kind: 'physical-discard', damage: 1, fear: 1 };
    const actor = s.scenario.pending.actorPlayerId === player.body.player.id ? player : other;
    assert.equal((await scenarioInput(host, actor, input, {}, before.payload.state)).status, 409);
    const r = await scenarioInput(host, actor, input);
    assert.equal(r.status, 200, await r.text());
    requests++;
  }
  assert.equal(requests, 2);
  assert.equal((await readSession(host)).physical.parents[0].returnCount, 1);
});

test('HTTP: re-signed backups cannot forge physical copies, decisions, source, costs or paired receipts', async (t) => {
  const ready = await readyPhysical(t),
    { host, other } = ready;
  await reachPhysical(ready);
  assert.equal(
    (await scenarioInput(host, other, { kind: 'physical-prevent', damage: 1, fear: 1 })).status,
    200,
  );
  const before = await readSession(host),
    backup = await readBackup(host);
  for (const edit of [
    (b) => {
      b.payload.state.physical.snapshot.decks.damage.pop();
    },
    (b) => {
      const p = b.payload.state.physical;
      p.snapshot.areas[0].fear.push(p.snapshot.decks.fear[0]);
    },
    (b) => {
      b.payload.state.physical.snapshot.credits[1]++;
    },
    (b) => {
      b.payload.state.physical.snapshot.parents[0].completedChildren++;
    },
    (b) => {
      b.payload.state.physical.snapshot.random[0].indices.reverse();
    },
    (b) => {
      b.payload.state.physical.entropy = 'f'.repeat(64);
    },
    (b) => {
      b.payload.state.physical.runs[0].source.parameterHash = '0'.repeat(64);
    },
    (b) => {
      b.payload.state.physical.runs[0].answers[0].evidence.playerId = b.payload.state.players[0].id;
    },
    (b) => {
      b.payload.state.physical.heroes[0].playerId = b.payload.state.players[1].id;
    },
    (b) => {
      b.payload.state.physical.binding.projectionFingerprint = '0'.repeat(64);
    },
    (b) => {
      b.payload.state.scenario.tasks.find((t) => t.kind === 'physical').parentId = randomUUID();
    },
    (b) => {
      b.payload.state.scenario.pending.physical.child = 0;
    },
    (b) => {
      b.payload.state.scenario.instances[0].settled = true;
    },
    (b) => {
      b.payload.state.scenario.instances[0].stopped = true;
    },
    (b) => {
      b.payload.state.scenario.instances[0].processing = 0;
    },
    (b) => {
      const id = b.payload.state.physical.runs[0].answers[0].evidence.requestId;
      b.payload.commands = b.payload.commands.filter((c) => c.requestId !== id);
      b.payload.state.scenario.commands = b.payload.state.scenario.commands.filter(
        (c) => c.requestId !== id,
      );
    },
    (b) => {
      const id = b.payload.state.physical.runs[0].answers[0].evidence.requestId;
      b.payload.commands.find((c) => c.requestId === id).fingerprint = '0'.repeat(64);
    },
    (b) => {
      b.payload.state.physical.runs[0].answers = [];
    },
    (b) => {
      b.payload.state.physical = null;
    },
  ]) {
    const bad = structuredClone(backup);
    edit(bad);
    signBackup(bad);
    const r = await restore(host, bad);
    assert.equal(r.status, 422, await r.text());
    assert.deepEqual(await readSession(host), before);
  }
});
