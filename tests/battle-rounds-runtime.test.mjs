import { scenarioMapView } from '../dist/scenario-library.mjs';
// Technical finite invented states exercise deep modules; accepted episode coverage is in HTTP/recovery tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { battleRuntime as runtime } from './battle-combat-runtime.mjs';
import { phaseState, answerSource, drainSource } from './battle-rounds-runtime-helper.mjs';

test('empty-group controller uses battle threat tokens, no journey tiles, exact event order, and one source reset boundary', async () => {
  const { state } = await phaseState();
  assert.equal(runtime.beginSourceShadow(state, randomUUID(), '3'.repeat(64)), true);
  runtime.advanceSourceActivations(state);
  runtime.finishSourceDarkness(state);
  const f = state.scenario.rounds.frames[0];
  assert.deepEqual(f.threat, {
    before: 0,
    heroes: 3,
    tokens: ['example.assets:983'],
    tiles: [],
    delta: 7,
    after: 7,
  });
  assert.equal(f.stage, 'threat');
  assert.equal(runtime.applySourceThreat(state, randomUUID()), true);
  assert.equal(state.scenario.globals.battlePressure, 7);
  assert.equal(f.stage, 'reset');
  assert.deepEqual(f.refreshed, []);
});

test('threshold rescan follows 3H/6H/8H/11H and retains shared enemy points through every wave', async () => {
  const { state, cap } = await phaseState();
  runtime.beginSourceShadow(state, randomUUID(), '3'.repeat(64));
  runtime.advanceSourceActivations(state);
  runtime.finishSourceDarkness(state);
  const f = state.scenario.rounds.frames[0];
  f.threat = {
    before: 26,
    heroes: 3,
    tokens: ['example.assets:983'],
    tiles: [],
    delta: 7,
    after: 33,
  };
  runtime.applySourceThreat(state, randomUUID());
  const balances = [],
    reached = [];
  for (let n = 0; n < 100 && f.stage !== 'reset'; n++) {
    const pending = state.scenario.pending;
    if (pending && pending.state === 1) {
      reached.push(f.threshold);
      balances.push(state.scenario.globals.battleEnemyPoints);
    }
    if (pending) answerSource(state);
    runtime.advanceSourceShadow(state);
  }
  assert.equal(f.stage, 'reset');
  assert.deepEqual(balances, [0, 15, 36, 46]);
  assert.equal(state.scenario.globals.battleEnemyPoints, 46);
  assert.deepEqual(
    reached,
    cap.battleRounds.thresholds.map((t) => t.source),
  );
  assert.deepEqual(state.scenario.threats, []);
  assert.deepEqual(
    state.scenario.enemies.attempts.filter((a) => a.battleWave).map((a) => a.battleWave),
    [
      { budgets: [8, 10], sharedPoints: 15 },
      { budgets: [18, 21], sharedPoints: 36 },
      { budgets: [47, 47], sharedPoints: 46 },
    ],
  );
  assert.ok(state.scenario.enemies.groups.some((g) => g.battleRecipe === 'invented-captain'));
  assert.equal(state.scenario.enemies.groups.filter((g) => g.battleRecipe).length, 1);
  const visible = runtime.scenarioView(state.scenario),
    map = scenarioMapView({ scenario: visible, journey: state.journey, mapGeneration: null });
  const named = state.scenario.enemies.groups.find((g) => g.battleRecipe);
  assert.equal(map.groups.find((g) => g.id === named.id).bonuses.length, 2);
  assert.ok(
    visible.battleRound.groups.every(
      (g) =>
        typeof g.name === 'string' && g.bonuses.every((b) => typeof b.description === 'string'),
    ),
  );
  assert.ok(state.scenario.enemies.groups.every((g) => !g.exhausted));
});

test('unknown benefit stock gates the entire closure before effects, pending requests and entropy', async () => {
  const { state } = await phaseState();
  const a = state.scenario.pack.manifest.battleStartup.battleRounds.combat.source.additions[0];
  a.effect = { op: 'gain-boon', boon: 'hidden' };
  const before = structuredClone(state);
  assert.throws(() => runtime.preflightSourceShadow(state), /riserva/);
  assert.deepEqual(state, before);
});

test('new public projection omits authority, source task/callback associations, recipe, cursor draws and private copy order', async () => {
  const { state } = await phaseState();
  runtime.beginSourceShadow(state, randomUUID(), '3'.repeat(64));
  runtime.advanceSourceActivations(state);
  runtime.finishSourceDarkness(state);
  const v = runtime.scenarioView(state.scenario);
  runtime.ScenarioViewSchema.parse(v);
  assert.equal(v.battleRound.change.delta, 7);
  assert.equal(v.battleRound.threat, 0);
  for (const key of [
    'battleRounds',
    'scriptedGroups',
    'source-battle-shadow-v1',
    'callbacks',
    'battleRecipe',
  ])
    assert.ok(!JSON.stringify(v).includes(`"${key}"`));
  assert.equal(v.rounds, undefined);
  assert.equal(v.enemies.entropy, undefined);
  assert.deepEqual(v.enemies.attempts, []);
  assert.deepEqual(v.tasks, []);
});

test('highest-Might alternative keeps ties, ignores nearer lower Might, and recomputes removed or defeated targets', async () => {
  const { state } = await phaseState();
  const sources = ['west/veranda', 'east/atrium', 'west/veranda'];
  state.journey.heroes.forEach((h, n) => {
    h.spaceId = state.scenario.spaceBindings.find((b) => b.sourceId === sources[n]).id;
  });
  state.content.heroes.slice(0, 3).forEach((h, n) => (h.stats.might = [2, 6, 6][n]));
  const policy = {
    movement: 0,
    alternativeMovement: 3,
    alternativeDestination: 'hero',
    alternativeTarget: 'highest-might',
  };
  const targets = () =>
    runtime.activationTargets(state, 'west/atrium', policy, null, 0).map((t) => t.heroId);
  assert.deepEqual(targets(), ['hero-2', 'hero-3']);
  state.journey.heroes[1].removed = true;
  assert.deepEqual(targets(), ['hero-3']);
  state.physical.snapshot.lastStand = {
    version: 1,
    algorithm: 'sha256-last-stand-counter-rejection-v1',
    heroes: state.preparation.heroes.map((h, n) => ({
      heroId: h.heroId,
      difficulty: 1,
      defeated: n === 2,
    })),
    titles: [],
    selections: [],
    random: [],
    rngCursor: 0,
    lossDue: null,
    terminal: null,
    test: null,
  };
  assert.deepEqual(targets(), ['hero-1']);
  state.journey.heroes[0].removed = true;
  assert.deepEqual(targets(), []);
});
