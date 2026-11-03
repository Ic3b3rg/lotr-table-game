import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readyCycle, cycleCommand } from './physical-cycle-helper.mjs';
import { readSession, readBackup } from './skill-test-helper.mjs';
import { catalogFixture } from './fixtures/catalog.mjs';
import { hash } from './fixtures/physical-fronts.mjs';
import { command } from './preparation-helper.mjs';
import { suffer } from './fixtures/physical-resolution.mjs';

const policy = (input, id, effects) => {
  const d = catalogFixture().skills.find((c) => c.id === id);
  input.policies.push({
    id,
    kind: 'skill',
    definitionHash: hash(d),
    source: { sourceId: 'invented', locator: 'Cycle!policy' },
    effects,
  });
};
const answer = async (ready, input, actor = ready.player, at) => {
  const s = at ?? (await readSession(ready.host));
  const { type: _, ...q } = s.physical.cycle.pending;
  return command(ready.host, actor, { type: 'CYCLE_INPUT', ...q, input }, s);
};

test('ordinary END_TURN resolves its live persistent front before completing once', async (t) => {
  const ready = await readyCycle(t);
  const before = await readSession(ready.host);
  assert.equal(before.physical.fronts.length, 1);
  let r = await cycleCommand(ready, 'START_TURN');
  assert.equal(r.status, 200, (await r.text()) + ready.host.diagnostics());
  r = await cycleCommand(ready, 'END_TURN');
  assert.equal(r.status, 200, await r.text());
  const after = await readSession(ready.host);
  assert.equal(after.physical.fronts.length, 0);
  assert.equal(after.round.heroes[0].turnEnded, true);
  assert.equal(after.round.activeHeroId, null);
  const backup = await readBackup(ready.host);
  assert.equal(backup.payload.state.physical.runs.length, 2);
  assert.equal(backup.payload.state.physical.snapshot.parents[1].returnCount, 1);
  const restored = await ready.host.request('/api/restores', {
    backup,
    generation: after.generation,
    expectedRevision: after.revision,
    confirmed: true,
  });
  assert.equal(restored.status, 200, await restored.text());
});

test('the same hash-bound prepare policy rewards startup and Rally without a second resource account', async (t) => {
  const ready = await readyCycle(t, (input) =>
    policy(input, 'role-1-skill-1', [{ op: 'after-prepare-inspiration' }]),
  );
  const s = await readSession(ready.host);
  assert.equal(
    s.scenario.cardEffects.filter(
      (e) => e.source === 'initial' && e.heroId === s.preparation.heroes[0].heroId,
    ).length,
    1,
  );
  assert.equal((await cycleCommand(ready, 'START_TURN')).status, 200);
  assert.equal((await cycleCommand(ready, 'END_TURN')).status, 200);
  const backup = await readBackup(ready.host);
  const r = await ready.host.request('/api/restores', {
    backup,
    generation: s.generation,
    expectedRevision: (await readSession(ready.host)).revision,
    confirmed: true,
  });
  assert.equal(r.status, 200, await r.text());
});

test('END_TURN keeps travel and actor until a real prevention child on another phone returns', async (t) => {
  const ready = await readyCycle(t, (input) => {
    for (const d of input.definitions.filter((d) => d.cardId.includes('damage')))
      d.persistent = [
        {
          op: 'suffer',
          window: 'end-own-turn',
          hero: 'self',
          family: 'fear',
          n: 1,
          face: 'normal',
        },
      ];
    policy(input, 'role-2-skill-1', [{ op: 'guard', n: 1 }]);
  });
  for (const type of ['START_TURN', 'START_TRAVEL', 'END_TURN']) {
    const r = await cycleCommand(ready, type);
    assert.equal(r.status, 200, await r.text());
  }
  let s = await readSession(ready.host);
  assert.equal(s.round.heroes[0].turnEnded, false);
  assert.equal(s.journey.travel.remaining, 2);
  const offer = s.physical.active.options.find((o) => o.id.includes('role-2-skill-1')).id;
  assert.equal((await answer(ready, { kind: 'physical-choice', option: offer })).status, 200);
  s = await readSession(ready.host);
  assert.equal(s.physical.active.actorPlayerId, ready.other.body.player.id);
  assert.equal(
    (await answer(ready, { kind: 'physical-allocate', ability: offer, damage: 0, fear: 1 })).status,
    403,
  );
  const r = await answer(
    ready,
    { kind: 'physical-allocate', ability: offer, damage: 0, fear: 1 },
    ready.other,
  );
  assert.equal(r.status, 200, await r.text());
  s = await readSession(ready.host);
  assert.equal(s.round.heroes[0].turnEnded, true);
  assert.equal(s.journey.travel, null);
  assert.equal(s.preparation.heroes[1].prepared.length, 0);
});

test('ordinary travel consumes a modified grant and freezes positions separately for each source', async (t) => {
  const ready = await readyCycle(t, (input) => {
    for (const d of input.definitions.filter((d) => d.cardId.includes('damage')))
      d.persistent.push({ op: 'travel-move-modifier', window: 'travel-action', n: -1 });
  });
  assert.equal((await cycleCommand(ready, 'START_TURN')).status, 200);
  let r = await cycleCommand(ready, 'START_TRAVEL');
  assert.equal(r.status, 200, await r.text());
  let s = await readSession(ready.host);
  assert.equal(s.journey.travel.remaining, 1);
  const from = s.journey.heroes[0].spaceId;
  const dest = s.journey.definition.connections.flatMap(([a, b]) =>
    a === from ? [b] : b === from ? [a] : [],
  )[0];
  r = await cycleCommand(ready, 'MOVE_HERO', { fromSpaceId: from, destinationSpaceId: dest });
  assert.equal(r.status, 200, await r.text());
  s = await readSession(ready.host);
  assert.equal(s.journey.travel.remaining, 0);
  assert.equal(
    (await cycleCommand(ready, 'MOVE_HERO', { fromSpaceId: dest, destinationSpaceId: from }))
      .status,
    409,
  );
  r = await cycleCommand(ready, 'END_TURN');
  assert.equal(r.status, 200, await r.text());
  const p = (await readBackup(ready.host)).payload.state.physical;
  assert.equal(p.heroes[0].spaceId, from);
  assert.equal(p.runs.at(-1).spatial.heroes[0].spaceId, dest);
  assert.equal(p.runs[0].spatial, undefined);
});

