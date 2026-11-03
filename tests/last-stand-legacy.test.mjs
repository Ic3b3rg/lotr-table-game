import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as current from '../dist/physical-resolution-library.mjs';
import { historicalPhysical } from './last-stand-helper.mjs';
import { frontFixture, binding, evidence, hash } from './fixtures/physical-fronts.mjs';
import { source, suffer } from './fixtures/physical-resolution.mjs';
import { inventedLastStand } from './fixtures/last-stand.mjs';

test('released main actually produces the historical gate and finished paid-effect states accepted by P2', async () => {
  const old = await historicalPhysical();
  for (const spatial of [false, true])
    for (const pending of [false, true]) {
      const f = frontFixture(),
        d = f.catalog.skills.find((s) => s.id === 'role-1-skill-1');
      f.ir.policies.push({
        id: d.id,
        kind: 'skill',
        definitionHash: hash(d),
        source: { sourceId: 'invented', locator: 'Compatibility!paid' },
        effects: [{ op: 'guard', n: 1 }, { op: 'after-guard-inspiration' }],
      });
      const p = old.freezePhysical(f.raw, binding, f.heroes, '1'.repeat(64), undefined, {
        artifact: old.compilePhysicalFronts(f.raw, f.ir, f.catalog),
        catalog: f.catalog,
      });
      if (spatial) p.version = 3;
      const id = old.openPhysical(
        p,
        source,
        f.program([suffer(0, pending ? 6 : 1, 0)]),
        f.context,
        spatial ? { heroes: f.heroes, connections: [] } : undefined,
      );
      const offer = p.snapshot.active.options.find((o) => o.id.includes(d.id)).id;
      old.answerPhysical(
        p,
        id,
        { kind: 'physical-choice', option: offer },
        evidence(0, f.heroes[0].playerId),
      );
      old.answerPhysical(
        p,
        id,
        { kind: 'physical-allocate', ability: offer, damage: 1, fear: 0 },
        evidence(1, f.heroes[0].playerId),
      );
      old.validatePhysical(p);
      if (pending) assert.equal(p.snapshot.active.reason, 'last-stand-unavailable');
      else assert.equal(p.snapshot.parents[0].returnCount, 1);
      assert.equal(p.snapshot.resolution.resources.preparation.heroes[0].inspiration, 3);
      const saved = JSON.parse(JSON.stringify(p));
      current.validatePhysical(saved);
      assert.deepEqual(saved, p);
      if (pending) {
        const prefix = structuredClone(saved.snapshot);
        current.answerPhysical(
          saved,
          id,
          { kind: 'physical-continue-last-stand', rules: 'source-last-stand-v1' },
          evidence(2, f.heroes[0].playerId),
          current.compileLastStand(f.raw, inventedLastStand(f.raw)),
        );
        assert.equal(saved.snapshot.active.kind, 'decision');
        for (const key of ['decks', 'areas', 'random', 'rngCursor'])
          assert.deepEqual(saved.snapshot[key], prefix[key]);
        assert.deepEqual(saved.snapshot.resolution.resources, prefix.resolution.resources);
        assert.equal(saved.snapshot.lastStand.selections.length, 1);
        current.validatePhysical(saved);
      }
    }
});
