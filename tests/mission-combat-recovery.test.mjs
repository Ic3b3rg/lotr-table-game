import test from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import {
  readyMission,
  reachMission,
  commitMission,
  drainMission,
  ok,
  strongInventedWeapons,
} from './mission-combat-helper.mjs';
import { readSession, readBackup, signBackup } from './skill-test-helper.mjs';
import { scenarioInput } from './scenario-helper.mjs';
import { command } from './preparation-helper.mjs';
import { drainCombat } from './combat-controller-helper.mjs';
import { startHost } from './host-helper.mjs';
import { recoverSeat } from './last-stand-helper.mjs';
import { runtime } from './threat-helper.mjs';

function admin(actual, expected) {
  const copy = structuredClone(actual);
  for (const key of ['generation', 'revision', 'updatedAt']) copy[key] = expected[key];
  return copy;
}
async function cut(t, r) {
  const b = await readBackup(r.host),
    view = await readSession(r.host),
    origin = structuredClone(b.payload.state.physical.cycle.seed);
  await r.host.stop('SIGKILL');
  const host = await startHost();
  t.after(() => host.dispose());
  for (const file of [
    'scenario-pack',
    'physical-content',
    'physical-fronts',
    'physical-last-stand',
    'physical-boons',
  ])
    await assert.rejects(access(join(host.dataDir, file + '.json')));
  const empty = await readSession(host);
  assert.equal(empty.scenario, null);
  await ok(
    host.request('/api/restores', {
      backup: b,
      generation: empty.generation,
      expectedRevision: empty.revision,
      confirmed: true,
    }),
  );
  const after = (await readBackup(host)).payload;
  assert.deepEqual({ ...after, state: admin(after.state, b.payload.state) }, b.payload);
  assert.deepEqual(admin(await readSession(host), view), view);
  assert.deepEqual(after.state.physical.cycle.seed, origin);
  await recoverSeat(host, r.player);
  await recoverSeat(host, r.other);
  r.host = host;
  return b;
}

