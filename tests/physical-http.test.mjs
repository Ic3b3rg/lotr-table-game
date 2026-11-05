import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readyPhysical, reachPhysical } from './physical-helper.mjs';
import { scenarioInput, startScenario } from './scenario-helper.mjs';
import { readSession, readBackup } from './skill-test-helper.mjs';
import { command } from './preparation-helper.mjs';
import { parseScenarioPack } from '../dist/scenario-library.mjs';
import { program } from './fixtures/physical-resolution.mjs';
import { suffer, grant } from './fixtures/physical-resolution.mjs';
import { hash } from './fixtures/map-freeze.mjs';

test('HTTP: source-bound physical children use normal scenario requests and redacted views', async (t) => {
  const ready = await readyPhysical(t),
    { host, player, other } = ready;
  const s = await reachPhysical(ready),
    q = s.scenario.pending;
  assert.equal(s.schemaVersion, 25);
  assert.equal(q.actorPlayerId, other.body.player.id);
  assert.equal(q.heroId, 'hero-2');
  assert.equal(s.physical.active.heroId, 'hero-1');
  assert.equal(s.physical.decks.damage, 28);
  assert.equal((await scenarioInput(host, other, { kind: 'ack' })).status, 409);
  assert.equal(
    (await scenarioInput(host, player, { kind: 'physical-prevent', damage: 1, fear: 1 })).status,
    403,
  );
  assert.equal(
    (
      await scenarioInput(
        host,
        other,
        { kind: 'physical-prevent', damage: 1, fear: 1 },
        { heroId: 'hero-1' },
      )
    ).status,
    409,
  );
  for (const input of [
    { kind: 'physical-prevent', damage: 3, fear: 0 },
    { kind: 'physical-prevent', damage: 1, fear: 3 },
    { kind: 'physical-discard', damage: 1, fear: 1 },
  ])
    assert.equal((await scenarioInput(host, other, input)).status, 409);
  const r = await scenarioInput(host, other, { kind: 'physical-prevent', damage: 1, fear: 1 });
  assert.equal(r.status, 200, await r.clone().text());
  const body = await r.json();
  assert.equal(body.session.physical.active.kind, 'discard');
  assert.equal(body.session.physical.parents[0].completedChildren, 2);
  const r2 = await scenarioInput(host, player, { kind: 'physical-discard', damage: 1, fear: 1 });
  assert.equal(r2.status, 200, await r2.clone().text());
  const done = (await r2.json()).session;
  assert.equal(done.physical.parents[0].returnCount, 1);
  assert.equal(done.scenario.pending.kind, 'objective');
  const backup = await readBackup(host);
  assert.equal(backup.payload.state.physical.snapshot.areas[0].damage.length, 1);
  for (const value of [s, body, done]) {
    const visible = JSON.stringify(value);
    for (const forbidden of [
      'invented-damage-',
      'invented-fear-',
      'entropy',
      'rngCursor',
      'population',
      'contentFingerprint',
      'physical-v1:',
    ])
      assert.ok(!visible.includes(forbidden), forbidden);
  }
  assert.deepEqual(done.mapGeneration, ready.frozen.mapGeneration);
  assert.equal((await scenarioInput(host, player, { kind: 'ack' })).status, 200);
  assert.equal((await scenarioInput(host, player, { kind: 'ack' })).status, 200);
  assert.equal((await readSession(host)).scenario.phase, 'action');
});

test('HTTP: clients cannot open effects or bypass pending physical requests through legacy commands', async (t) => {
  const ready = await readyPhysical(t),
    { host, player, other } = ready;
  const before = await reachPhysical(ready);
  for (const choice of [
    { type: 'SUFFER_PHYSICAL', heroId: 'hero-1', damage: 4, fear: 0 },
    {
      type: 'SCENARIO_INPUT',
      scenarioId: before.scenario.id,
      packFingerprint: before.scenario.packFingerprint,
      projectionFingerprint: before.scenario.projectionFingerprint,
      pendingId: before.scenario.pending.id,
      sourceFingerprint: before.scenario.pending.fingerprint,
      heroId: 'hero-2',
      input: { kind: 'physical-prevent', damage: 0, fear: 0, program: program() },
    },
  ])
    assert.equal((await command(host, other, choice)).status, 422);
  for (const c of [
    { type: 'START_SKILL_TEST', heroId: 'hero-1', stat: 'spirit', modifier: 0, target: 1 },
    { type: 'GAIN_INSPIRATION', heroId: 'hero-1' },
    { type: 'START_SCOUT', heroId: 'hero-1', count: 2 },
    { type: 'DISCARD_PREPARED_SKILL', heroId: 'hero-1', copy: 'invented-skill-copy' },
  ])
    assert.notEqual((await command(host, player, c)).status, 200);
  assert.deepEqual(await readSession(host), before);
});

test('pack: physical action is expressly synthetic, exclusive, source-hashed and bounded', async (t) => {
  const { pack } = await readyPhysical(t);
  assert.doesNotThrow(() => parseScenarioPack(pack));
  for (const edit of [
    (p) => {
      p.manifest.scope = 'startup-only';
    },
    (p) => {
      p.name = 'Avventura originale';
    },
    (p) => {
      p.definitions[0].states.at(-1).actions[0].origin.type = 'FFG.JIME.Actions.SufferDamage';
    },
    (p) => {
      p.definitions[0].states.at(-1).actions[0].origin.parameterHash = '0'.repeat(64);
    },
    (p) => {
      p.definitions[0].states.at(-1).actions.push(p.definitions[0].states[1].actions[0]);
    },
    (p) => {
      p.definitions[0].states.at(-1).actions[0].program.children[0].cards[0].amount = 57;
    },
  ]) {
    const bad = structuredClone(pack);
    edit(bad);
    assert.throws(() => parseScenarioPack(bad));
  }
});

test('HTTP: missing raw prevents the source-bound initialization without partial startup', async (t) => {
  const ready = await readyPhysical(t);
  const { rm } = await import('node:fs/promises');
  await rm(ready.physicalPath);
  const before = await readSession(ready.host);
  assert.equal((await startScenario(ready.host, ready.player)).status, 409);
  assert.deepEqual(await readSession(ready.host), before);
});

test('HTTP: empty-deck diagnostic retains partial cards, accepted source cost and a non-cancellable continuation', async (t) => {
  const ready = await readyPhysical(t, (pack, pr) => {
    pr.children = [suffer(0, 30, 0, [grant(1, 1)])];
    pack.definitions[0].states.at(-1).actions[0].origin.parameterHash = hash(pr);
  });
  await reachPhysical(ready);
  const r = await scenarioInput(ready.host, ready.other, {
    kind: 'physical-prevent',
    damage: 1,
    fear: 0,
  });
  assert.equal(r.status, 200, await r.text());
  const before = await readSession(ready.host),
    p = (await readBackup(ready.host)).payload.state.physical;
  assert.equal(before.physical.active.reason, 'required-deck-empty');
  assert.equal(before.physical.active.remaining.damage, 1);
  assert.equal(p.snapshot.areas[0].damage.length, 28);
  assert.equal(p.snapshot.credits[1], 0);
  assert.equal(before.physical.parents[0].returnCount, 0);
  assert.equal((await scenarioInput(ready.host, ready.player, { kind: 'ack' })).status, 409);
  assert.equal(
    (
      await scenarioInput(ready.host, ready.player, {
        kind: 'physical-prevent',
        damage: 0,
        fear: 0,
      })
    ).status,
    409,
  );
  assert.deepEqual(await readSession(ready.host), before);
});
