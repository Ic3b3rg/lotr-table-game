import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { battleRuntime as runtime } from './battle-combat-runtime.mjs';
import {
  reviewBattle,
  reviewAttack,
  advanceReview,
  commandFor,
} from './fixtures/battle-combat-review.mjs';

test('A2 public conclusion omits private episode hashes and canonicalizes owned skill inventory', async () => {
  const { state, cap } = await reviewBattle();
  const cause = {
    runId: randomUUID(),
    heroId: state.preparation.heroes[0].heroId,
    instructionHash: '1'.repeat(64),
  };
  state.physical.snapshot.lastStand = {
    version: 1,
    algorithm: 'sha256-last-stand-counter-rejection-v1',
    heroes: state.physical.heroes.map((h) => ({ heroId: h.heroId, difficulty: 1, defeated: true })),
    titles: [],
    selections: [],
    random: [],
    rngCursor: 0,
    lossDue: cause,
    terminal: cause,
    test: null,
  };
  const other = structuredClone(state);
  other.preparation.heroes[0].deck.reverse();
  const requestId = randomUUID();
  assert.equal(runtime.beginHeroFailure(state, 'no-active-heroes', requestId), true);
  assert.equal(runtime.beginHeroFailure(other, 'no-active-heroes', requestId), true);
  const before = structuredClone(state.scenario.conclusion);
  assert.equal(
    Object.hasOwn(runtime.scenarioView(state.scenario).conclusion, 'episodeHash'),
    false,
  );
  assert.deepEqual(
    runtime.scenarioView(state.scenario).conclusion,
    runtime.scenarioView(other.scenario).conclusion,
  );
  assert.deepEqual(
    state.scenario.conclusion,
    before,
    'Projection never changes saved source authority',
  );
  for (const s of [state, other]) {
    runtime.applyConclusionAction(s, { op: 'awardXP', amount: 3 }, s.scenario.pack.principal);
    runtime.applyConclusionAction(
      s,
      { op: 'nextAdventure', source: cap.combat.terminal.failure.next.source, id: 18 },
      s.scenario.pack.principal,
    );
    runtime.applyConclusionAction(s, { op: 'proceed' }, s.scenario.pack.principal);
  }
  const publicConclusion = runtime.scenarioView(state.scenario).conclusion;
  assert.deepEqual(
    publicConclusion.campaign.heroes.map((h) => h.skillCopies),
    runtime.scenarioView(other.scenario).conclusion.campaign.heroes.map((h) => h.skillCopies),
  );
  for (const h of publicConclusion.campaign.heroes)
    assert.deepEqual(h.skillCopies, [...h.skillCopies].sort());
  assert.deepEqual(
    state.scenario.conclusion.campaign.heroes[0].skillCopies.slice(
      0,
      state.preparation.heroes[0].deck.length,
    ),
    state.preparation.heroes[0].deck,
  );
  assert.doesNotThrow(() => runtime.ScenarioViewSchema.shape.conclusion.parse(publicConclusion));
});

test('an offered A2 card grant starts its child through the actual command gate without another action', async () => {
  const { state } = await reviewBattle({ grant: true });
  const parent = runtime.startHeroAttack(
    state,
    state.preparation.heroes[0].playerId,
    reviewAttack(state),
    randomUUID(),
  );
  advanceReview(state, () => parent.stage === 'after-attack');
  const pending = runtime.combatPending(state),
    choice = pending.options.find((o) => o.id.startsWith('grant:') && !o.unavailable);
  assert.ok(choice);
  runtime.answerCombat(state, pending.actorPlayerId, commandFor(pending, choice.id), randomUUID());
  const view = runtime.combatView(state),
    grant = view.grant,
    offer = view.attacks.find((o) => !o.reason);
  assert.ok(grant && offer);
  const before = structuredClone(state),
    actions = state.round.heroes.map((h) => h.actionsUsed);
  const intent = { ...reviewAttack(state), grantId: grant.id, expectedRevision: state.revision };
  const record = {
    playerId: state.preparation.heroes.find((h) => h.heroId === grant.heroId).playerId,
    requestId: randomUUID(),
    intent,
  };
  assert.throws(
    () =>
      runtime.executeEpisodeIntent(state, state.physical.cycle, {
        ...record,
        intent: { ...intent, grantId: null },
      }),
    (e) => e.code === 'COMBAT_PENDING',
  );
  assert.deepEqual(state, before);
  const receipt = runtime.executeEpisodeIntent(state, state.physical.cycle, record);
  assert.equal(receipt.type, 'START_ATTACK');
  assert.equal(state.combat.attempts.at(-1).parentId, parent.id);
  assert.equal(state.combat.attempts.at(-1).cost, 'grant');
  assert.deepEqual(
    state.round.heroes.map((h) => h.actionsUsed),
    actions,
  );
  assert.ok(!state.preparation.heroes[0].prepared.includes('role-1-skill-1:1'));
  assert.ok(state.preparation.heroes[0].discard.includes('role-1-skill-1:1'));
});

