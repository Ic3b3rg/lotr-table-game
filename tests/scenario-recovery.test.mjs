import { hash } from './fixtures/map-freeze.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readyScenario, startScenario, scenarioInput } from './scenario-helper.mjs';
import { readSession, readBackup, signBackup } from './skill-test-helper.mjs';
import { startHost } from './host-helper.mjs';
import { rm } from 'node:fs/promises';
async function recover(host, seat) {
  const s = await readSession(host);
  const r = await host.request('/api/recover', {
    generation: s.generation,
    recoveryCode: seat.recoveryCode,
  });
  assert.equal(r.status, 200);
  return { ...seat, cookie: r.headers.get('set-cookie').split(';')[0] };
}
export async function restore(host, backup) {
  const s = await readSession(host);
  return host.request('/api/restores', {
    backup,
    generation: s.generation,
    expectedRevision: s.revision,
    confirmed: true,
  });
}
async function advanceUntil(host, player, other, reached) {
  for (let n = 0; n < 45; n++) {
    const s = await readSession(host);
    if (reached(s)) return s;
    const q = s.scenario.pending;
    const actor = q.heroId === 'hero-2' ? other : player;
    const input =
      q.kind === 'scout'
        ? q.stage === 'ready'
          ? { kind: 'scout-reveal' }
          : {
              kind: 'scout-resolve',
              prepareCopy: null,
              top: s.scout.revealed,
              bottom: [],
              discardPreparedCopy: null,
            }
        : q.kind === 'test'
          ? q.stage === 'ready'
            ? { kind: 'test-reveal' }
            : { kind: 'test-resolve' }
          : { kind: 'ack' };
    const response = await scenarioInput(host, actor, input);
    assert.equal(response.status, 200, await response.text());
  }
  assert.fail('La fixture non ha raggiunto il checkpoint richiesto.');
}
test('backup: un’istanza con messaggio pendente non può risultare settled', async (t) => {
  const { host, player } = await readyScenario(t);
  assert.equal((await startScenario(host, player)).status, 200);
  const before = await readSession(host);
  const bad = await readBackup(host);
  bad.payload.state.scenario.instances[0].settled = true;
  signBackup(bad);
  assert.equal((await restore(host, bad)).status, 422);
  assert.deepEqual(await readSession(host), before);
});
test('backup: il cursore di esplorazione non può saltare un callback fonte', async (t) => {
  const { host, player, other } = await readyScenario(t);
  assert.equal((await startScenario(host, player)).status, 200);
  const before = await advanceUntil(host, player, other, (s) =>
    s.scenario.pending?.instanceId.startsWith('node:'),
  );
  const bad = await readBackup(host);
  const task = bad.payload.state.scenario.tasks.at(-1);
  const spaces = before.mapGeneration.projection.spaces.filter(
    (space) => space.tileSource === task.tileSource,
  );
  assert.equal(task.kind, 'explore');
  assert.ok(spaces.length > 1);
  task.spaceIndex = spaces.length - 1;
  task.stage = 'next';
  task.waiting = null;
  signBackup(bad);
  assert.equal((await restore(host, bad)).status, 422);
  assert.deepEqual(await readSession(host), before);
});
test('backup: cronologia e ricevute restano legate a richieste ed eroi completati', async (t) => {
  const { host, player, other } = await readyScenario(t);
  assert.equal((await startScenario(host, player)).status, 200);
  const before = await advanceUntil(host, player, other, (s) => s.scenario.phase === 'action');
  const backup = await readBackup(host);
  const edits = [
    (b) => {
      b.payload.state.scenario.commands = b.payload.state.scenario.commands.filter(
        (c) => c.kind === 'start',
      );
      b.payload.commands = b.payload.commands.filter((c) => c.receipt.type !== 'SCENARIO_INPUT');
    },
    (b) => {
      const c = b.payload.state.scenario.commands.find((c) => c.kind === 'scout-resolve');
      const r = b.payload.commands.find((r) => r.requestId === c.requestId);
      c.playerId = b.payload.state.players.find((p) => p.id !== c.playerId).id;
      r.playerId = c.playerId;
    },
    (b) => {
      const c = b.payload.state.scenario.commands.find((c) => c.kind === 'scout-resolve');
      const r = b.payload.commands.find((r) => r.requestId === c.requestId);
      c.source = 'forged-cursor';
      r.receipt.source = c.source;
    },
    (b) => {
      const c = b.payload.state.scenario.commands.find((c) => c.kind === 'scout-resolve');
      const r = b.payload.commands.find((r) => r.requestId === c.requestId);
      c.pendingId = b.payload.state.scenario.completedSetup.at(-1).requestId;
      r.receipt.pendingId = c.pendingId;
    },
  ];
  for (const edit of edits) {
    const bad = structuredClone(backup);
    edit(bad);
    signBackup(bad);
    assert.equal((await restore(host, bad)).status, 422);
    assert.deepEqual(await readSession(host), before);
  }
});
test('backup: source/cursor/binding/effetti/ricevute incoerenti non sostituiscono il tavolo', async (t) => {
  const { host, player } = await readyScenario(t);
  assert.equal((await startScenario(host, player)).status, 200);
  const before = await readSession(host),
    backup = await readBackup(host);
  for (const edit of [
    (b) => (b.payload.state.scenario.pack.name = 'Modificato'),
    (b) => (b.payload.state.scenario.projectionFingerprint = '0'.repeat(64)),
    (b) => (b.payload.state.scenario.globals.boundTile = -2),
    (b) => (b.payload.state.scenario.instances[0].state = 999),
    (b) => (b.payload.state.scenario.instances.find((i) => i.kind === 'encounter').visible = true),
    (b) => (b.payload.state.scenario.instances.find((i) => i.kind === 'encounter').stopped = true),
    (b) => (b.payload.state.scenario.instances.find((i) => i.kind === 'encounter').processing = 1),
    (b) => b.payload.state.scenario.effects.push(b.payload.state.scenario.effects[0]),
    (b) => (b.payload.state.scenario.tiles[0].explored = true),
    (b) =>
      (b.payload.commands = b.payload.commands.filter((c) => c.receipt.type !== 'START_SCENARIO')),
  ]) {
    const bad = structuredClone(backup);
    edit(bad);
    signBackup(bad);
    const r = await restore(host, bad);
    assert.equal(r.status, 422);
    assert.deepEqual(await readSession(host), before);
  }
});
test('restore durante ogni richiesta aperta mantiene carte/cursori/RNG e respinge generation vecchia', async (t) => {
  const ready = await readyScenario(t);
  let { host, player, other } = ready;
  assert.equal((await startScenario(host, player)).status, 200);
  let checkpoints = 0;
  for (let n = 0; n < 45; n++) {
    let s = await readSession(host);
    if (s.scenario.phase === 'action') break;
    const backup = await readBackup(host),
      q = s.scenario.pending;
    assert.equal((await restore(host, backup)).status, 200);
    if (q.heroId === 'hero-2') other = await recover(host, other);
    else player = await recover(host, player);
    const after = await readSession(host);
    for (const k of [
      'scenario',
      'mapGeneration',
      'preparation',
      'scout',
      'skillTest',
      'journey',
      'round',
    ])
      assert.deepEqual(after[k], s[k]);
    assert.deepEqual((await readBackup(host)).payload.commands, backup.payload.commands);
    checkpoints++;
    const stale = await scenarioInput(
      host,
      q.heroId === 'hero-2' ? other : player,
      { kind: 'ack' },
      {},
      s,
    );
    assert.equal(stale.status, 409);
    const actor = q.heroId === 'hero-2' ? other : player;
    const input =
      q.kind === 'scout'
        ? q.stage === 'ready'
          ? { kind: 'scout-reveal' }
          : {
              kind: 'scout-resolve',
              prepareCopy: null,
              top: after.scout.revealed,
              bottom: [],
              discardPreparedCopy: null,
            }
        : q.kind === 'test'
          ? q.stage === 'ready'
            ? { kind: 'test-reveal' }
            : { kind: 'test-resolve' }
          : { kind: 'ack' };
    const r = await scenarioInput(host, actor, input);
    assert.equal(r.status, 200, await r.text());
  }
  const active = await readSession(host);
  assert.equal(active.scenario.phase, 'action');
  assert.ok(checkpoints >= 16);
  await rm(ready.scenarioPath);
  await host.stop('SIGKILL');
  const restarted = await startHost({
    LOTR_DATA_DIR: host.dataDir,
    LOTR_SCENARIO_PACK: ready.scenarioPath,
  });
  t.after(() => restarted.stop());
  assert.deepEqual(await readSession(restarted), active);
});
test('consumer nuovo: posizioni, azioni e turni devono corrispondere alle ricevute', async (t) => {
  const { host, player, other } = await readyScenario(t);
  assert.equal((await startScenario(host, player)).status, 200);
  for (let n = 0; n < 40; n++) {
    const s = await readSession(host),
      q = s.scenario.pending;
    if (!q) break;
    const actor = q.heroId === 'hero-2' ? other : player;
    const input =
      q.kind === 'scout'
        ? q.stage === 'ready'
          ? { kind: 'scout-reveal' }
          : {
              kind: 'scout-resolve',
              prepareCopy: null,
              top: s.scout.revealed,
              bottom: [],
              discardPreparedCopy: null,
            }
        : q.kind === 'test'
          ? q.stage === 'ready'
            ? { kind: 'test-reveal' }
            : { kind: 'test-resolve' }
          : { kind: 'ack' };
    assert.equal((await scenarioInput(host, actor, input)).status, 200);
  }
  const { command } = await import('./preparation-helper.mjs');
  let s = await readSession(host);
  assert.equal(
    (
      await command(host, player, {
        type: 'START_TURN',
        roundId: s.round.id,
        heroId: 'hero-1',
        agreed: true,
      })
    ).status,
    200,
  );
  s = await readSession(host);
  const turn = {
    mapId: s.journey.id,
    roundId: s.round.id,
    turnId: s.round.turnId,
    heroId: 'hero-1',
  };
  assert.equal((await command(host, player, { type: 'START_TRAVEL', ...turn })).status, 200);
  s = await readSession(host);
  const from = s.journey.heroes[0].spaceId;
  const candidates = s.journey.definition.connections.flatMap(([a, b]) =>
    a === from ? [b] : b === from ? [a] : [],
  );
  const to = candidates.find((id) => {
    const source = s.scenario.spaceBindings.find((b) => b.id === id).sourceId;
    const space = s.mapGeneration.projection.spaces.find((x) => x.id === source);
    return s.scenario.tiles.find((t) => t.source === space.tileSource).explored;
  });
  assert.ok(to);
  assert.equal(
    (
      await command(host, player, {
        type: 'MOVE_HERO',
        ...turn,
        fromSpaceId: from,
        destinationSpaceId: to,
      })
    ).status,
    200,
  );
  const before = await readSession(host),
    backup = await readBackup(host);
  for (const edit of [
    (b) => (b.payload.state.journey.heroes.find((h) => h.heroId === 'hero-1').spaceId = from),
    (b) => (b.payload.state.round.heroes.find((h) => h.heroId === 'hero-1').actionsUsed = 2),
    (b) => (b.payload.state.round.heroes.find((h) => h.heroId === 'hero-2').turnEnded = true),
    (b) => delete b.payload.commands.find((c) => c.receipt.type === 'START_TURN').receipt.heroId,
  ]) {
    const bad = structuredClone(backup);
    edit(bad);
    signBackup(bad);
    assert.equal((await restore(host, bad)).status, 422);
    assert.deepEqual(await readSession(host), before);
  }
});
