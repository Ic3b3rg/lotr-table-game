import test from 'node:test';
import assert from 'node:assert/strict';
import { readyCombat, drainCombat } from './combat-controller-helper.mjs';
import {
  attachActivationSource,
  attachActivationThreshold,
} from './fixtures/shadow-activations.mjs';
import { compileCombatClosure } from '../dist/combat-library.mjs';
import { parseScenarioPack } from '../dist/scenario-library.mjs';
import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { endTurns, finishCycle } from './original-round-helper.mjs';
import { cycleCommand } from './physical-cycle-helper.mjs';
import { readSession, readBackup, signBackup } from './skill-test-helper.mjs';
import { drainFollowup, rally } from './second-shadow-helper.mjs';
import { command } from './preparation-helper.mjs';
import { startHost } from './host-helper.mjs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
const built = buildSync({
  entryPoints: [fileURLToPath(new URL('../src/scenario/round-source.ts', import.meta.url))],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
  target: 'node24',
});
const { preflightSourceShadow } = await import(
  `data:text/javascript;base64,${Buffer.from(Buffer.from(built.outputFiles[0].contents).toString() + '\n//# sourceURL=shadow-phase-test.mjs').toString('base64')}`
);

test('whole source shadow activates live ready groups in order, resolves physical packets and refreshes before a real next round', async (t) => {
  const ready = await readyCombat(t, (src, pack, frozen) => {
    attachActivationSource(
      src,
      frozen.mapGeneration.projection.spaces
        .map((s) => s.tileSource)
        .filter((s, n, a) => a.indexOf(s) === n),
    );
    Object.assign(src.shadow.controller, pack.manifest.rounds.controller);
    attachActivationThreshold(src, pack);
  });
  let host = ready.host;
  t.after(() => host.stop());
  async function roundtrip(label) {
    const before = await readBackup(host);
    await host.stop('SIGKILL');
    host = await startHost({ LOTR_DATA_DIR: host.dataDir });
    ready.host = host;
    assert.deepEqual((await readBackup(host)).payload, before.payload, label + ' SIGKILL');
    const at = await readSession(host);
    const r = await host.request('/api/restores', {
      backup: before,
      generation: at.generation,
      expectedRevision: at.revision,
      confirmed: true,
    });
    assert.equal(r.status, 200, await r.text());
    const after = await readBackup(host);
    for (const k of Object.keys(before.payload.state).filter(
      (k) => !['generation', 'revision', 'updatedAt'].includes(k),
    ))
      assert.deepEqual(after.payload.state[k], before.payload.state[k], label + ':' + k);
    assert.deepEqual(after.payload.commands, before.payload.commands, label + ' receipts');
    for (const player of [ready.player, ready.other]) {
      const r = await host.request('/api/recover', {
        recoveryCode: player.recoveryCode,
        generation: after.payload.state.generation,
      });
      assert.equal(r.status, 200);
      player.cookie = r.headers.get('set-cookie').split(';')[0];
    }
  }
  await endTurns(ready);
  const before = await readSession(ready.host);
  const raw = (await (await fetch(ready.host.url + '/api/backups')).json()).payload.state;
  const badPack = structuredClone(raw.scenario.pack);
  badPack.manifest.combat.source.shadow.controller.bodyHash = 'a'.repeat(64);
  badPack.manifest.combat = compileCombatClosure(badPack.manifest.combat.source);
  assert.throws(() => parseScenarioPack(badPack), /Controller attivazioni/);
  for (const kind of ['boon', 'later-threshold', 'darkness-override']) {
    const work = structuredClone(raw);
    if (kind === 'boon') {
      const src = work.scenario.pack.manifest.combat.source;
      src.additions[0].effect = { op: 'gain-boon', boon: 'hidden' };
      src.assets
        .filter((a) => a.cls === 'EnemyActivationModel')
        .forEach((a) => {
          a.data.KeyAttackAdditionalEffect = src.additions[0].key;
          // Source hashes and artifact are coherently updated in this invented fixture.
        });
      const { digest } = await import('../dist/map-freeze-library.mjs');
      src.assets.forEach((a) => (a.dataHash = digest(a.data)));
      work.scenario.pack.manifest.combat = compileCombatClosure(src);
    } else if (kind === 'later-threshold') {
      const d = work.scenario.pack.definitions.find((d) => d.source === 'example.assets:814');
      d.states.find((s) => s.index === 2).actions[0].threshold = 1;
    } else
      work.scenario.globals[work.scenario.pack.manifest.rounds.bindings.darknessOverride] =
        'unsupported';
    const untouched = structuredClone(work);
    assert.throws(() => preflightSourceShadow(work, '0'.repeat(64)), undefined, kind);
    assert.deepEqual(work, untouched, kind + ' preflight must not mutate even a disposable input');
    if (kind === 'boon') {
      work.scenario.enemies.groups.forEach((g) => (g.exhausted = true));
      assert.doesNotThrow(() => preflightSourceShadow(work, '0'.repeat(64)));
    }
  }
  const order = before.scenario.enemies.groups
    .filter((g) => g.placed && !g.exhausted && g.figures.some((f) => f.health > 0))
    .map((g) => g.id);
  assert.ok(order.length);
  let r = await cycleCommand(ready, 'BEGIN_SHADOW');
  assert.equal(r.status, 200, await r.text());
  let s = await readSession(ready.host);
  assert.equal(s.round.phase, 'shadow');
  assert.equal(s.combat.current.kind, 'activation');
  assert.equal(s.combat.current.groupId, order[0]);
  for (const file of [
    ready.scenarioPath,
    ...['physical-content.json', 'physical-fronts.json', 'physical-last-stand.json'].map((f) =>
      join(host.dataDir, f),
    ),
  ])
    await rm(file);
  await roundtrip('selected-instruction-and-target');
  s = await readSession(host);
  const snapshot = await readBackup(host);
  for (const mutate of [
    (state) => state.combat.streams.target++,
    (state) => state.combat.attempts.at(-1).activation.positions.push('invented-position'),
    (state) =>
      (state.combat.attempts.at(-1).selection.index =
        (state.combat.attempts.at(-1).selection.index + 1) % 2),
    (state) => (state.physical.cycle.seed.round.number = 3),
  ]) {
    const bad = structuredClone(snapshot);
    mutate(bad.payload.state);
    signBackup(bad);
    const r = await host.request('/api/restores', {
      backup: bad,
      generation: s.generation,
      expectedRevision: s.revision,
      confirmed: true,
    });
    assert.equal(r.status, 422, await r.text());
    assert.deepEqual((await readBackup(host)).payload, snapshot.payload);
  }
  const q = s.combat.pending;
  const actor = [ready.player, ready.other].find((p) => p.body.player.id === q.actorPlayerId);
  const choice = {
    type: 'COMBAT_INPUT',
    combatId: q.combatId,
    pendingId: q.id,
    sourceFingerprint: q.sourceFingerprint,
    choice: q.options[0].id,
  };
  const wrong = [ready.player, ready.other].find((p) => p !== actor);
  r = await command(ready.host, wrong, choice, s);
  assert.equal(r.status, 403);
  assert.deepEqual(await readSession(ready.host), s);
  choice.requestId = randomUUID();
  const responses = await Promise.all([
    command(host, actor, choice, s),
    command(host, actor, choice, s),
  ]);
  assert.deepEqual(
    responses.map((r) => r.status),
    [200, 200],
  );
  assert.deepEqual((await responses[0].json()).receipt, (await responses[1].json()).receipt);
  r = await command(host, actor, { ...choice, requestId: randomUUID() }, s);
  assert.equal(r.status, 409);
  await drainCombat(
    ready,
    () => null,
    (s) => s.physical?.active?.mode === 'allocate',
  );
  assert.equal((await readSession(host)).physical.active.mode, 'allocate');
  await roundtrip('negation');
  await drainCombat(ready);
  s = await readSession(ready.host);
  assert.equal(s.round.shadowStep, 'threat');
  const active = s.scenario.rounds.frames.at(-1);
  assert.deepEqual(active.activated, order);
  const exported = (await (await fetch(ready.host.url + '/api/backups')).json()).payload.state;
  const attempts = exported.combat.attempts.filter((a) => a.kind === 'activation');
  assert.deepEqual(
    attempts.map((a) => a.groupId),
    order,
  );
  assert.ok(attempts.every((a) => a.returned));
  assert.ok(attempts.some((a) => a.outcome?.sealed && a.outcome.cause === 'activation'));
  assert.ok(
    attempts
      .filter((a) => a.packet?.executed)
      .every((a) => a.outcome.returnTo === a.activation.frameId),
  );
  assert.equal(exported.physical.cycle.seed.round.number, 1);
  r = await cycleCommand(ready, 'CONFIRM_SHADOW_STEP', { step: 'threat' });
  assert.equal(r.status, 200, await r.text());
  await roundtrip('threshold-and-placements');
  await drainFollowup(ready);
  await finishCycle(ready);
  s = await readSession(ready.host);
  assert.equal(s.round.phase, 'rally');
  assert.ok(
    s.scenario.enemies.groups
      .filter((g) => g.figures.some((f) => f.health > 0))
      .every((g) => !g.exhausted && g.attackReduction === 0),
  );
  assert.ok(s.scenario.rounds.frames.at(-1).refreshed.length >= order.length);
  assert.ok(s.scenario.enemies.groups.length > before.scenario.enemies.groups.length);
  assert.ok(s.scenario.rounds.frames.at(-1).handled.includes('example.assets:1000'));
  assert.deepEqual(
    s.scenario.threats.map((t) => t.source),
    ['example.assets:1001'],
  );
  for (const actor of [ready.player, ready.other]) {
    r = await cycleCommand(ready, 'START_RALLY_SCOUT', {}, actor);
    assert.equal(r.status, 200, await r.text());
    await roundtrip('scout');
    await finishCycle(ready);
  }
  r = await cycleCommand(ready, 'END_RALLY');
  assert.equal(r.status, 200, await r.text());
  s = await readSession(ready.host);
  assert.equal(s.round.number, before.round.number + 1);
  r = await cycleCommand(ready, 'START_TURN');
  assert.equal(r.status, 200, await r.text());
});
