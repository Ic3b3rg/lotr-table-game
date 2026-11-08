// Technical finite invented deep-module tests. Native camp/owner acceptance remains separate.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { phaseState, answerSource, drainSource } from './battle-rounds-runtime-helper.mjs';
import { battleRuntime as runtime } from './battle-combat-runtime.mjs';
import { reviewAttack, advanceReview } from './fixtures/battle-combat-review.mjs';
import { physicalInput } from './battle-rounds-helper.mjs';

async function namedState(heroCount = 3, { ranged = false } = {}) {
  const f = await phaseState({
    heroCount,
    sourceEdit: (_cap, source) => {
      for (const i of source.items)
        if (i.stat) {
          i.body = '1 Success: 20 hits\n2 Successes: 30 hits';
          if (ranged) i.ranged = true;
        }
    },
  });
  const { state } = f;
  runtime.beginSourceShadow(state, randomUUID(), '3'.repeat(64));
  runtime.advanceSourceActivations(state);
  runtime.finishSourceDarkness(state);
  const frame = state.scenario.rounds.frames[0];
  frame.threat = {
    before: 8 * heroCount - 2 * heroCount - 1,
    heroes: heroCount,
    tokens: ['example.assets:983'],
    tiles: [],
    delta: 2 * heroCount + 1,
    after: 8 * heroCount,
  };
  runtime.applySourceThreat(state, randomUUID());
  drainSource(state);
  const named = state.scenario.enemies.groups.find((g) => g.battleRecipe);
  assert.ok(named);
  for (const g of state.scenario.enemies.groups) if (g.id !== named.id) g.placed = false;
  state.round.phase = 'action';
  state.round.shadowStep = null;
  state.round.activeHeroId = state.preparation.heroes[0].heroId;
  state.round.turnId = randomUUID();
  const cell = state.scenario.spaceBindings.find((b) => b.sourceId === named.spaceId).id;
  state.journey.heroes[0].spaceId = cell;
  return { ...f, named };
}
function attackNamed(state, index = 0) {
  const hero = state.preparation.heroes[index];
  state.round.heroes[index].actionsUsed = 0;
  state.round.heroes[index].turnEnded = false;
  state.round.activeHeroId = hero.heroId;
  state.round.turnId = randomUUID();
  const intent = reviewAttack(state);
  runtime.startHeroAttack(state, hero.playerId, intent, randomUUID());
  advanceReview(
    state,
    () => !!state.scenario.pending,
    (q) =>
      q.options.find(
        (o) =>
          (o.id === 'inspiration' || o.id.startsWith('fate:') || o.id.startsWith('slot:')) &&
          !o.unavailable,
      )?.id,
  );
}
function finishCallback(state) {
  for (let n = 0; n < 100 && state.scenario.pending; n++) {
    const q = state.scenario.pending;
    answerSource(
      state,
      q.kind === 'physical' ? physicalInput(state.physical.snapshot.active) : { kind: 'ack' },
    );
  }
  runtime.advanceCombat(state);
}

test('a ranged named attack rejects unavailable callback supply before costs or cards even without a counterattack', async () => {
  const { state, named, cap } = await namedState(3, { ranged: true });
  const hero = state.preparation.heroes[0],
    position = state.journey.heroes[0],
    layout = cap.board.compiled.layouts.find(
      (l) => l.id === cap.board.compiled.selectedAlternative,
    ),
    forbidden = new Set(
      cap.combat.terrain
        .filter((t) => ['fire', 'rock'].includes(t.kind))
        .map((t) => layout.placements.find((p) => p.id === t.anchor).cell),
    );
  const adjacent = state.scenario.spaceBindings.find((b) => {
    if (forbidden.has(b.sourceId)) return false;
    position.spaceId = b.id;
    return (
      runtime.groupInRange(state, hero.heroId, named, true) &&
      !runtime.groupInRange(state, hero.heroId, named, false)
    );
  });
  assert.ok(adjacent, 'The invented ranged weapon must reach the melee group from another cell');
  position.spaceId = adjacent.id;
  // Technical finite snapshot: keep every physical copy, facedown in hero areas.
  const snapshot = state.physical.snapshot;
  snapshot.decks.damage.splice(2).forEach((copy, i) => {
    snapshot.areas[i % snapshot.areas.length].damage.push(copy);
  });
  const offer = runtime.combatView(state).attacks.find((o) => o.groupId === named.id);
  assert.ok(offer, 'The target is legally in the hero weapon range');
  const intent = {
    type: 'START_ATTACK',
    roundId: state.round.id,
    turnId: state.round.turnId,
    heroId: hero.heroId,
    groupId: offer.groupId,
    itemCopies: offer.itemCopies,
    stat: offer.stat,
    replaceCopy: null,
    grantId: null,
  };
  const before = structuredClone(state);
  assert.ok(
    runtime
      .preflightCombatOperation(state, cap.battleRounds.combat, named, hero.heroId, 'counterattack')
      .includes('battle-callback-damage-supply'),
    'The defeat continuation is mandatory even when no enemy response can occur',
  );
  assert.throws(
    () => runtime.startHeroAttack(state, hero.playerId, intent, randomUUID()),
    (error) => error.code === 'ATTACK_CLOSURE',
  );
  assert.deepEqual(
    state,
    before,
    'No action, reveal, physical copy, entropy or source history changes',
  );
});