test('ordinary end-turn Rest pays its prepared copy, returns only selected mixed backs and resolves after-Rest', async (t) => {
  const ready = await readyCycle(
    t,
    (input) => {
      for (const d of input.definitions.filter((d) => d.cardId.includes('damage')))
        d.persistent = [{ op: 'self-flip-down', window: 'after-rest' }];
      policy(input, 'role-1-skill-1', [{ op: 'rest', n: 2 }]);
    },
    (_pack, pr) => pr.children.push(suffer(0, 1, 1)),
  );
  assert.equal((await cycleCommand(ready, 'START_TURN')).status, 200);
  let r = await cycleCommand(ready, 'END_TURN');
  assert.equal(r.status, 200, await r.text());
  let s = await readSession(ready.host);
  const rest = s.physical.active.options.find((o) => o.id.includes('role-1-skill-1')).id;
  r = await answer(ready, { kind: 'physical-choice', option: rest });
  assert.equal(r.status, 200, await r.text());
  s = await readSession(ready.host);
  assert.equal(s.preparation.heroes[0].prepared.length, 0);
  assert.ok(s.physical.active.options.every((o) => o.id.startsWith('down:')));
  r = await answer(ready, { kind: 'physical-select', ids: ['down:damage:0', 'down:fear:0'] });
  assert.equal(r.status, 200, await r.text());
  s = await readSession(ready.host);
  assert.equal(s.physical.fronts.length, 0);
  assert.deepEqual(s.physical.heroes[0].facedown, { damage: 1, fear: 0 });
  assert.equal(s.round.heroes[0].turnEnded, true);
});

test('ordinary Rally recomposes and Scouts with live top restrictions and prepare rewards in the same ledger', async (t) => {
  const ready = await readyCycle(t, (input) => {
    for (const d of input.definitions.filter((d) => d.cardId.includes('damage')))
      d.persistent = [{ op: 'prohibit-scout-top', window: 'rally-scout' }];
    for (const card of catalogFixture().skills.filter((s) => s.identityStatus === 'confirmed'))
      policy(input, card.id, [{ op: 'after-prepare-inspiration' }]);
  });
  for (const actor of [ready.player, ready.other])
    for (const type of ['START_TURN', 'END_TURN']) {
      const r = await cycleCommand(ready, type, {}, actor);
      assert.equal(r.status, 200, await r.text());
    }
  for (const [type, extra] of [
    ['BEGIN_SHADOW', {}],
    ...['enemies', 'darkness', 'threat'].map((step) => ['CONFIRM_SHADOW_STEP', { step }]),
  ]) {
    const r = await cycleCommand(ready, type, extra);
    assert.equal(r.status, 200, await r.text());
  }
  let s = await readSession(ready.host);
  assert.equal(s.round.phase, 'rally');
  let r = await cycleCommand(ready, 'START_RALLY_SCOUT');
  assert.equal(r.status, 200, await r.text());
  s = await readSession(ready.host);
  const cards = s.physical.active.options.map((o) => o.id);
  r = await answer(ready, {
    kind: 'physical-scout',
    prepare: null,
    discard: null,
    top: cards,
    bottom: [],
  });
  assert.equal(r.status, 409);
  const inspiration = s.preparation.heroes[0].inspiration;
  r = await answer(ready, {
    kind: 'physical-scout',
    prepare: cards[0],
    discard: null,
    top: [],
    bottom: cards.slice(1),
  });
  assert.equal(r.status, 200, await r.text());
  s = await readSession(ready.host);
  assert.equal(s.round.heroes[0].rallyDone, true);
  assert.equal(s.preparation.heroes[0].inspiration, Math.min(4, inspiration + 1));
});

test('a Last Stand barrier suspends ordinary END_TURN without losing actions or movement', async (t) => {
  const ready = await readyCycle(
    t,
    (input) => {
      for (const d of input.definitions.filter((d) => d.cardId.includes('damage')))
        d.persistent = [
          {
            op: 'suffer',
            window: 'end-own-turn',
            hero: 'self',
            family: 'fear',
            n: 1,
            face: 'normal',
          },
        ];
    },
    (_pack, pr) => pr.children.push(suffer(0, 0, 4)),
  );
  for (const type of ['START_TURN', 'START_TRAVEL', 'END_TURN']) {
    const r = await cycleCommand(ready, type);
    assert.equal(r.status, 200, await r.text());
  }
  const s = await readSession(ready.host);
  assert.equal(s.physical.active.reason, 'last-stand-unavailable');
  assert.equal(s.physical.active.capability, 'P2:last-stand');
  assert.equal(s.round.heroes[0].turnEnded, false);
  assert.equal(s.round.heroes[0].actionsUsed, 1);
  assert.equal(s.journey.travel.remaining, 2);
  assert.equal(s.physical.parents.at(-1).returnCount, 0);
  assert.equal((await cycleCommand(ready, 'END_TURN')).status, 409);
  assert.equal((await cycleCommand(ready, 'BEGIN_SHADOW')).status, 409);
});
