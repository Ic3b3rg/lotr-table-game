// Finite invented deep-module probes of real phase-created physical children.
import test from 'node:test';
import assert from 'node:assert/strict';
import { digest } from '../dist/map-freeze-library.mjs';
import { randomUUID } from 'node:crypto';
import { phaseState } from './battle-rounds-runtime-helper.mjs';
import { battleRuntime as runtime } from './battle-combat-runtime.mjs';
import { terrainSource } from './fixtures/battle-test-terrain.mjs';
import { advanceReview } from './fixtures/battle-combat-review.mjs';
import { answerPhysical } from '../dist/physical-resolution-library.mjs';
import { evidence } from './fixtures/physical-fronts.mjs';

for (const kind of ['rock', 'fire'])
  test(`actual Shadow negate child preserves the ${kind} test window`, async () => {
    const { state } = await phaseState({
      groups: true,
      sourceEdit: (d, source) => {
        terrainSource(d, source, { kind, activate: true });
        for (const a of source.assets.filter((a) => a.cls === 'EnemyActivationModel')) {
          for (const row of a.data.Damage) row.Physical = 1;
          a.dataHash = digest(a.data);
        }
      },
    });
    const layout = state.scenario.pack.manifest.battleStartup.board.compiled.layouts.find(
        (l) =>
          l.id === state.scenario.pack.manifest.battleStartup.board.compiled.selectedAlternative,
      ),
      pose = layout.placements.find((p) => p.id === (kind === 'rock' ? 'stone' : 'flame'));
    const id = state.scenario.spaceBindings.find((b) => b.sourceId === pose.cell).id;
    state.scenario.enemies.groups[0].spaceId = pose.cell;
    state.scenario.enemies.groups[0].position = pose.position;
    for (const h of state.journey.heroes) h.spaceId = id;
    runtime.beginSourceShadow(state, randomUUID(), '3'.repeat(64));
    runtime.advanceSourceActivations(state);
    advanceReview(state, () => !!state.physical.snapshot.resolution?.sourceTest);
    const p = state.physical,
      q = p.snapshot.active,
      st = p.snapshot.resolution.sourceTest;
    if (kind === 'rock') assert.equal(st.terrain.kind, 'negate');
    else assert.equal(st.terrain, undefined);
    assert.equal(state.combat.attempts.at(-1).kind, 'activation');
    assert.ok(
      !q.options.some((o) => o.id.startsWith('terrain:fire:')),
      'Fire never applies to an enemy negate test',
    );
    const options = q.options.filter((o) => o.id.startsWith('terrain:boulder:'));
    if (kind === 'rock') {
      assert.equal(options.length, 1);
      const before = st.fateRemaining,
        inspiration = p.snapshot.resolution.resources.preparation.heroes[0].inspiration;
      answerPhysical(
        p,
        q.runId,
        { kind: 'physical-choice', option: options[0].id },
        evidence(state.revision++, q.actorPlayerId),
      );
      if (p.snapshot.active.mode === 'select') {
        const select = p.snapshot.active;
        answerPhysical(
          p,
          select.runId,
          { kind: 'physical-select', ids: [select.options[0].id] },
          evidence(state.revision++, select.actorPlayerId),
        );
      }
      assert.equal(p.snapshot.resolution.sourceTest.fateRemaining, before - 1);
      assert.equal(p.snapshot.resolution.sourceTest.terrain.bouldersUsed.length, 1);
      assert.equal(p.snapshot.resolution.resources.preparation.heroes[0].inspiration, inspiration);
      assert.ok(!p.snapshot.active.options.some((o) => o.id.startsWith('terrain:boulder:')));
      const paid = structuredClone(p);
      assert.throws(() =>
        answerPhysical(
          p,
          q.runId,
          { kind: 'physical-choice', option: options[0].id },
          evidence(state.revision++, q.actorPlayerId),
        ),
      );
      assert.deepEqual(p, paid);
    } else assert.deepEqual(options, []);
  });

test('nonzero battle darkness opens the actual Spirit batch before round-end events and threat', async () => {
  const { state } = await phaseState();
  state.scenario.globals.battleDarkness = true;
  const requestId = randomUUID(),
    record = {
      requestId,
      playerId: state.players[0].id,
      intent: {
        type: 'BEGIN_SHADOW',
        roundId: state.round.id,
        agreed: true,
        expectedRevision: state.revision,
      },
      shadowEntropy: '3'.repeat(64),
      lastStandRules: state.physical.lastStand.fingerprint,
    };
  runtime.executeEpisodeIntent(state, state.physical.cycle, record);
  const frame = state.scenario.rounds.frames[0],
    run = state.physical.runs.at(-1);
  assert.equal(frame.stage, 'darkness');
  assert.equal(frame.threat, null);
  assert.deepEqual(frame.darknessHeroes, ['hero-1', 'hero-2', 'hero-3']);
  assert.deepEqual(run.program.children, [
    { kind: 'darkness', hero: 0, heroes: [0, 1, 2], amount: 2, face: 'faceup', negate: 'spirit' },
  ]);
  assert.equal(state.physical.snapshot.active.actorHeroId, 'hero-1');
  assert.equal(state.scenario.globals.battlePressure, 0);
});
