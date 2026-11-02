import assert from 'node:assert/strict';
import { test } from 'node:test';
import { placeMapEncounters as place } from '../dist/map-encounters-library.mjs';
import { comparisonSort, SourceRandom } from '../dist/map-primitives.mjs';
import { encountersFixture, addEncounter, addGroup, fixed } from './fixtures/map-encounters.mjs';
function noGroups(f) {
  f.assembly.selection.groups = [];
  f.assembly.selection.products[0].groupSources = [];
}
test('groups try the ordered candidates, retain the trie across required/optional/helpers and clean required placements', () => {
  const f = encountersFixture();
  noGroups(f);
  const r = addEncounter(f),
    a = addEncounter(f),
    c = addEncounter(f);
  const g1 = addGroup(f, {
    requiredSources: [r],
    optionalSources: [a, a],
    requiredOptionalCount: 2,
  });
  const g2 = addGroup(f, { requiredSources: [a], isRepeatable: true });
  const g3 = addGroup(f, { requiredSources: [c] });
  f.assembly.selection.context.usedGroupIds = [90002];
  const v = place(f);
  assert.equal(v.status, 'encounters-complete', JSON.stringify(v.failure));
  assert.deepEqual(v.search.eligibleGroups, [g1, g2, g3]);
  assert.equal(v.chosenGroup.source, g3);
  assert.deepEqual(
    v.assignments.map((a) => a.modelSource),
    [c],
  );
  const tries = v.trace.filter((e) => e.operation === 'group-attempt');
  assert.equal(tries.length, 3);
  assert.deepEqual(
    tries[1].invalidSequences.map((n) => n.value),
    [100001],
  );
  assert.ok(v.trace.some((e) => e.operation === 'group-cleanup' && e.modelSource === r));
  assert.equal(v.trace.filter((e) => e.operation === 'assign' && e.modelSource === a).length, 1);
  assert.equal(
    v.trace.filter(
      (e) => e.operation === 'clear-search' && e.stage.startsWith('group-') && e.clearInvalid,
    ).length,
    0,
  );
  assert.deepEqual(v.history.result.usedEncounterIds, [100002]);
});
test('group filter checks every optional member even if zero optional placements are requested', () => {
  const f = encountersFixture();
  noGroups(f);
  const good = addEncounter(f),
    bad = addEncounter(f, { traits: 2 });
  addGroup(f, { requiredSources: [good], optionalSources: [bad], requiredOptionalCount: 0 });
  f.assembly.selection.encounterTraitsFilter.mustHaveAll = 1;
  const v = place(f);
  assert.equal(v.status, 'source-failure');
  assert.equal(v.failure.reason, 'group-requirement');
  assert.deepEqual(v.search.eligibleGroups, []);
});
test('groups do not apply encounter language/history/repeatability filters or exclude campaign-used groups', () => {
  const f = encountersFixture();
  noGroups(f);
  const e = addEncounter(f, { unsupportedLanguages: ['Italian'], isRepeatable: false });
  const g = addGroup(f, { requiredSources: [e], isRepeatable: false });
  f.assembly.selection.context.usedEncounterIds = [100000];
  f.assembly.selection.context.usedGroupIds = [90000];
  const v = place(f);
  assert.equal(v.status, 'encounters-complete');
  assert.equal(v.chosenGroup.source, g);
  assert.deepEqual(v.history.result.usedEncounterIds, [100000]);
  assert.deepEqual(v.history.result.usedGroupIds, [90000]);
});
test('group shuffle uses the continued RNG and Comparison sort at sizes above the stable insertion path', () => {
  const f = encountersFixture();
  noGroups(f);
  for (let i = 0; i < 24; i++) addGroup(f, { isRepeatable: i % 3 === 0 });
  f.assembly.selection.context.usedGroupIds = [90001, 90007, 90010];
  const v = place(f),
    event = v.trace.find((e) => e.operation === 'group-sort');
  assert.ok(event);
  const rng = SourceRandom.restore(v.assembly.rng);
  for (let i = 0; i < 16; i++) rng.nextInt(0, 16);
  const expected = [...f.assembly.selection.groups];
  for (let i = 0; i < 24; i++) {
    const j = rng.nextInt(0, 24);
    [expected[i], expected[j]] = [expected[j], expected[i]];
  }
  assert.deepEqual(
    event.before,
    expected.map((g) => g.source),
  );
  comparisonSort(
    expected,
    (a, b) =>
      Number(v.history.incoming.usedGroupIds.includes(a.id)) -
        Number(v.history.incoming.usedGroupIds.includes(b.id)) ||
      Number(a.isRepeatable) - Number(b.isRepeatable),
  );
  assert.deepEqual(
    event.after,
    expected.map((g) => g.source),
  );
  assert.deepEqual(v.rng, rng.snapshot());
  assert.notDeepEqual(event.after, event.before);
});
test('specified group skips ownership/traits/candidate shuffle/sort but shuffles its required and optional copies', () => {
  const f = encountersFixture();
  noGroups(f);
  const a = addEncounter(f, { traits: 1 }),
    b = addEncounter(f, { traits: 1 });
  const g = addGroup(f, { requiredSources: [a], optionalSources: [b], requiredOptionalCount: 1 });
  f.assembly.selection.products[0].groupSources = [];
  f.assembly.selection.encounterTraitsFilter.mustHaveAll = 128;
  f.placement.specifiedGroupSource = g;
  const before = structuredClone(f),
    v = place(f);
  assert.equal(v.status, 'encounters-complete');
  assert.equal(v.chosenGroup.source, g);
  assert.ok(!v.trace.some((e) => e.operation === 'group-sort'));
  assert.deepEqual(
    v.trace.filter((e) => e.operation === 'shuffle').map((e) => e.site),
    ['all-spaces-shuffle', 'group-required-shuffle', 'group-optional-shuffle'],
  );
  assert.equal(v.rng.samples, v.assembly.rng.samples + 16 + 2);
  assert.deepEqual(f, before);
});
test('specified group capacity is a source failure before group placement, with no shuffle fallback', () => {
  const f = encountersFixture();
  for (let i = 0; i < 16; i++)
    fixed(f, Math.floor(i / 4), Math.floor(i / 2), addEncounter(f), i % 2);
  const e = addEncounter(f);
  const g = addGroup(f, { requiredSources: [e] });
  f.placement.specifiedGroupSource = g;
  const v = place(f);
  assert.equal(v.status, 'source-failure');
  assert.equal(v.failure.reason, 'specified-group-capacity');
  assert.equal(v.assignments.length, 16);
  assert.equal(v.rng.samples, v.assembly.rng.samples + 16);
});
test('required group failure rolls back its own placements and advances to the next group', () => {
  const f = encountersFixture();
  noGroups(f);
  const a = addEncounter(f),
    c = addEncounter(f);
  addGroup(f, { requiredSources: [a, a] });
  const g = addGroup(f, { requiredSources: [c], isRepeatable: true });
  const v = place(f);
  assert.equal(v.status, 'encounters-complete');
  assert.equal(v.chosenGroup.source, g);
  assert.deepEqual(
    v.assignments.map((a) => a.modelSource),
    [c],
  );
  assert.ok(v.trace.some((e) => e.operation === 'rollback' && e.encounterId === 100000));
});
test('item scans retained pool first-fit, max one, and adds no placement draw', () => {
  const f = encountersFixture();
  const a = addEncounter(f, { type: 4 }, { requiredTraits: 128 }),
    b = addEncounter(f, { type: 4 }),
    c = addEncounter(f, { type: 4 });
  f.assembly.selection.incoming.itemEncounterPool = [a, b, c];
  const v = place(f);
  assert.equal(v.status, 'encounters-complete');
  assert.equal(v.assignments.length, 1);
  const pool = v.retainedPools.itemEncounterPool;
  assert.equal(
    v.assignments[0].modelSource,
    pool.find((r) => r !== a),
  );
  assert.equal(v.assignments[0].spaceId, v.allSpaces[0]);
  assert.equal(v.assignments[0].origin.stage, 'item');
  assert.equal(v.rng.samples, v.assembly.rng.samples + 16 + 1);
});
test('item source has no global duplicate guard, while used encounter history adds uniquely', () => {
  const f = encountersFixture();
  const e = addEncounter(f, { type: 4, isRepeatable: true });
  fixed(f, 0, 0, e);
  f.assembly.selection.incoming.itemEncounterPool = [e];
  const v = place(f);
  assert.equal(v.status, 'encounters-complete');
  assert.equal(v.assignments.length, 2);
  assert.ok(v.assignments.every((a) => a.encounterId === 100000));
  assert.deepEqual(v.history.result.usedEncounterIds, [100000]);
});
test('item exhaustion is best effort and does not emit a source failure', () => {
  const f = encountersFixture();
  const e = addEncounter(f, { type: 4 }, { requiredTraits: 128 });
  f.assembly.selection.incoming.itemEncounterPool = [e];
  const v = place(f);
  assert.equal(v.status, 'encounters-complete');
  assert.equal(v.assignments.length, 0);
});
test('normal fill uses inclusive fractional float32 targets and one retained array without appending history', () => {
  const f = encountersFixture();
  fixed(f, 0, 0, addEncounter(f));
  const a = addEncounter(f),
    b = addEncounter(f);
  f.assembly.selection.incoming.randomEncounterPool = [a, b];
  f.placement.sections.forEach((s) => (s.randomFillPercent = Math.fround(0.26)));
  const v = place(f);
  assert.equal(v.status, 'encounters-complete');
  assert.deepEqual(
    [0, 1, 2, 3].map(
      (id) =>
        v.assignments.filter((a) => v.spaces.find((s) => s.id === a.spaceId).sectionId === id)
          .length,
    ),
    [2, 1, 0, 0],
  );
  assert.deepEqual(v.search.history, []);
  assert.deepEqual(v.search.sequence, []);
  assert.equal(
    v.trace.filter((e) => e.operation === 'search-append' && e.stage === 'normal-fill').length,
    0,
  );
  assert.equal(v.rng.samples, v.assembly.rng.samples + 16 + 1 + 2);
  assert.ok(
    v.trace
      .filter((e) => e.operation === 'fill-section')
      .every((e) => e.threshold === Math.fround(Math.fround(0.26) * 4)),
  );
});