test('twelve accepted SIGKILL/empty packless restores preserve whole payloads, views and origin through cost, cards, conversion, spawn, grant, defeat and callback return', async (t) => {
  const r = await readyMission(t, { fate: 1, edit: strongInventedWeapons });
  await reachMission(r);
  const origin = structuredClone((await readBackup(r.host)).payload.state.physical.cycle.seed);
  let cuts = 0;
  await ok(commitMission(r, 'PUSH'));
  await cut(t, r);
  cuts++;
  await ok(scenarioInput(r.host, r.player, { kind: 'physical-choice', option: 'reveal' }));
  await cut(t, r);
  cuts++;
  await ok(scenarioInput(r.host, r.player, { kind: 'physical-choice', option: 'inspiration' }));
  await cut(t, r);
  cuts++;
  const selection = (await readSession(r.host)).physical.active;
  await ok(
    scenarioInput(r.host, r.player, {
      kind: 'physical-select',
      ids: selection.options.slice(0, selection.minimum).map((o) => o.id),
    }),
  );
  await cut(t, r);
  cuts++;
  await ok(scenarioInput(r.host, r.player, { kind: 'physical-choice', option: 'resolve' }));
  const benefit = await cut(t, r);
  cuts++;
  assert.equal(
    benefit.payload.state.physical.snapshot.resolution.resources.boonCustody[0].kind,
    'emboldened',
  );
  await ok(scenarioInput(r.host, r.player, { kind: 'ack' }));
  const spawn = await cut(t, r);
  cuts++;
  assert.equal(spawn.payload.state.scenario.pending.kind, 'deployment');
  await ok(scenarioInput(r.host, r.player, { kind: 'ack' }));
  const principal = await cut(t, r);
  cuts++;
  assert.equal(principal.payload.state.scenario.objective.id, 4);
  await ok(scenarioInput(r.host, r.player, { kind: 'ack' }));
  const grant = await cut(t, r);
  cuts++;
  assert.equal(grant.payload.state.scenario.pending.kind, 'source-attack');
  const s = await readSession(r.host),
    offer = s.combat.attacks.find((a) => !a.reason);
  await ok(
    command(
      r.host,
      r.player,
      {
        type: 'START_ATTACK',
        roundId: s.round.id,
        turnId: s.round.turnId,
        heroId: offer.heroId,
        groupId: offer.groupId,
        itemCopies: offer.itemCopies,
        stat: offer.stat,
        replaceCopy: null,
        grantId: s.combat.grant.id,
      },
      s,
    ),
  );
  await cut(t, r);
  cuts++;
  await drainCombat(
    r,
    (q) => q.options?.find((o) => o.id.startsWith('slot:') && !o.unavailable)?.id ?? null,
    (s) => s.combat.current?.stage === 'reward',
  );
  const defeated = await cut(t, r);
  cuts++;
  assert.ok(
    defeated.payload.state.scenario.enemies.groups
      .find((g) => g.id === offer.groupId)
      .figures.every((f) => f.health === 0),
  );
  await drainCombat(
    r,
    () => null,
    (s) => !!s.scenario.pending,
  );
  await cut(t, r);
  cuts++;
  for (let n = 0; n < 8; n++) {
    await drainMission(r);
    await drainCombat(
      r,
      () => null,
      (s) => !!s.scenario.pending,
    );
    if (!(await readSession(r.host)).combat.current) break;
  }
  const final = await cut(t, r);
  cuts++;
  assert.equal(cuts, 12);
  assert.deepEqual(final.payload.state.physical.cycle.seed, origin);
  const sc = final.payload.state.scenario;
  assert.equal(sc.objective.id, 2);
  assert.equal(sc.firstCombat.callbacks.length, 1);
  assert.equal(sc.firstCombat.callbacks[0].returned, true);
  assert.equal(sc.firstCombat.spawns[0].returned, true);
  assert.equal(sc.play.active, null);
  const edits = [
    (b) => b.payload.state.scenario.firstCombat.spawns[0].budgetAfter++,
    (b) => b.payload.state.scenario.firstCombat.spawns[0].availableAfter++,
    (b) => (b.payload.state.scenario.firstCombat.spawns[0].actorHeroId = 'hero-2'),
    (b) => (b.payload.state.scenario.firstCombat.spawns[0].grant = 'declined'),
    (b) => (b.payload.state.scenario.firstCombat.spawns[0].returned = false),
    (b) => (b.payload.state.scenario.firstCombat.callbacks[0].cause = 'timer'),
    (b) => (b.payload.state.scenario.firstCombat.callbacks[0].returned = false),
    (b) =>
      b.payload.state.scenario.firstCombat.callbacks.push(
        structuredClone(b.payload.state.scenario.firstCombat.callbacks[0]),
      ),
    (b) => b.payload.state.scenario.play.tests[0].total++,
    (b) => (b.payload.state.scenario.play.attempts[0].cost = 0),
    (b) =>
      b.payload.state.scenario.enemies.groups.find((g) => g.id === offer.groupId).position[0]++,
    (b) =>
      (b.payload.state.scenario.enemies.groups.find((g) => g.id === offer.groupId).logic = null),
    (b) => (b.payload.state.scenario.pack.manifest.firstCombat.pose.index = 1),
    (b) => (b.payload.state.scenario.pack.manifest.firstCombat.configuration.difficulty = 'hard'),
    (b) => b.payload.state.physical.cycle.seed.scenario.pack.manifest.firstCombat.pose.tileHash++,
    (b) =>
      (b.payload.state.physical.runs
        .find((r) => r.answers.some((a) => a.input.option === 'inspiration'))
        .answers.find((a) => a.input.option === 'inspiration').cursor = 'e'.repeat(64)),
    (b) => b.payload.state.combat.attempts[0].result.hits++,
    (b) => b.payload.state.preparation.heroes[0].inspiration++,
  ];
  const at = await readSession(r.host),
    before = (await readBackup(r.host)).payload;
  for (const edit of edits) {
    const bad = structuredClone(final);
    edit(bad);
    signBackup(bad);
    assert.equal(runtime.BackupSchema.safeParse(bad).success, false);
    assert.equal(
      (
        await r.host.request('/api/restores', {
          backup: bad,
          generation: at.generation,
          expectedRevision: at.revision,
          confirmed: true,
        })
      ).status,
      422,
    );
    assert.deepEqual((await readBackup(r.host)).payload, before);
    assert.deepEqual(await readSession(r.host), at);
  }
});
