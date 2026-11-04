import test from 'node:test';
import assert from 'node:assert/strict';
import { readyThreats, drainThreats, endTurns } from './threat-helper.mjs';
import { cycleCommand } from './physical-cycle-helper.mjs';
import { readBackup } from './skill-test-helper.mjs';

for (const all of [false, true])
  test(
    all
      ? 'all heroes lost inside the new physical parent take immediate priority over threat and preserve the suspended source'
      : 'a hero lost during the new suffering returns its parent before the later threat conclusion',
    async (t) => {
      const r = await readyThreats(t, {
        catalogEdit(c) {
          for (const s of c.skills) {
            s.success = 0;
            s.fate = 0;
          }
          c.heroes[0].stats.fear = 1;
          if (all) c.heroes[1].stats.fear = 1;
        },
      });
      await endTurns(r);
      for (const [type, fields] of [
        ['BEGIN_SHADOW', {}],
        ['CONFIRM_SHADOW_STEP', { step: 'threat' }],
      ]) {
        const response = await cycleCommand(r, type, fields);
        assert.equal(response.status, 200, await response.text());
      }
      const s = await drainThreats(r),
        raw = (await readBackup(r.host)).payload.state;
      const frame = s.scenario.rounds.frames.at(-1),
        first = s.scenario.pack.manifest.threatContinuations.thresholds[0];
      assert.ok(raw.physical.snapshot.lastStand.lossDue);
      if (all) {
        assert.equal(s.scenario.conclusion.timing, 'no-active-heroes');
        assert.equal('kind' in s.scenario.conclusion.cause, false);
        assert.equal(frame.threshold, first.source);
        assert.deepEqual(frame.handled, ['example.assets:999', 'example.assets:1000']);
        assert.equal(s.scenario.conclusion.suspendedRequest.kind, 'physical');
        assert.ok(raw.scenario.tasks.some((t) => t.kind === 'spawnRandom' && t.parentId));
        assert.equal(
          raw.scenario.enemies.attempts.length,
          2,
          'the interrupted source did not return to its spawn',
        );
      } else {
        assert.equal(s.scenario.conclusion.timing, 'threat-increase');
        assert.equal(s.scenario.conclusion.cause.kind, 'threat');
        const parents = raw.physical.snapshot.parents.filter((p) =>
          p.results?.some((r) => r.kind === 'group-suffer'),
        );
        assert.equal(parents.length, 1);
        assert.equal(parents[0].returnCount, 1);
        assert.equal(parents[0].status, 'completed');
        assert.equal(frame.handled.length, 5);
        assert.equal(raw.scenario.tasks.length, 0);
      }
    },
  );
