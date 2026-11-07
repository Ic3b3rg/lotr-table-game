import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readyLastStand } from './last-stand-helper.mjs';
import { reachPhysical } from './physical-helper.mjs';
import { scenarioInput } from './scenario-helper.mjs';
import { readSession, readBackup } from './skill-test-helper.mjs';
import { cycleCommand } from './physical-cycle-helper.mjs';
import { suffer } from './fixtures/physical-resolution.mjs';
import { hash } from './fixtures/physical-fronts.mjs';
import { startHost } from './host-helper.mjs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';

test('P2 HTTP computes the test and returns the exact scenario parent with conserved resources and receipts', async (t) => {
  const ready = await readyLastStand(t, undefined, undefined, (c) => {
    for (const s of c.skills) {
      s.success = 1;
      s.fate = 0;
    }
  });
  const first = await reachPhysical(ready);
  assert.equal(first.physical.active.kind, 'decision');
  assert.equal(first.physical.active.options[0].id, 'reveal');
  assert.equal(first.schemaVersion, 31);
  assert.equal(
    (await scenarioInput(ready.host, ready.other, { kind: 'physical-choice', option: 'reveal' }))
      .status,
    403,
  );
  assert.equal((await scenarioInput(ready.host, ready.player, { kind: 'ack' })).status, 409);
  for (const option of ['reveal', 'resolve']) {
    const r = await scenarioInput(ready.host, ready.player, { kind: 'physical-choice', option });
    assert.equal(r.status, 200, await r.text());
  }
  const done = await readSession(ready.host),
    backup = await readBackup(ready.host);
  assert.equal(done.scenario.pending.kind, 'objective');
  assert.equal(done.physical.parents[0].returnCount, 1);
  assert.equal(done.physical.lastStand.heroes[0].difficulty, 2);
  assert.equal(done.physical.lastStand.selections[0].outcome, 'pass');
  assert.equal(backup.payload.state.physical.snapshot.decks.damage.length, 28);
  assert.equal(backup.payload.state.preparation.heroes[0].inspiration, 2);
  for (const hidden of [
    'entropy',
    'rngCursor',
    'population',
    'instructionHash',
    'cardHash',
    'invented-damage-',
  ])
    assert.ok(!JSON.stringify(done).includes(hidden), hidden);
});

test('a defeated hero leaves the map, cannot take ordinary actions, and loss occurs at the next shadow boundary', async (t) => {
  const ready = await readyLastStand(
    t,
    (_pack, pr) => {
      pr.children[0].face = 'faceup';
    },
    (input) => {
      for (const d of input.definitions) d.body = [{ op: 'keep-faceup' }];
    },
    (catalog) => {
      for (const card of catalog.skills) {
        card.success = 1;
        card.fate = 0;
      }
    },
  );
  await reachPhysical(ready);
  // The real test has sufficient successes; only the live faceup limit forces failure.
  for (const option of ['reveal', 'resolve']) {
    const r = await scenarioInput(ready.host, ready.player, { kind: 'physical-choice', option });
    assert.equal(r.status, 200, await r.text());
  }
  const defeated = await readSession(ready.host);
  const outcome = defeated.physical.lastStand.selections[0];
  assert.ok(outcome.successes >= outcome.difficulty);
  assert.equal(outcome.forcedFailure, true);
  assert.equal(outcome.outcome, 'fail');
  assert.equal(defeated.journey.heroes[0].removed, true);
  assert.equal(defeated.physical.lastStand.heroes[0].defeated, true);
  assert.equal(defeated.physical.lastStand.terminal, null);
  for (let n = 0; n < 3; n++) {
    const s = await readSession(ready.host);
    if (!s.scenario.pending) break;
    const r = await scenarioInput(ready.host, ready.other, { kind: 'ack' });
    assert.equal(r.status, 200, await r.text());
  }
  assert.equal((await cycleCommand(ready, 'START_TURN')).status, 409);
  let r = await cycleCommand(ready, 'START_TURN', {}, ready.other);
  assert.equal(r.status, 200, await r.text());
  r = await cycleCommand(ready, 'END_TURN', {}, ready.other);
  assert.equal(r.status, 200, await r.text());
  r = await cycleCommand(ready, 'BEGIN_SHADOW', {}, ready.other);
  assert.equal(r.status, 200, await r.text());
  const terminal = await readSession(ready.host);
  assert.equal(terminal.physical.lastStand.terminal.timing, 'shadow-start');
  assert.equal(terminal.physical.lastStand.terminal.kind, 'adventure-loss');
  assert.equal(
    (await cycleCommand(ready, 'CONFIRM_SHADOW_STEP', { step: 'enemies' }, ready.other)).status,
    409,
  );
  const p = (await readBackup(ready.host)).payload.state.physical;
  assert.equal(p.snapshot.areas[0].damage.length, 5);
  assert.equal(p.snapshot.parents[0].returnCount, 1);
});

