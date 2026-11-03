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
