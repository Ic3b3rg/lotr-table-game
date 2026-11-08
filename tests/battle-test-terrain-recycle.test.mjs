import test from 'node:test';
import assert from 'node:assert/strict';
import { runtimeBoons, boonGrant } from './fixtures/boons.mjs';
import { hash } from './fixtures/physical-fronts.mjs';
import { terrainPolicy } from './fixtures/battle-test-terrain.mjs';
import { attackChild } from './fixtures/battle-test-terrain-physical.mjs';
import { validatePhysical } from '../dist/physical-resolution-library.mjs';

test('fire exclusion follows its exact copy through a legal reset/scout/exchange during the same attack', () => {
  const f = runtimeBoons((f) => {
    // Reuse the declared verified invented reserve 2/4/9; original #57 stays unknown.
    for (const c of f.catalog.skills) {
      c.success = 1;
      c.fate = 1;
    }
    f.catalog.heroes[0].stats.might = f.context.preparation.heroes[0].deck.length;
    const prepared = f.catalog.skills.find((c) => c.id === 'role-1-skill-1');
    f.ir.policies.push({
      id: prepared.id,
      kind: 'skill',
      definitionHash: hash(prepared),
      source: { sourceId: 'invented', locator: 'Invented!convert-and-scout' },
      effects: [{ op: 'convert-all', noPrintedSuccess: false, scout: 2 }],
    });
  });
  f.p.version = 3;
  const spatial = {
    heroes: f.heroes,
    connections: [],
    testTerrain: {
      policy: terrainPolicy(),
      capabilityFingerprint: hash('invented'),
      boardFingerprint: hash('invented board'),
      tokens: [{ anchor: 'invented-fire', kind: 'fire', spaceId: f.heroes[0].spaceId }],
    },
  };
  f.open([boonGrant(0, 'determined'), attackChild], spatial);
  const initial = f.p.snapshot.resolution.sourceTest.cards.length,
    rawPaid = f.p.snapshot.resolution.revealed[0].cards[0],
    publicPaid = f.p.snapshot.resolution.sourceTest.cards[0].copy;
  f.answer(`terrain:fire:${publicPaid}:pierce`);
  f.answer('role-1-skill-1:1');
  assert.equal(f.p.snapshot.active.mode, 'scout');
  assert.deepEqual(
    new Set(f.p.snapshot.active.options.map((o) => o.id)),
    new Set([rawPaid, 'role-1-skill-1:1']),
    'Both finite discarded copies are revealed; no hidden-order selection',
  );
  f.answer({
    kind: 'physical-scout',
    prepare: null,
    discard: null,
    top: [rawPaid],
    bottom: ['role-1-skill-1:1'],
  });
  const exchange = f.p.snapshot.active.options.find((o) => o.id.includes('exchange-test-cards'));
  f.answer(exchange.id);
  const exchanged = f.p.snapshot.active.options[0].id;
  f.answer({ kind: 'physical-select', ids: [exchanged] });
  const view = f.p.snapshot.resolution.sourceTest;
  // The surviving initial-2 copies each retain one printed and one converted
  // success. The paid fire copy, legally redrawn, contributes zero of either icon.
  assert.equal(view.successes, (initial - 2) * 2);
  assert.equal(view.fateRemaining, 0);
  assert.ok(f.p.snapshot.resolution.revealed[0].cards.includes(rawPaid));
  assert.equal(view.cards.find((c) => c.copy === publicPaid).excluded, true);
  f.answer('resolve');
  f.answer('apply');
  assert.equal(f.p.snapshot.parents[0].returnCount, 1);
  assert.doesNotThrow(() => validatePhysical(JSON.parse(JSON.stringify(f.p))));
});
