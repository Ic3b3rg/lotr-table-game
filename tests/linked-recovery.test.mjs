import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { buildSync } from 'esbuild';
import {
  prepareLinked,
  linkedNode,
  commitLinked,
  reachLinked,
  nextLinkedRound,
  finishPhysical,
  ok,
} from './linked-http-helper.mjs';
import { readBackup, readSession, signBackup } from './skill-test-helper.mjs';
import { scenarioInput } from './scenario-helper.mjs';
import { cycleCommand } from './physical-cycle-helper.mjs';
import { recoverSeat } from './last-stand-helper.mjs';
import { startHost } from './host-helper.mjs';
import { finishCycle, answerCycle, endTurns } from './original-round-helper.mjs';
const built = buildSync({
  stdin: {
    contents: "export { BackupSchema } from './src/server/backup-format';",
    resolveDir: process.cwd(),
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
});
const { BackupSchema } = await import(
  'data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].contents).toString('base64')
);
const admin = (value, expected) => {
  const out = structuredClone(value);
  for (const k of ['generation', 'revision', 'updatedAt']) out[k] = expected[k];
  return out;
};

test('fifteen SIGKILLs restore whole linked payloads and views packless across first visit, cards, reveal, damage, return, recipient and immediate title preparation', async (t) => {
  const r = await prepareLinked(t, {
    edit: (p) => {
      p.definitions
        .find((d) => d.source === p.principal)
        .states.find((s) => s.index === 1)
        .actions.find((a) => a.op === 'threat').threshold = 50;
    },
    catalogEdit: (c) => {
      for (const h of c.heroes) h.stats.agility = 1;
    },
    frontEdit: (ir) => {
      for (const d of ir.definitions.filter((d) => d.cardId.includes('damage')))
        d.body = [
          {
            op: 'choose-alternative',
            branches: [
              { op: 'discard-inspiration', hero: 'self', n: 1 },
              { op: 'discard-prepared', hero: 'self', n: 1 },
            ],
          },
          { op: 'keep-faceup' },
        ];
    },
  });
  await ok((await import('./scenario-helper.mjs')).startScenario(r.host, r.player));
  for (let n = 0; n < 90; n++) {
    const s = await readSession(r.host),
      q = s.scenario.pending;
    if (!q) break;
    const actor = q.actorPlayerId === r.other.body.player.id ? r.other : r.player;
    const input =
      q.kind === 'scout'
        ? q.stage === 'ready'
          ? { kind: 'scout-reveal' }
          : {
              kind: 'scout-resolve',
              prepareCopy: s.scout.revealed[0],
              top: s.scout.revealed.slice(1),
              bottom: [],
              discardPreparedCopy: null,
            }
        : q.kind === 'test'
          ? { kind: q.stage === 'ready' ? 'test-reveal' : 'test-resolve' }
          : { kind: 'ack' };
    const reply = await scenarioInput(r.host, actor, input);
    assert.equal(
      reply.status,
      200,
      (await reply.text()) + JSON.stringify({ n, q, input }) + r.host.diagnostics(),
    );
  }
  assert.equal((await readSession(r.host)).preparation.heroes[1].prepared.length, 2);
  let count = 0,
    origin;
  async function restore() {
    const before = await readBackup(r.host),
      view = await readSession(r.host);
    origin ??= before.payload.state.physical.cycle.seed;
    assert.deepEqual(before.payload.state.physical.cycle.seed, origin);
    await r.host.stop('SIGKILL');
    const dest = await startHost();
    t.after(() => dest.dispose());
    for (const name of [
      'scenario-pack',
      'physical-content',
      'physical-fronts',
      'physical-last-stand',
    ])
      await assert.rejects(access(join(dest.dataDir, name + '.json')));
    const empty = await readSession(dest);
    await ok(
      dest.request('/api/restores', {
        backup: before,
        generation: empty.generation,
        expectedRevision: empty.revision,
        confirmed: true,
      }),
    );
    const after = (await readBackup(dest)).payload;
    assert.deepEqual({ ...after, state: admin(after.state, before.payload.state) }, before.payload);
    assert.deepEqual(admin(await readSession(dest), view), view);
    await recoverSeat(dest, r.player);
    await recoverSeat(dest, r.other);
    r.host = dest;
    count++;
  }
  await ok(cycleCommand(r, 'START_TURN'));
  await restore();
  await ok(commitLinked(r));
  await restore();
  await finishPhysical(r);
  await ok(scenarioInput(r.host, r.player, { kind: 'choice', event: 'STUDY' }));
  await restore();
  await ok(scenarioInput(r.host, r.player, { kind: 'physical-choice', option: 'reveal' }));
  await restore();
  await ok(scenarioInput(r.host, r.player, { kind: 'physical-choice', option: 'resolve' }));
  await restore();
  await ok(scenarioInput(r.host, r.other, { kind: 'ack' }));
  await restore();
  await ok(scenarioInput(r.host, r.other, { kind: 'ack' }));
  await restore();
  await ok(cycleCommand(r, 'END_TURN'));
  await reachLinked(r);
  await ok(commitLinked(r, 1, r.other));
  await finishPhysical(r);
  await ok(scenarioInput(r.host, r.other, { kind: 'choice', event: 'CLIMB' }));
  await restore();
  await ok(scenarioInput(r.host, r.other, { kind: 'physical-choice', option: 'reveal' }));
  await restore();
  await ok(scenarioInput(r.host, r.other, { kind: 'physical-choice', option: 'resolve' }));
  let s = await readSession(r.host);
  assert.equal(s.scenario.play.tests[1].successes, 1);
  assert.equal(s.scenario.pending.kind, 'physical');
  await restore();
  s = await finishPhysical(r);
  assert.equal(
    (await readBackup(r.host)).payload.state.physical.snapshot.areas[1].damage.length,
    1,
  );
  assert.equal(linkedNode(s).variables.supplied, true);
  await restore();
  async function prepareRound() {
    await ok(cycleCommand(r, 'BEGIN_SHADOW'));
    await finishCycle(r);
    await ok(cycleCommand(r, 'CONFIRM_SHADOW_STEP', { step: 'threat' }));
    await finishCycle(r);
    for (const actor of [r.player, r.other]) {
      await ok(cycleCommand(r, 'START_RALLY_SCOUT', {}, actor));
      for (let n = 0; n < 50; n++) {
        const s = await readSession(r.host),
          q = s.physical.active;
        if (!q) break;
        if (q.mode === 'scout')
          await ok(
            answerCycle(r, {
              kind: 'physical-scout',
              prepare: q.options[0].id,
              discard: null,
              top: q.options.slice(1).map((o) => o.id),
              bottom: [],
            }),
          );
        else
          await ok(
            answerCycle(r, {
              kind: 'physical-choice',
              option:
                ['resolve', 'close', 'reveal'].find((id) => q.options.some((o) => o.id === id)) ??
                q.options[0].id,
            }),
          );
      }
    }
    await ok(cycleCommand(r, 'END_RALLY'));
  }
  await ok(cycleCommand(r, 'END_TURN', {}, r.other));
  await prepareRound();
  await endTurns(r);
  await prepareRound();
  assert.equal((await readSession(r.host)).preparation.heroes[1].prepared.length, 4);
  await ok(cycleCommand(r, 'START_TURN'));
  await ok(commitLinked(r, 0, r.player, 'DELIVER'));
  await finishPhysical(r);
  await restore();
  await ok(scenarioInput(r.host, r.other, { kind: 'ack' }));
  await restore();
  await ok(scenarioInput(r.host, r.player, { kind: 'choose-hero', heroId: 'hero-2' }));
  s = await readSession(r.host);
  assert.equal(s.physical.active.mode, 'select');
  assert.equal(s.physical.active.actorPlayerId, r.other.body.player.id);
  await restore();
  const copy = s.physical.lastStand.titles[0].copy;
  await ok(scenarioInput(r.host, r.other, { kind: 'physical-select', ids: [copy] }));
  await restore();
  assert.equal(count, 15);
  const final = await readBackup(r.host),
    state = final.payload.state;
  assert.equal(state.physical.snapshot.lastStand.titles[0].pending, false);
  assert.ok(state.preparation.heroes[1].discard.includes(copy));
  assert.ok(state.scenario.play.attempts.every((a) => a.returned));
  assert.ok(state.physical.snapshot.parents.every((p) => p.returnCount === 1));
  const edits = [
    (b) =>
      (b.payload.state.scenario.instances.find((i) => i.id === linkedNode(s).id).variables.seen =
        false),
    (b) =>
      (b.payload.state.scenario.instances.find(
        (i) => i.id === linkedNode(s).id,
      ).variables.supplied = false),
    (b) => b.payload.state.scenario.play.tests[1].successes++,
    (b) => (b.payload.state.scenario.play.attempts[2].entryChoice.event = 'LEAVE'),
    (b) => (b.payload.state.scenario.play.attempts[2].cost = 0),
    (b) => (b.payload.state.scenario.play.attempts[2].returned = false),
    (b) => (b.payload.state.physical.snapshot.lastStand.titles[0].heroId = 'hero-1'),
    (b) => (b.payload.state.physical.snapshot.lastStand.titles[0].copy = 'foreign-invented:1'),
    (b) =>
      (b.payload.state.physical.cycle.seed.scenario.instances.find(
        (i) => i.prefab === state.scenario.pack.manifest.linked.encounters[0].prefab,
      ).variables.supplied = true),
    (b) => b.payload.state.scenario.pack.manifest.linked.title.titleModel.modelId++,
    (b) => (b.payload.commands.at(-1).receipt.source = 'f'.repeat(64)),
  ];
  for (const edit of edits) {
    const bad = structuredClone(final);
    edit(bad);
    signBackup(bad);
    assert.equal(BackupSchema.safeParse(bad).success, false);
  }
  const bad = structuredClone(final);
  edits[6](bad);
  signBackup(bad);
  s = await readSession(r.host);
  assert.equal(
    (
      await r.host.request('/api/restores', {
        backup: bad,
        generation: s.generation,
        expectedRevision: s.revision,
        confirmed: true,
      })
    ).status,
    422,
  );
  assert.deepEqual((await readBackup(r.host)).payload, final.payload);
});