test('boulder gates only reachable enemy negation while fire still gates the hero attack', async () => {
  const { state, cap, group } = await reviewBattle();
  const layout = cap.board.compiled.layouts.find(
    (l) => l.id === cap.board.compiled.selectedAlternative,
  );
  const placeAt = (kind) => {
    const terrain = cap.combat.terrain.find((t) => t.kind === kind);
    const cell = layout.placements.find((p) => p.id === terrain.anchor).cell;
    state.scenario.battle.placements = [{ anchor: terrain.anchor, kind }];
    state.journey.heroes[0].spaceId = state.scenario.spaceBindings.find(
      (b) => b.sourceId === cell,
    ).id;
    group.spaceId = cell;
  };
  placeAt('rock');
  group.exhausted = true;
  group.bonuses = [];
  const before = structuredClone(state);
  const missing = runtime.preflightCombatOperation(
    state,
    cap.combat.combat,
    group,
    state.preparation.heroes[0].heroId,
    'counterattack',
  );
  assert.equal(
    missing.some((p) => p.startsWith('battle-terrain-boulder:')),
    false,
  );
  assert.deepEqual(state, before);
  group.exhausted = false;
  assert.ok(
    runtime
      .preflightCombatOperation(
        state,
        cap.combat.combat,
        group,
        state.preparation.heroes[0].heroId,
        'counterattack',
      )
      .some((p) => p.startsWith('battle-terrain-boulder:')),
  );
  const from = group.spaceId;
  group.spaceId = state.scenario.spaceBindings
    .map((b) => b.sourceId)
    .find(
      (spaceId) =>
        !runtime.groupInRange(
          state,
          state.preparation.heroes[0].heroId,
          { ...group, spaceId },
          false,
        ),
    );
  assert.ok(group.spaceId);
  assert.equal(
    runtime
      .preflightCombatOperation(
        state,
        cap.combat.combat,
        group,
        state.preparation.heroes[0].heroId,
        'counterattack',
      )
      .some((p) => p.startsWith('battle-terrain-boulder:')),
    false,
  );
  group.spaceId = from;
  placeAt('fire');
  group.exhausted = true;
  assert.ok(
    runtime
      .preflightCombatOperation(
        state,
        cap.combat.combat,
        group,
        state.preparation.heroes[0].heroId,
        'counterattack',
      )
      .some((p) => p.startsWith('battle-terrain-fire:')),
  );
});

test('a selected A2 forced hero step asks its owner for ready-group order before opening a child', async () => {
  const { state, group } = await reviewBattle({ movement: true });
  const second = { ...structuredClone(group), id: randomUUID() };
  const third = { ...structuredClone(group), id: randomUUID() };
  const exhausted = { ...structuredClone(group), id: randomUUID(), exhausted: true };
  for (const [n, g] of [group, second, third, exhausted].entries())
    g.figures = [{ ...g.figures[0], id: `review-figure-${n}` }];
  state.scenario.enemies.groups = [group, second, third, exhausted];
  const parent = runtime.startHeroAttack(
    state,
    state.preparation.heroes[0].playerId,
    reviewAttack(state),
    randomUUID(),
  );
  advanceReview(state, () => parent.stage === 'movement');
  assert.equal(group.exhausted, true, 'The performed counterattack exhausted the original target');
  const pending = runtime.combatPending(state);
  const hero = state.content.heroes.find((h) => h.id === parent.heroId);
  const step = pending.options.find((o) => o.label.startsWith(`Muovi ${hero.name.text} verso`));
  assert.ok(step);
  const count = state.combat.attempts.length;
  runtime.answerCombat(state, parent.playerId, commandFor(pending, step.id), randomUUID());
  assert.equal(
    state.combat.attempts.length,
    count,
    'The first ready group is not automatically chosen',
  );
  assert.equal(state.physical.snapshot.active, null);
  const order = runtime.combatPending(state);
  assert.equal(order.actorPlayerId, parent.playerId);
  assert.deepEqual(
    new Set(order.options.map((o) => o.id)),
    new Set([`provoke:${second.id}`, `provoke:${third.id}`]),
  );
  const resumed = JSON.parse(JSON.stringify(state));
  assert.deepEqual(
    runtime.combatPending(resumed),
    order,
    'The saved selected step retains the same owner-bound order prompt',
  );
  const unchanged = structuredClone(state);
  assert.throws(
    () =>
      runtime.answerCombat(
        state,
        parent.playerId,
        commandFor(order, `provoke:${exhausted.id}`),
        randomUUID(),
      ),
    (e) => e.code === 'COMBAT_OPTION',
  );
  assert.deepEqual(state, unchanged);
  assert.throws(
    () =>
      runtime.answerCombat(
        state,
        state.preparation.heroes[1].playerId,
        commandFor(order, `provoke:${third.id}`),
        randomUUID(),
      ),
    (e) => e.code === 'COMBAT_ACTOR',
  );
  assert.deepEqual(state, unchanged);
  runtime.answerCombat(
    state,
    parent.playerId,
    commandFor(order, `provoke:${third.id}`),
    randomUUID(),
  );
  assert.equal(state.combat.attempts.at(-1).groupId, third.id);
  assert.equal(state.combat.attempts.at(-1).parentId, parent.id);
  assert.equal(state.physical.snapshot.active.kind, 'decision');
  assert.deepEqual(
    parent.movement.selected,
    unchanged.combat.attempts.find((a) => a.id === parent.id).movement.selected,
  );
  assert.deepEqual(parent.movement.provoked, [third.id]);
});