test('real defeat callback performs its Agility test, applies preset bonuses once, preserves readiness and returns once', async () => {
  const { state, named } = await namedState();
  named.exhausted = true;
  const token = named.tokenId;
  attackNamed(state);
  assert.equal(state.scenario.pending.kind, 'physical');
  assert.equal(state.scenario.rounds.battle.callbacks.length, 1);
  assert.equal(state.scenario.rounds.battle.callbacks[0].exhausted, true);
  finishCallback(state);
  const next = state.scenario.enemies.groups.find((g) => g.battleRecipe === 'invented-named-2');
  assert.ok(next?.placed);
  assert.equal(next.exhausted, true);
  assert.equal(
    next.tokenId,
    token,
    'ReturnUniqueId inserts the defeated token at the front before DEFEATED',
  );
  assert.deepEqual(
    next.figures.map(({ health, armor, sorcery }) => ({ health, armor, sorcery })),
    [{ health: 6, armor: 3, sorcery: 1 }],
  );
  const cb = state.scenario.rounds.battle.callbacks[0];
  assert.equal(cb.returned, true);
  assert.equal(cb.nextGroupId, next.id);
  assert.equal(state.scenario.play.tests.length, 1);
  assert.equal(state.scenario.play.tests[0].attemptId, cb.id);
  assert.equal(state.scenario.play.tests[0].heroId, cb.heroId);
  assert.equal(state.scenario.play.tests[0].stat, 'agility');
  const before = structuredClone(state);
  assert.throws(
    () => runtime.deliverFirstCombatDefeat(state, cb.attackId, cb.groupId),
    /duplicato/,
  );
  assert.deepEqual(state, before);
});

test('second named defeat signals source victory for three heroes with exact awards and no A3 startup', async () => {
  const { state } = await namedState();
  attackNamed(state);
  finishCallback(state);
  const next = state.scenario.enemies.groups.find((g) => g.battleRecipe === 'invented-named-2');
  const cell = state.scenario.spaceBindings.find((b) => b.sourceId === next.spaceId).id;
  state.journey.heroes[0].spaceId = cell;
  attackNamed(state);
  assert.equal(state.scenario.conclusion.outcome, 'victory');
  finishCallback(state);
  assert.equal(state.scenario.conclusion.version, 'source-battle-victory-v1');
  assert.equal(state.scenario.conclusion.timing, 'source-end');
  assert.equal(state.scenario.conclusion.cause.kind, 'source-victory');
  assert.equal(state.scenario.conclusion.xp.length, 3);
  assert.ok(state.scenario.conclusion.xp.every((x) => x.amount === 4));
  assert.equal(state.scenario.conclusion.transitionCount, 1);
  assert.equal(state.scenario.conclusion.nextAdventureId, 18);
  assert.equal(state.scenario.battle.version, 'source-battle-startup-v1');
  assert.equal(
    state.scenario.enemies.groups.some((g) => g.battleRecipe === 'invented-named-3'),
    false,
  );
});

test('five-hero second callback applies its real Might-negated batch, places the third preset in the previous space, then source victory', async () => {
  const { state } = await namedState(5);
  attackNamed(state);
  finishCallback(state);
  const second = state.scenario.enemies.groups.find((g) => g.battleRecipe === 'invented-named-2');
  const oldSpace = second.spaceId;
  state.journey.heroes[0].spaceId = state.scenario.spaceBindings.find(
    (b) => b.sourceId === oldSpace,
  ).id;
  attackNamed(state);
  finishCallback(state);
  const third = state.scenario.enemies.groups.find((g) => g.battleRecipe === 'invented-named-3');
  assert.ok(third?.placed);
  assert.equal(state.scenario.rounds.battle.callbacks[1].interrupted, 'hero-defeated');
  assert.equal(state.round.heroes[0].actionsUsed, 1, 'The performed attack is not refunded');
  assert.equal(third.spaceId, oldSpace);
  assert.deepEqual(
    third.figures.map(({ health, armor, sorcery }) => ({ health, armor, sorcery })),
    [{ health: 6, armor: 1, sorcery: 1 }],
  );
  const batch = state.physical.runs.find((r) =>
    r.program.children.some((c) => c.kind === 'group-suffer'),
  );
  assert.ok(batch);
  assert.deepEqual(batch.program.children[0], {
    kind: 'group-suffer',
    hero: 0,
    heroes: [0],
    amount: 2,
    negate: 'might',
    family: 'damage',
    face: 'faceup',
  });
  state.journey.heroes[1].spaceId = state.scenario.spaceBindings.find(
    (b) => b.sourceId === third.spaceId,
  ).id;
  attackNamed(state, 1);
  finishCallback(state);
  assert.equal(state.scenario.conclusion.outcome, 'victory');
  assert.equal(state.scenario.rounds.battle.callbacks.length, 3);
  assert.ok(state.scenario.rounds.battle.callbacks.every((c) => c.returned));
});