test('title acquisition, a pending prepare limit and genuine title copies survive HTTP restart without the pack', async (t) => {
  const ready = await readyLastStand(
    t,
    (pack, pr) => {
      pr.children = [
        ...Array.from({ length: 3 }, () => ({ kind: 'scout', hero: 0, count: 1 })),
        { ...suffer(1, 5, 0), face: 'faceup' },
      ];
      const first = pack.definitions[0].states.at(-1),
        template = structuredClone(first.actions[0]);
      first.transitions.FINISHED = 13;
      for (let n = 0; n < 3; n++) {
        const program = { ...structuredClone(pr), children: [suffer(0, 0, 5)] };
        pack.definitions[0].states.push({
          ...structuredClone(first),
          index: 13 + n,
          actions: [
            {
              ...structuredClone(template),
              program,
              origin: { ...template.origin, parameterHash: hash(program) },
            },
          ],
          transitions: { FINISHED: n === 2 ? 10 : 14 + n },
        });
      }
    },
    (ir) => {
      for (const d of ir.definitions.filter((d) => d.cardId.includes('damage')))
        d.body = [{ op: 'keep-faceup' }];
    },
    (catalog) => {
      catalog.heroes[0].stats.spirit = 3;
      for (const s of catalog.skills) {
        s.success = 1;
        s.fate = 0;
      }
    },
  );
  let host = ready.host,
    restarted = false;
  t.after(() => host.stop());
  await reachPhysical(ready);
  for (let n = 0; n < 30; n++) {
    const s = await readSession(host),
      a = s.physical.active;
    if (!a) break;
    const actor = a.actorPlayerId === ready.other.body.player.id ? ready.other : ready.player;
    let input;
    if (a.mode === 'scout')
      input = {
        kind: 'physical-scout',
        prepare: a.options[0].id,
        discard: null,
        top: [],
        bottom: [],
      };
    else if (a.mode === 'select') {
      if (!restarted) {
        const saved = await readBackup(host);
        assert.equal(saved.payload.state.physical.snapshot.lastStand.titles[0].pending, true);
        assert.equal(s.preparation.heroes[0].prepared.length, 4);
        await host.stop('SIGKILL');
        for (const path of [
          ready.scenarioPath,
          ready.physicalPath,
          ready.lastStandPath,
          join(host.dataDir, 'physical-fronts.json'),
        ])
          await rm(path);
        host = await startHost({ LOTR_DATA_DIR: host.dataDir });
        assert.deepEqual((await readBackup(host)).payload, saved.payload);
        restarted = true;
      }
      const title = s.physical.lastStand.titles.find((t) => !t.pending);
      input = {
        kind: 'physical-select',
        ids: [title?.copy ?? a.options.find((o) => !o.id.startsWith('invented-title-')).id],
      };
    } else input = { kind: 'physical-choice', option: a.options[0].id };
    const r = await scenarioInput(host, actor, input);
    assert.equal(r.status, 200, await r.text());
  }
  const done = await readSession(host),
    p = (await readBackup(host)).payload.state.physical;
  assert.equal(restarted, true);
  assert.equal(done.physical.lastStand.titles.length, 2);
  assert.ok(done.physical.lastStand.titles.every((t) => t.skill.kind === 'title'));
  assert.equal(done.physical.lastStand.heroes[0].difficulty, 4);
  assert.equal(done.preparation.heroes[0].prepared.length, 4);
  assert.equal(
    p.snapshot.lastStand.titles.every((t) => !t.pending && !t.removed),
    true,
  );
  assert.ok(
    p.snapshot.resolution.resources.preparation.heroes[0].discard.includes(
      p.snapshot.lastStand.titles[0].copy,
    ),
  );
  assert.equal(done.scenario.pending.kind, 'objective');
});
