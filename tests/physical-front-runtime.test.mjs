import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  compilePhysicalFronts,
  freezePhysical,
  openPhysical,
  answerPhysical,
  validatePhysical,
  physicalView,
} from '../dist/physical-resolution-library.mjs';
import { frontFixture, binding, evidence, hash } from './fixtures/physical-fronts.mjs';
import { source, suffer } from './fixtures/physical-resolution.mjs';
function fresh(edit = () => {}) {
  const f = frontFixture();
  edit(f);
  const artifact = compilePhysicalFronts(f.raw, f.ir, f.catalog);
  const p = freezePhysical(f.raw, binding, f.heroes, '1'.repeat(64), undefined, {
    artifact,
    catalog: f.catalog,
  });
  return { ...f, p };
}
test('faceup front resolves its entire nested fear before next damage and preserves replay and privacy', () => {
  const f = fresh(({ ir }) => {
    for (const d of ir.definitions.filter((d) => d.cardId.includes('damage')))
      d.body = [
        { op: 'suffer', hero: 'self', family: 'fear', n: 1, face: 'down' },
        { op: 'self-flip-down' },
      ];
  });
  const id = openPhysical(
    f.p,
    source,
    f.program([{ ...suffer(0, 2, 0), face: 'faceup' }]),
    f.context,
  );
  assert.equal(f.p.version, 2);
  assert.equal(f.p.snapshot.parents[0].status, 'completed');
  assert.equal(f.p.snapshot.areas[0].damage.length, 2);
  assert.equal(f.p.snapshot.areas[0].fear.length, 2);
  assert.deepEqual(f.p.snapshot.resolution.faceup, []);
  assert.deepEqual(f.p.snapshot.resolution.frames, []);
  assert.equal(f.p.snapshot.parents[0].returnCount, 1);
  assert.doesNotThrow(() => validatePhysical(JSON.parse(JSON.stringify(f.p))));
  const view = JSON.stringify(physicalView(f.p));
  assert.ok(!view.includes('invented-damage-'));
  assert.ok(!view.includes('invented-fear-'));
  assert.ok(!view.includes('entropy'));
  assert.ok(id);
});
test('alternative suspends with current front and real prepared cost before resuming the remaining source', () => {
  const f = fresh(({ ir }) => {
    for (const d of ir.definitions.filter((d) => d.cardId.includes('damage')))
      d.body = [
        {
          op: 'choose-alternative',
          branches: [
            { op: 'discard-prepared', hero: 'self', n: 1 },
            { op: 'suffer', hero: 'self', family: 'fear', n: 1, face: 'down' },
          ],
        },
        { op: 'discard-self' },
      ];
  });
  const id = openPhysical(
    f.p,
    source,
    f.program([{ ...suffer(0, 2, 0), face: 'faceup' }]),
    f.context,
  );
  assert.equal(f.p.snapshot.active.mode, 'choose');
  assert.equal(f.p.snapshot.areas[0].damage.length, 1);
  assert.equal(f.p.snapshot.decks.damage.length, 27);
  const before = structuredClone(f.p);
  assert.throws(() =>
    answerPhysical(
      f.p,
      id,
      { kind: 'physical-choice', option: 'invented-wrong' },
      evidence(0, f.heroes[0].playerId),
    ),
  );
  assert.deepEqual(f.p, before);
  answerPhysical(
    f.p,
    id,
    { kind: 'physical-choice', option: '0' },
    evidence(1, f.heroes[0].playerId),
  );
  assert.equal(f.p.snapshot.resolution.resources.preparation.heroes[0].prepared.length, 0);
  assert.equal(f.p.snapshot.resolution.resources.preparation.heroes[0].discard.length, 1);
  // The second card has only the feasible suffering alternative, so no fake ACK.
  assert.equal(f.p.snapshot.parents[0].status, 'completed');
  assert.equal(f.p.snapshot.areas[0].fear.length, 1);
  assert.equal(f.p.snapshot.areas[0].damage.length, 0);
  assert.equal(f.p.snapshot.decks.damage.length, 28);
  const changed = structuredClone(f.p);
  changed.snapshot.resolution.resources.preparation.heroes[0].inspiration++;
  assert.throws(() => validatePhysical(changed));
});

