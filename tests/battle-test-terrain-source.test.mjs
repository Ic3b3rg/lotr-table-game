import test from 'node:test';
import assert from 'node:assert/strict';
import { departureFixture } from './fixtures/camp-departure.mjs';
import { attachBattleCombat } from './fixtures/battle-combat.mjs';
import { terrainSource, terrainPolicy } from './fixtures/battle-test-terrain.mjs';
import { attackChild } from './fixtures/battle-test-terrain-physical.mjs';
import { randomUUID } from 'node:crypto';
import { battleRuntime } from './battle-combat-runtime.mjs';
import { parseScenarioPack } from '../dist/scenario-library.mjs';
import { reviewBattle } from './fixtures/battle-combat-review.mjs';

test('installed source compiler validates and freezes explicit terrain policy and exact rule pins', async () => {
  const f = await departureFixture();
  attachBattleCombat(
    f.input.pack,
    { preparation: { heroes: f.catalog.heroes.slice(0, 3).map((h) => ({ heroId: h.id })) } },
    f.catalog,
    (d, src) => terrainSource(d, src, { activate: true }),
  );
  const before = structuredClone(f.cap);
  const parse = (pack) =>
    parseScenarioPack(battleRuntime.battleCombatPack(pack.manifest.campDeparture, pack));
  assert.doesNotThrow(() => parse(f.input.pack));
  assert.equal(
    battleRuntime.validateBattleCombatSource(f.cap).cap.testTerrain.version,
    'source-battle-test-terrain-v1',
  );
  assert.deepEqual(f.cap, before);
  for (const key of ['version', 'rulesReference', 'errata', 'italian', 'fire', 'boulder']) {
    const bad = structuredClone(f.input.pack);
    bad.manifest.campDeparture.combat.testTerrain[key] = 'forged';
    assert.throws(() => parse(bad), undefined, key);
  }
  const extra = structuredClone(f.input.pack);
  extra.manifest.campDeparture.combat.testTerrain.tokens = 2;
  assert.throws(() => parse(extra));
});

test('missing/forged prospective policy keeps exact old pre-information gates; actual colocated token identity matters', async () => {
  const { state, cap, group } = await reviewBattle();
  const layout = cap.board.compiled.layouts.find(
      (l) => l.id === cap.board.compiled.selectedAlternative,
    ),
    t = cap.combat.terrain.find((t) => t.kind === 'fire'),
    cell = layout.placements.find((p) => p.id === t.anchor).cell;
  state.journey.heroes[0].spaceId = state.scenario.spaceBindings.find(
    (b) => b.sourceId === cell,
  ).id;
  group.spaceId = cell;
  const check = () =>
    battleRuntime.battleCombatProblems(state, 'hero-1', { attack: true, negation: false });
  for (const policy of [undefined, { version: 'source-battle-test-terrain-v1' }]) {
    if (policy) cap.combat.testTerrain = policy;
    else delete cap.combat.testTerrain;
    const before = structuredClone(state);
    assert.ok(check().includes(`battle-terrain-fire:${t.anchor}`));
    assert.deepEqual(state, before);
  }
  delete cap.combat.testTerrain;
  state.scenario.battle.placements = state.scenario.battle.placements.filter(
    (p) => p.anchor !== t.anchor,
  );
  assert.ok(
    !check().some((p) => p.startsWith('battle-terrain-fire:')),
    'removed token cannot offer a terrain benefit',
  );
});

test('the actual controller freezes current placed-token identity and the actor position again for a child run', async () => {
  for (const placement of ['same-cell', 'other-cell', 'removed', 'forged-kind']) {
    const { state } = await reviewBattle();
    const live = state.scenario.pack.manifest.battleStartup.combat;
    live.testTerrain = terrainPolicy();
    const board = state.scenario.pack.manifest.battleStartup.board;
    const layout = board.compiled.layouts.find((l) => l.id === board.compiled.selectedAlternative);
    const fire = live.terrain.find((t) => t.kind === 'fire'),
      cell = layout.placements.find((p) => p.id === fire.anchor).cell;
    const id = state.scenario.spaceBindings.find((b) => b.sourceId === cell).id;
    state.journey.heroes[0].spaceId =
      placement === 'other-cell'
        ? state.scenario.spaceBindings.find((b) => b.sourceId !== cell).id
        : id;
    if (placement === 'removed')
      state.scenario.battle.placements = state.scenario.battle.placements.filter(
        (p) => p.anchor !== fire.anchor,
      );
    if (placement === 'forged-kind')
      state.scenario.battle.placements.find((p) => p.anchor === fire.anchor).kind = 'rock';
    const before = structuredClone(state);
    if (placement === 'forged-kind') {
      assert.ok(
        battleRuntime
          .battleCombatProblems(state, 'hero-1', { attack: true, negation: false })
          .includes(`battle-terrain-context:${fire.anchor}`),
      );
      assert.throws(() => battleRuntime.boonEnemyPositions(state));
      assert.deepEqual(state, before);
      continue;
    }
    battleRuntime.openCombatPhysical(state, { id: randomUUID(), stage: 'attack-test' }, [
      attackChild,
    ]);
    const run = state.physical.runs.at(-1),
      context = run.spatial.testTerrain;
    assert.equal(run.spatial.heroes[0].spaceId, state.journey.heroes[0].spaceId);
    assert.equal(context.boardFingerprint, live.boardFingerprint);
    assert.equal(
      context.tokens.some((t) => t.anchor === fire.anchor),
      placement !== 'removed',
    );
    if (placement === 'same-cell')
      assert.equal(state.physical.snapshot.resolution.sourceTest.terrain.kind, 'attack');
    else assert.equal(state.physical.snapshot.resolution.sourceTest.terrain, undefined);
  }
});
