import assert from 'node:assert/strict';
import { test } from 'node:test';
import { placeMapEncounters as place } from '../dist/map-encounters-library.mjs';
import { encountersFixture, addEncounter, fixed, synchronize } from './fixtures/map-encounters.mjs';
function section(f, ids, index = 0) {
  f.placement.sections[index].sectionEncounterSources = ids;
  synchronize(f);
}
test('section requirements use full IDs, exact TileModel identity and space index instead of traits when specific', () => {
  const f = encountersFixture(),
    tile = f.assembly.selection.standard[0];
  const e = addEncounter(
    f,
    {},
    {
      specificTileModelSource: tile.modelSource,
      specificSpaceIndex: 1,
      requiredTraits: 128,
      excludedTraits: 1,
    },
  );
  section(f, [e]);
  const v = place(f);
  assert.equal(v.status, 'encounters-complete', JSON.stringify(v.failure));
  const a = v.assignments[0],
    sp = v.spaces.find((s) => s.id === a.spaceId);
  assert.equal(sp.tileSource, tile.source);
  assert.equal(sp.index, 1);
  assert.equal(a.encounterId, 100000);
  assert.equal(a.origin.stage, 'required-section');
  assert.ok(v.trace.some((e) => e.operation === 'search-append' && e.encounterId === 100000));
});
test('section trait matching requires all and excludes any, while fixed bypasses language/history/traits', () => {
  const f = encountersFixture();
  const fixedId = addEncounter(
    f,
    { unsupportedLanguages: ['Italian'], isRepeatable: false },
    { requiredTraits: 128, excludedTraits: 1 },
  );
  f.assembly.selection.context.usedEncounterIds = [100000];
  fixed(f, 0, 0, fixedId);
  const e = addEncounter(f, {}, { requiredTraits: 3 });
  section(f, [e]);
  const v = place(f);
  assert.equal(v.status, 'source-failure');
  assert.equal(v.failure.reason, 'section-requirement');
  assert.equal(v.assignments.length, 1);
  assert.equal(v.assignments[0].encounterId, 100000);
  f.assembly.geometry.tiles[1].spaces[1].traits = 3;
  f.assembly.selection.standard[1].spaces[1].traits = 3;
  assert.equal(place(f).status, 'encounters-complete');
  f.placement.models[1].excludedTraits = 2;
  assert.equal(place(f).status, 'source-failure');
});
test('section rollback prunes the tried ID sequence without narrowing IDs or rewinding RNG', () => {
  const f = encountersFixture(),
    tile = f.assembly.selection.standard[0];
  const a = addEncounter(
    f,
    {},
    { specificTileModelSource: tile.modelSource, specificSpaceIndex: 0 },
  );
  const b = addEncounter(
    f,
    {},
    { specificTileModelSource: tile.modelSource, specificSpaceIndex: 0 },
  );
  section(f, [a, b]);
  const v = place(f),
    rb = v.trace.filter((e) => e.operation === 'rollback');
  assert.equal(v.status, 'source-failure');
  assert.equal(v.failure.reason, 'section-requirement');
  assert.deepEqual(
    rb.map((e) => e.encounterId),
    [100000, 100001],
  );
  assert.equal(v.rng.samples, v.assembly.rng.samples + 16 + 2);
  assert.deepEqual(v.search.sequence, []);
  assert.deepEqual(v.search.history, []);
  assert.deepEqual(
    v.search.invalidSequences.map((n) => n.value),
    [100000, 100001],
  );
  assert.equal(v.assignments.length, 0);
});
test('section cannot satisfy its local requirement with the same ID placed in another section', () => {
  const f = encountersFixture(),
    e = addEncounter(f);
  fixed(f, 1, 2, e);
  section(f, [e]);
  const v = place(f);
  assert.equal(v.status, 'source-failure');
  assert.equal(v.failure.reason, 'section-requirement');
  assert.equal(v.assignments.length, 1);
});
test('Threat2 draws uniformly from only the source-graph minimum adjacency prefix after Comparison sort', () => {
  const f = encountersFixture();
  const a = addEncounter(f, {}, { nodeType: 2 });
  fixed(f, 0, 0, a);
  const b = addEncounter(f, {}, { nodeType: 2 });
  section(f, [b]);
  const v = place(f);
  assert.equal(v.status, 'encounters-complete');
  const choice = v.trace.find((e) => e.operation === 'eligible-spaces' && e.modelSource === b);
  assert.ok(choice);
  assert.equal(choice.minimumAdjacent, Math.min(...choice.adjacentThreatCounts));
  const minimum = choice.adjacentThreatCounts.filter((n) => n === choice.minimumAdjacent).length;
  assert.equal(minimum, 2);
  assert.equal(choice.eligibleSpaces.length, 3);
  assert.equal(choice.prefixCount, minimum);
  const draw = v.trace.find((e) => e.operation === 'draw' && e.site === 'section-space');
  assert.equal(draw.max, minimum);
  assert.equal(
    v.assignments.find((a) => a.modelSource === b).spaceId,
    choice.eligibleSpaces[draw.value],
  );
  for (let i = 0; i < choice.eligibleSpaces.length; i++) {
    const space = v.spaces.find((s) => s.id === choice.eligibleSpaces[i]);
    assert.equal(
      choice.adjacentThreatCounts[i],
      space.connected.filter((id) =>
        v.assignments.some((a) => a.spaceId === id && a.encounterId === 100000),
      ).length,
    );
  }
});
test('section backtracking can succeed with a different ID order and the advanced random stream', () => {
  const f = encountersFixture();
  for (let i = 0; i < 2; i++) {
    f.assembly.selection.standard[1].spaces[i].traits = 2;
    f.assembly.geometry.tiles[1].spaces[i].traits = 2;
  }
  const a = addEncounter(f, {}, { requiredTraits: 1 }),
    b = addEncounter(
      f,
      {},
      {
        specificTileModelSource: f.assembly.selection.standard[0].modelSource,
        specificSpaceIndex: 0,
      },
    );
  section(f, [a, b]);
  const v = place(f);
  assert.equal(v.status, 'encounters-complete');
  assert.deepEqual(
    v.trace.filter((e) => e.operation === 'assign').map((e) => e.encounterId),
    [100000, 100001, 100000],
  );
  assert.equal(v.trace.filter((e) => e.operation === 'rollback').length, 1);
  assert.equal(v.rng.samples, v.assembly.rng.samples + 16 + 3 + 1);
});
test('adventure first fit rolls back the first failing model, then tries a different ID order with the same shuffled spaces', () => {
  const f = encountersFixture(),
    initial = place(f),
    first = initial.spaces.find((s) => s.id === initial.allSpaces[0]);
  const tile = f.assembly.geometry.tiles.find((t) => t.source === first.tileSource);
  const a = addEncounter(f),
    b = addEncounter(
      f,
      {},
      { specificTileModelSource: tile.modelSource, specificSpaceIndex: first.index },
    );
  f.placement.adventureEncounterSources = [a, b];
  synchronize(f);
  const v = place(f);
  assert.equal(v.status, 'encounters-complete', JSON.stringify(v.failure));
  assert.deepEqual(
    v.trace.filter((e) => e.operation === 'assign').map((e) => e.encounterId),
    [100000, 100001, 100000],
  );
  assert.deepEqual(
    v.trace.filter((e) => e.operation === 'rollback').map((e) => e.encounterId),
    [100000],
  );
  assert.equal(v.assignments.find((a) => a.modelSource === b).spaceId, first.id);
  assert.equal(v.rng.samples, v.assembly.rng.samples + 16 + 1);
});
test('adventure first-model failure does not scan a later fitting encounter in the same iteration', () => {
  const f = encountersFixture(),
    a = addEncounter(f, {}, { requiredTraits: 128 }),
    b = addEncounter(f);
  f.placement.adventureEncounterSources = [a, b];
  synchronize(f);
  const v = place(f);
  assert.equal(v.status, 'source-failure');
  assert.equal(v.failure.reason, 'adventure-requirement');
  assert.equal(v.assignments.length, 0);
  assert.equal(v.checkpoint, null);
  assert.deepEqual(
    v.trace.filter((e) => e.operation === 'set-candidate').map((e) => e.modelSource),
    [a],
  );
});
test('empty adventure clears the search state whereas null adventure skips the clear', () => {
  for (const adventure of [[], null]) {
    const f = encountersFixture(),
      a = addEncounter(f);
    section(f, [a], 3);
    f.placement.adventureEncounterSources = adventure;
    synchronize(f);
    const v = place(f);
    assert.equal(
      v.trace.filter((e) => e.stage === 'required-adventure' && e.operation === 'clear-search')
        .length,
      adventure === null ? 0 : 1,
    );
  }
});