test('real Guard uses the prepared owner in the same space and pays once without synthetic credits', () => {
  const f = fresh(({ ir, catalog }) => {
    const d = catalog.skills.find((c) => c.id === 'role-2-skill-1');
    ir.policies.push({
      id: d.id,
      kind: 'skill',
      definitionHash: hash(d),
      source: { sourceId: 'invented', locator: 'Policy!1' },
      effects: [{ op: 'guard', n: 2 }],
    });
  });
  const id = openPhysical(f.p, source, f.program([suffer(0, 3, 0)]), f.context);
  assert.equal(f.p.snapshot.active.mode, 'choose');
  const ability = f.p.snapshot.active.options.find((o) => o.id !== 'close').id;
  answerPhysical(
    f.p,
    id,
    { kind: 'physical-choice', option: ability },
    evidence(0, f.heroes[0].playerId),
  );
  assert.equal(f.p.snapshot.active.actorPlayerId, f.heroes[1].playerId);
  assert.equal(f.p.snapshot.resolution.resources.preparation.heroes[1].prepared.length, 1);
  const before = structuredClone(f.p);
  assert.throws(() =>
    answerPhysical(
      f.p,
      id,
      { kind: 'physical-allocate', ability, damage: 2, fear: 0 },
      evidence(1, f.heroes[0].playerId),
    ),
  );
  assert.deepEqual(f.p, before);
  answerPhysical(
    f.p,
    id,
    { kind: 'physical-allocate', ability, damage: 2, fear: 0 },
    evidence(2, f.heroes[1].playerId),
  );
  assert.equal(f.p.snapshot.resolution.resources.preparation.heroes[1].prepared.length, 0);
  assert.equal(f.p.snapshot.resolution.resources.preparation.heroes[1].discard.length, 1);
  assert.equal(f.p.snapshot.areas[0].damage.length, 1);
  assert.deepEqual(f.p.snapshot.credits, [0, 0, 0]);
  assert.doesNotThrow(() => validatePhysical(f.p));
});

test('source-granted negate test can suspend for a conversion Scout without recycling parent reveal', () => {
  const f = fresh(({ ir, catalog }) => {
    const d = catalog.skills.find((c) => c.id === 'role-1-skill-1');
    ir.policies.push({
      id: d.id,
      kind: 'skill',
      definitionHash: hash(d),
      source: { sourceId: 'invented', locator: 'Policy!2' },
      effects: [{ op: 'convert-all', noPrintedSuccess: false, scout: 2 }],
    });
  });
  const id = openPhysical(
    f.p,
    source,
    f.program([{ ...suffer(0, 2, 0), negate: 'spirit' }]),
    f.context,
  );
  assert.equal(f.p.snapshot.active.mode, 'choose');
  const parent = [...f.p.snapshot.resolution.revealed[0].cards];
  answerPhysical(
    f.p,
    id,
    { kind: 'physical-choice', option: 'role-1-skill-1:1' },
    evidence(0, f.heroes[0].playerId),
  );
  assert.equal(f.p.snapshot.active.mode, 'scout');
  const scout = f.p.snapshot.active.options.map((o) => o.id);
  assert.ok(scout.every((c) => !parent.includes(c)));
  assert.equal(f.p.snapshot.resolution.revealed.length, 2);
  answerPhysical(
    f.p,
    id,
    { kind: 'physical-scout', prepare: null, discard: null, top: scout, bottom: [] },
    evidence(1, f.heroes[0].playerId),
  );
  assert.equal(f.p.snapshot.active.mode, 'allocate');
  assert.equal(f.p.snapshot.active.maximum, 2);
  const before = structuredClone(f.p);
  assert.throws(() =>
    answerPhysical(
      f.p,
      id,
      { kind: 'physical-allocate', ability: null, damage: 2, fear: 1 },
      evidence(2, f.heroes[0].playerId),
    ),
  );
  assert.deepEqual(f.p, before);
  answerPhysical(
    f.p,
    id,
    { kind: 'physical-allocate', ability: null, damage: 1, fear: 0 },
    evidence(3, f.heroes[0].playerId),
  );
  assert.equal(f.p.snapshot.parents[0].status, 'completed');
  assert.equal(f.p.snapshot.areas[0].damage.length, 1);
  assert.deepEqual(f.p.snapshot.resolution.revealed, []);
  assert.deepEqual(f.p.snapshot.resolution.resources.preparation.heroes[0].discard, [
    'role-1-skill-1:1',
    ...parent,
  ]);
  assert.doesNotThrow(() => validatePhysical(JSON.parse(JSON.stringify(f.p))));
});

test('weakness supply is conserved and source events extinguish a faceup persistent modifier', () => {
  const f = fresh(({ ir }) => {
    for (const d of ir.definitions.filter((d) => d.cardId.includes('damage'))) {
      d.body = [
        { op: 'gain-weakness', hero: 'self', n: 1, destination: 'shuffle-into-current-skill-deck' },
        { op: 'keep-faceup' },
      ];
      d.persistent = [
        { op: 'stat-modifier', window: 'continuous', stats: 'all', n: -1 },
        { op: 'self-flip-down', window: 'end-own-turn' },
      ];
    }
  });
  openPhysical(
    f.p,
    source,
    f.program([
      { ...suffer(0, 1, 0), face: 'faceup' },
      { kind: 'event', hero: 0, event: 'end-own-turn', threat: false, sufferedFear: 0 },
    ]),
    f.context,
  );
  assert.equal(f.p.snapshot.parents[0].status, 'completed');
  assert.equal(f.p.snapshot.resolution.resources.preparation.weaknessDeck.length, 16);
  assert.equal(f.p.snapshot.resolution.resources.preparation.heroes[0].deck.length, 15);
  assert.deepEqual(f.p.snapshot.resolution.faceup, []);
  assert.doesNotThrow(() => validatePhysical(f.p));
});
