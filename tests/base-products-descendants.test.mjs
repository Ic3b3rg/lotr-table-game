import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { buildSync } from 'esbuild';
import { baseRuntime } from './base-products-runtime-helper.mjs';
import { openPhysical, answerPhysical } from '../dist/physical-resolution-library.mjs';
import { evidence, hash } from './fixtures/physical-fronts.mjs';

const built = buildSync({
  stdin: {
    contents:
      "export {finishDefeatedSprint} from './src/scenario/runtime'; export {syncPhysicalDefeat} from './src/server/physical-defeat';",
    resolveDir: process.cwd(),
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
});
const driver = await import(
  'data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].contents).toString('base64')
);

test('a real P1/P2 descendant removes the sprint actor: survivors receive its cleanup, zero survivors retain the suspended source', () => {
  for (const victims of [[0], [0, 1, 2]]) {
    const f = baseRuntime({
      edit: (raw) => {
        for (const h of raw.catalog.heroes) h.stats.fear = 1;
      },
    });
    f.commit();
    f.finishPhysical();
    assert.equal(f.sc.pending.kind, 'sprint');
    const result = structuredClone(f.sc.play.tests),
      before = f.state.preparation.heroes.length;
    let revision = 1000;
    for (const hero of victims) {
      openPhysical(
        f.physical,
        {
          effectId: `invented-provocation-${hero}`,
          instanceId: 'invented-enemy',
          state: 0,
          entry: 1,
          action: 0,
          parameterHash: hash(hero),
        },
        {
          profile: 'source-fronts-v1',
          initialCredits: f.heroes.map(() => 0),
          limits: f.heroes.map(() => ({
            kind: 'requires-capability',
            capability: 'source-derived',
          })),
          darknessHeroes: [],
          children: [
            {
              kind: 'suffer',
              hero,
              face: 'faceup',
              cards: [{ family: 'fear', amount: 1 }],
              prevention: [],
            },
          ],
        },
        structuredClone(f.physical.snapshot.resolution.resources),
        { heroes: f.heroes, connections: f.state.journey.definition.connections },
        randomUUID(),
      );
      for (let n = 0; f.physical.snapshot.active && n < 80; n++) {
        const q = f.physical.snapshot.active;
        if (q.kind === 'gate') {
          assert.deepEqual(victims, [0, 1, 2]);
          assert.equal(hero, 2);
          assert.equal(q.reason, 'adventure-loss-consumer-unavailable');
          assert.equal(f.physical.snapshot.lastStand.terminal.timing, 'no-active-heroes');
          assert.ok(f.physical.snapshot.lastStand.heroes.every((h) => h.defeated));
          break;
        }
        assert.equal(
          q.kind,
          'decision',
          JSON.stringify({
            victims,
            hero,
            active: q,
            terminal: f.physical.snapshot.lastStand.terminal,
          }),
        );
        const option =
          ['force-fail', 'resolve', 'reveal', 'close'].find((id) =>
            q.options.some((o) => o.id === id),
          ) ?? q.options[0].id;
        answerPhysical(
          f.physical,
          q.runId,
          { kind: 'physical-choice', option },
          evidence(++revision, q.actorPlayerId),
        );
      }
      assert.equal(f.physical.snapshot.lastStand.heroes[hero].defeated, true);
    }
    f.state.preparation = structuredClone(f.physical.snapshot.resolution.resources.preparation);
    driver.syncPhysicalDefeat(f.state);
    assert.deepEqual(f.sc.play.tests, result);
    assert.equal(f.sc.globals.inventedChain, 7);
    assert.equal(f.state.preparation.heroes.length, before);
    assert.equal(f.sc.globals.inventedPartySize, 3);
    assert.equal(f.state.journey.heroes[0].removed, true);
    if (victims.length === 1) {
      driver.finishDefeatedSprint(f.state, f.heroes[0].heroId);
      assert.equal(f.i.stopped, true);
      assert.equal(f.sc.pending, null);
      assert.equal(f.sc.play.active, null);
      assert.equal(f.sc.play.attempts[0].returned, true);
      assert.equal(f.sc.conclusion, undefined, 'no new deferred-loss polling');
    } else {
      const saved = structuredClone(f.state);
      assert.throws(
        () => driver.finishDefeatedSprint(f.state, f.heroes[0].heroId),
        /superstit|terminal|sconfitt|callback/i,
      );
      assert.deepEqual(f.state, saved);
      assert.equal(f.sc.play.attempts[0].returned, false);
      assert.equal(f.i.stopped, false);
      assert.equal(f.sc.pending.kind, 'sprint');
    }
  }
});
