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
import { frontFixture, binding, evidence } from './fixtures/physical-fronts.mjs';
import { source, suffer } from './fixtures/physical-resolution.mjs';
import { startupMaterial } from './startup-preparation-helper.mjs';

test('prospective startup preparation keeps effect order and its trigger after discarding the new fifth prepared copy', () => {
  const f = frontFixture(),
    m = startupMaterial(f.catalog);
  // Reversing the policies in this invented fixture makes the order observable.
  for (const p of m.input.policies)
    p.effects = [
      { op: 'after-prepare-inspiration' },
      { op: 'after-prepare-flip-fear' },
      { op: 'after-prepare-inspiration' },
    ];
  const artifact = compilePhysicalFronts(m.raw, m.input, f.catalog);
  const p = freezePhysical(m.raw, binding, f.heroes, '2'.repeat(64), undefined, {
    artifact,
    catalog: f.catalog,
  });
  const hero = f.context.preparation.heroes[0];
  hero.inspiration = 2;
  hero.prepared.push(...hero.deck.splice(0, 3));
  const scoutCopy = hero.deck[0];
  const pr = {
    ...f.program([
      { ...suffer(0, 0, 3), face: 'faceup' },
      { kind: 'startup-scout', hero: 0 },
    ]),
    startupRules: 'source-startup-preparation-v1',
  };
  const id = openPhysical(p, source, pr, f.context);
  const answer = (input, n) => answerPhysical(p, id, input, evidence(n, f.heroes[0].playerId));
  answer({ kind: 'physical-choice', option: 'reveal' }, 0);
  const cards = p.snapshot.active.options.map((o) => o.id);
  assert.equal(cards[0], scoutCopy);
  answer(
    {
      kind: 'physical-scout',
      prepare: scoutCopy,
      discard: scoutCopy,
      top: cards.slice(1),
      bottom: [],
    },
    1,
  );
  assert.equal(p.snapshot.active.mode, 'select');
  assert.equal(p.snapshot.resolution.resources.preparation.heroes[0].inspiration, 3);
  assert.equal(p.snapshot.resolution.resources.preparation.heroes[0].prepared.length, 4);
  assert.ok(p.snapshot.resolution.resources.preparation.heroes[0].discard.includes(scoutCopy));
  const token = p.snapshot.active.options[1].id;
  const before = structuredClone(p);
  assert.throws(() => answer({ kind: 'physical-select', ids: [] }, 2));
  assert.deepEqual(p, before);
  answer({ kind: 'physical-select', ids: [token] }, 3);
  assert.equal(p.snapshot.resolution.resources.preparation.heroes[0].inspiration, 4);
  assert.equal(p.snapshot.resolution.faceup.length, 2);
  assert.equal(p.snapshot.parents[0].returnCount, 1);
  assert.deepEqual(p.snapshot.parents[0].results[1].setup.revealed, cards);
  assert.equal(p.snapshot.resolution.resources.preparation.heroes[0].deck[0], cards[1]);
  assert.doesNotThrow(() => validatePhysical(p));
  assert.ok(!JSON.stringify(physicalView(p)).includes('invented-fear-'));
});

test('new startup children cannot execute under the historical physical program contract', () => {
  const f = frontFixture(),
    m = startupMaterial(f.catalog);
  const p = freezePhysical(m.raw, binding, f.heroes, '2'.repeat(64), undefined, {
    artifact: m.fronts,
    catalog: f.catalog,
  });
  const before = structuredClone(p);
  assert.throws(() =>
    openPhysical(
      p,
      source,
      f.program([{ kind: 'prepared', hero: 0, copy: f.context.preparation.heroes[0].prepared[0] }]),
      f.context,
    ),
  );
  assert.deepEqual(p, before);
});
