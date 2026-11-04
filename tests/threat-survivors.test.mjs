import test from 'node:test';
import assert from 'node:assert/strict';
import * as physical from '../dist/physical-resolution-library.mjs';
import { lastStandFixture } from './fixtures/last-stand.mjs';
import { binding, evidence } from './fixtures/physical-fronts.mjs';
import { source, suffer } from './fixtures/physical-resolution.mjs';

test('new collective suffering resolves every survivor with a live actor and excludes an already defeated recipient', () => {
  for (const defeated of [0, 1]) {
    const f = lastStandFixture();
    f.catalog.heroes[defeated].stats.fear = 1;
    for (const d of f.ir.definitions) d.body = [{ op: 'keep-faceup' }];
    const p = physical.freezePhysical(
      f.raw,
      binding,
      f.heroes,
      '1'.repeat(64),
      undefined,
      { artifact: physical.compilePhysicalFronts(f.raw, f.ir, f.catalog), catalog: f.catalog },
      physical.compileLastStand(f.raw, f.lastStandInput),
    );
    p.version = 3;
    const spatial = { heroes: f.heroes, connections: [] };
    physical.openPhysical(
      p,
      { ...source, effectId: 'invented-prior-defeat' },
      f.program([{ ...suffer(defeated, 0, 1), face: 'faceup' }]),
      f.context,
      spatial,
    );
    let revision = 0;
    for (const option of ['reveal', 'resolve']) {
      const q = p.snapshot.active;
      physical.answerPhysical(
        p,
        q.runId,
        { kind: 'physical-choice', option },
        evidence(revision++, q.actorPlayerId),
      );
    }
    assert.equal(p.snapshot.lastStand.heroes[defeated].defeated, true);
    physical.openPhysical(
      p,
      { ...source, effectId: 'invented-next-collective-consequence' },
      f.program([
        {
          kind: 'group-suffer',
          hero: 0,
          heroes: [0, 1, 2],
          family: 'fear',
          amount: 2,
          face: 'facedown',
          negate: 'wisdom',
        },
      ]),
      structuredClone(p.snapshot.resolution.resources),
      spatial,
    );
    assert.ok(p.snapshot.active, 'survivors still owe their source consequence');
    const allocated = [];
    for (let n = 0; p.snapshot.active && n < 50; n++) {
      const q = p.snapshot.active;
      assert.equal(q.kind, 'decision');
      assert.notEqual(q.actorHeroId, f.heroes[defeated].heroId);
      let input;
      if (q.mode === 'allocate') {
        allocated.push(q.actorHeroId);
        input = { kind: 'physical-allocate', ability: null, damage: 0, fear: 1 };
      } else {
        if (q.options.some((o) => /^[012]$/.test(o.id)))
          assert.ok(q.options.every((o) => o.id !== String(defeated)));
        const option =
          ['resolve', 'reveal', 'close'].find((id) => q.options.some((o) => o.id === id)) ??
          q.options.at(-1).id;
        input = { kind: 'physical-choice', option };
      }
      physical.answerPhysical(p, q.runId, input, evidence(revision++, q.actorPlayerId));
    }
    assert.equal(p.snapshot.active, null);
    assert.deepEqual(
      allocated.sort(),
      f.heroes
        .filter((_, n) => n !== defeated)
        .map((h) => h.heroId)
        .sort(),
    );
    assert.deepEqual(
      p.snapshot.areas.map((a) => a.fear.length),
      [1, 1, 1],
    );
    assert.equal(p.snapshot.parents.at(-1).status, 'completed');
    assert.equal(p.snapshot.parents.at(-1).returnCount, 1);
    physical.validatePhysical(structuredClone(p));
  }
});
