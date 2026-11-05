import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  readyLiveGroups,
  endTurns,
  untilLive,
  answerLive,
  actorFor,
} from './live-groups-helper.mjs';
import { cycleCommand } from './physical-cycle-helper.mjs';
import { scenarioInput } from './scenario-helper.mjs';
import { readBackup, readSession } from './skill-test-helper.mjs';

test('HTTP/Store.once continues from darkness defeat to the actual group trial without changing source party count or paid state', async (t) => {
  for (const defeated of [0, 1]) {
    const r = await readyLiveGroups(t, { defeated });
    await endTurns(r);
    let s = await readSession(r.host);
    const origin = (await readBackup(r.host)).payload.state.physical.cycle.seed;
    const ok = async (p) => {
      const q = await p;
      assert.equal(q.status, 200, await q.text());
      return q;
    };
    await ok(cycleCommand(r, 'BEGIN_SHADOW'));
    s = await untilLive(r, (s) => !s.physical.active);
    assert.equal(s.physical.lastStand.heroes[defeated].defeated, true);
    assert.equal(
      s.scenario.conclusion,
      undefined,
      'a hero loss is deferred while survivors continue this Shadow',
    );
    const retained = structuredClone(s.preparation.heroes[defeated]);
    const cards = s.physical.heroes[defeated];
    await ok(cycleCommand(r, 'CONFIRM_SHADOW_STEP', { step: 'threat' }));
    s = await untilLive(r, (s) => s.scenario.pending?.kind === 'physical');
    const actor = actorFor(r, s.physical.active.actorPlayerId);
    assert.notEqual(s.physical.active.actorHeroId, retained.heroId);
    const before = await readBackup(r.host);
    const wrong = [r.player, r.other].find((p) => p !== actor);
    const denied = await scenarioInput(
      r.host,
      wrong,
      { kind: 'physical-choice', option: 'reveal' },
      {},
      s,
    );
    assert.equal(denied.status, 403);
    assert.deepEqual((await readBackup(r.host)).payload, before.payload);
    const requestId = randomUUID();
    const responses = await Promise.all([0, 1].map(() => answerLive(r, s, { requestId })));
    assert.deepEqual(
      responses.map((r) => r.status),
      [200, 200],
    );
    assert.deepEqual((await responses[0].json()).receipt, (await responses[1].json()).receipt);
    const afterOnce = await readBackup(r.host);
    const stale = await answerLive(r, s, { requestId: randomUUID() });
    assert.equal(stale.status, 409);
    assert.deepEqual((await readBackup(r.host)).payload, afterOnce.payload);
    s = await untilLive(r, (s) => s.scenario.pending?.kind !== 'physical');
    assert.deepEqual(s.preparation.heroes[defeated], retained);
    assert.deepEqual(s.physical.heroes[defeated], cards);
    assert.equal(s.preparation.heroes.length, 2);
    assert.equal(
      s.scenario.globals.companyCount,
      2,
      'source PlayerCount includes the defeated hero',
    );
    const backup = await readBackup(r.host);
    assert.deepEqual(backup.payload.state.physical.cycle.seed, origin);
    const group = backup.payload.state.physical.runs.find(
      (run) => run.program.children[0].kind === 'group-test',
    );
    assert.equal(group.program.groupRules, 'source-live-groups-v1');
    const parent = backup.payload.state.physical.snapshot.parents.find((p) => p.id === group.id);
    assert.equal(parent.returnCount, 1);
    assert.equal(parent.results[0].tests.length, 1);
    assert.notEqual(parent.results[0].tests[0].heroId, retained.heroId);
  }
});

test('a missing physical capability fails the entire marked continuation before any cost or random change', async (t) => {
  const { runtime } = await import('./threat-helper.mjs');
  const r = await readyLiveGroups(t);
  const saved = await readBackup(r.host);
  for (const field of ['fronts', 'lastStand']) {
    const state = structuredClone(saved.payload.state);
    delete state.physical[field];
    const before = structuredClone(state);
    assert.throws(() => runtime.preflightSourceShadow(state), /capacità fisiche complete/);
    assert.deepEqual(state, before);
  }
  assert.deepEqual((await readBackup(r.host)).payload, saved.payload);
});

test('startup refuses a marked pack without frozen Last Stand instructions before spending or initializing physical RNG', async (t) => {
  const { readyScenario, startScenario } = await import('./scenario-helper.mjs');
  const { attachEncounter } = await import('./original-encounter-helper.mjs');
  const { attachRounds } = await import('./fixtures/source-rounds.mjs');
  const { attachFollowup } = await import('./fixtures/shadow-followup.mjs');
  const { attachFailure } = await import('./fixtures/adventure-failure.mjs');
  const { attachLiveGroups } = await import('./fixtures/live-groups.mjs');
  const { diagnosticRaw, inventedFrontInput } = await import('./fixtures/physical-fronts.mjs');
  const { compilePhysicalFronts } = await import('../dist/physical-resolution-library.mjs');
  const { writeFile } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const r = await readyScenario(t, (pack, frozen) => {
    attachEncounter(pack);
    attachRounds(pack, frozen.mapGeneration.projection);
    attachFollowup(pack, frozen);
    attachFailure(pack);
    attachLiveGroups(pack);
  });
  const raw = diagnosticRaw();
  await writeFile(join(r.host.dataDir, 'physical-content.json'), JSON.stringify(raw));
  await writeFile(
    join(r.host.dataDir, 'physical-fronts.json'),
    JSON.stringify(compilePhysicalFronts(raw, inventedFrontInput(raw), r.catalog)),
  );
  const before = await readBackup(r.host);
  const response = await startScenario(r.host, r.player);
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, 'PHYSICAL_SOURCE_REQUIRED');
  assert.deepEqual((await readBackup(r.host)).payload, before.payload);
});

test('the collective return resets only survivors and makes the next phase available when slot0 is defeated', async (t) => {
  const { finishCycle } = await import('./original-round-helper.mjs');
  const { answerFollowup } = await import('./second-shadow-helper.mjs');
  const r = await readyLiveGroups(t);
  const ok = async (p) => {
    const x = await p;
    assert.equal(x.status, 200, await x.text());
  };
  await endTurns(r);
  await ok(cycleCommand(r, 'BEGIN_SHADOW'));
  await untilLive(r, (s) => !s.physical.active);
  const retained = structuredClone((await readBackup(r.host)).payload.state.preparation.heroes[0]);
  await ok(cycleCommand(r, 'CONFIRM_SHADOW_STEP', { step: 'threat' }));
  for (let n = 0; n < 100; n++) {
    const s = await readSession(r.host);
    if (s.round.phase === 'rally') break;
    if (s.physical.active) await ok(answerLive(r, s));
    else if (s.scenario.pending) await ok(answerFollowup(r, s));
    else await finishCycle(r);
  }
  const s = await readSession(r.host);
  assert.equal(s.round.phase, 'rally');
  const full = (await readBackup(r.host)).payload.state;
  assert.ok(full.preparation.heroes[1].deck.length > 0);
  assert.equal(
    full.preparation.heroes[1].discard.length,
    0,
    'the surviving company still receives its collective reset',
  );
  assert.deepEqual(full.preparation.heroes[0], retained, 'defeated hero cards are retained');
  assert.equal(
    s.round.heroes[0].rallyDone,
    true,
    'a removed hero cannot hold up the survivors at the next phase',
  );
});
