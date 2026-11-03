import { hash } from './fixtures/map-freeze.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readSession } from './skill-test-helper.mjs';
import { readyOriginal, interact, playable, finishPhysical } from './original-encounter-helper.mjs';
import { cycleCommand } from './physical-cycle-helper.mjs';
import { scenarioInput } from './scenario-helper.mjs';
async function ok(p) {
  const r = await p;
  assert.equal(r.status, 200, await r.text());
}
async function arrive(r, actor = r.player) {
  await ok(cycleCommand(r, 'START_TURN', {}, actor));
  await ok(cycleCommand(r, 'START_TRAVEL', {}, actor));
  const s = await readSession(r.host),
    h = s.preparation.heroes.find((h) => h.playerId === actor.body.player.id),
    i = playable(s);
  const dest = s.scenario.spaceBindings.find((b) => b.sourceId === i.spaceId).id;
  await ok(
    cycleCommand(
      r,
      'MOVE_HERO',
      {
        fromSpaceId: s.journey.heroes.find((x) => x.heroId === h.heroId).spaceId,
        destinationSpaceId: dest,
      },
      actor,
    ),
  );
}
test('original interaction interleaves movement, one cost, retained first success and shared count 2+1', async (t) => {
  const r = await readyOriginal(t);
  await arrive(r);
  const before = await readSession(r.host);
  assert.equal(before.encounterFingerprints[playable(before).id], hash(playable(before)));
  await ok(interact(r));
  let s = await finishPhysical(r);
  assert.equal(s.scenario.pending.kind, 'choice');
  assert.equal(playable(s).variables.seen, true);
  assert.equal(s.round.heroes[0].actionsUsed, 2);
  assert.equal(s.journey.travel.remaining, 1);
  assert.equal((await scenarioInput(r.host, r.player, { kind: 'ack' })).status, 409);
  await ok(scenarioInput(r.host, r.player, { kind: 'choice', event: 'COUNT' }));
  s = await finishPhysical(r);
  assert.equal(s.scenario.pending, null);
  assert.equal(playable(s).variables.sum, 2);
  assert.equal(s.scenario.play.lore, 0);
  assert.equal(s.physical.heroes[0].facedown.fear, 2);
  assert.equal(s.journey.travel.remaining, 1);
  await ok(cycleCommand(r, 'END_TURN'));
  await arrive(r, r.other);
  await ok(interact(r, r.other));
  s = await finishPhysical(r);
  assert.equal(s.scenario.pending.kind, 'choice');
  assert.equal(s.scenario.play.tests.filter((x) => x.stat === 'agility').length, 1);
  await ok(scenarioInput(r.host, r.other, { kind: 'choice', event: 'COUNT' }));
  s = await finishPhysical(r);
  assert.equal(playable(s).variables.sum, 3);
  assert.equal(s.scenario.play.lore, 1);
  assert.equal(s.scenario.pending.kind, 'message');
  await ok(scenarioInput(r.host, r.other, { kind: 'ack' }));
  s = await readSession(r.host);
  assert.equal(playable(s).visible, false);
  assert.equal(playable(s).stopped, true);
  assert.equal(s.scenario.play.active, null);
  assert.equal(s.journey.travel.remaining, 1);
  assert.equal(s.scenario.completedSetup.length, 4);
  assert.deepEqual(s.mapGeneration, before.mapGeneration);
});

test('original confirmation rejects foreign ownership, wrong space, source, stale revision and exhausted budget without effects', async (t) => {
  const r = await readyOriginal(t);
  await ok(cycleCommand(r, 'START_TURN'));
  let s = await readSession(r.host);
  for (const [actor, extra, status] of [
    [r.player, {}, 409],
    [r.other, { heroId: s.preparation.heroes[0].heroId }, 403],
    [r.player, { sourceFingerprint: '0'.repeat(64) }, 409],
    [r.player, { packFingerprint: '0'.repeat(64) }, 409],
  ]) {
    const response = await interact(r, actor, extra);
    assert.equal(response.status, status, await response.text());
    assert.deepEqual(await readSession(r.host), s);
  }
  await ok(cycleCommand(r, 'START_TRAVEL'));
  s = await readSession(r.host);
  const i = playable(s),
    dest = s.scenario.spaceBindings.find((b) => b.sourceId === i.spaceId).id;
  await ok(
    cycleCommand(r, 'MOVE_HERO', {
      fromSpaceId: s.journey.heroes[0].spaceId,
      destinationSpaceId: dest,
    }),
  );
  await ok(cycleCommand(r, 'START_TRAVEL'));
  s = await readSession(r.host);
  const response = await interact(r);
  assert.equal(response.status, 409, await response.text());
  assert.deepEqual(await readSession(r.host), s);
});

test('first success survives a failed alternative and another hero never repeats that first test', async (t) => {
  const r = await readyOriginal(t);
  await arrive(r);
  await ok(interact(r));
  await finishPhysical(r);
  await ok(scenarioInput(r.host, r.player, { kind: 'choice', event: 'OTHER' }));
  let s = await finishPhysical(r);
  assert.equal(playable(s).variables.seen, true);
  assert.equal(s.scenario.play.lore, 0);
  assert.equal(s.scenario.pending, null);
  assert.equal(s.physical.heroes[0].facedown.damage, 1);
  await ok(cycleCommand(r, 'END_TURN'));
  await arrive(r, r.other);
  await ok(interact(r, r.other));
  s = await finishPhysical(r);
  assert.equal(s.scenario.pending.kind, 'choice');
  assert.equal(s.scenario.play.tests.filter((x) => x.stat === 'agility').length, 1);
});

test('successful alternative removes the token with no invented Lore', async (t) => {
  const r = await readyOriginal(t, (pack) => {
    for (const d of pack.definitions)
      for (const st of d.states)
        for (const a of st.actions) if (a.op === 'sourceTest' && a.stat === 'might') a.target = 2;
  });
  await arrive(r);
  await ok(interact(r));
  await finishPhysical(r);
  await ok(scenarioInput(r.host, r.player, { kind: 'choice', event: 'OTHER' }));
  let s = await finishPhysical(r);
  assert.equal(s.scenario.play.lore, 0);
  await ok(scenarioInput(r.host, r.player, { kind: 'ack' }));
  s = await readSession(r.host);
  assert.equal(playable(s).stopped, true);
  assert.equal(s.scenario.play.lore, 0);
});

test('first failure consumes the real consequence and P2 before return and excludes the defeated actor', async (t) => {
  const r = await readyOriginal(
    t,
    () => {},
    (c) => {
      for (const s of c.skills) {
        s.success = 0;
        s.fate = 0;
      }
      c.heroes[0].stats.damage = 2;
    },
  );
  await arrive(r);
  await ok(interact(r));
  const s = await finishPhysical(r);
  assert.equal(playable(s).variables.seen, false);
  assert.equal(s.scenario.play.active, null);
  assert.equal(s.scenario.pending, null);
  assert.equal(s.physical.lastStand.selections.length, 1);
  assert.equal(s.physical.lastStand.selections[0].outcome, 'fail');
  assert.equal(s.journey.heroes[0].removed, true);
  assert.equal(s.round.activeHeroId, null);
  assert.equal((await cycleCommand(r, 'START_TURN')).status, 409);
  assert.ok(s.physical.parents.every((p) => p.returnCount === 1));
});

test('a source test keeps its own success when a conversion child leads to defeat, and returns without another hero choice', async (t) => {
  const r = await readyOriginal(
    t,
    () => {},
    (c) => {
      for (const card of c.skills) {
        card.success = 0;
        card.fate = 1;
      }
      c.heroes[1].stats.fear = 2;
    },
    (input, catalog) => {
      for (const d of input.definitions)
        d.body = d.cardId.includes('damage')
          ? [
              {
                op: 'suffer',
                hero: 'each-other-hero-any-distance',
                family: 'fear',
                n: 1,
                face: 'down',
              },
              { op: 'self-flip-down' },
            ]
          : [
              { op: 'suffer', hero: 'self', family: 'fear', n: 1, face: 'down' },
              { op: 'keep-faceup' },
            ];
      for (const c of catalog.skills)
        input.policies.push({
          id: c.id,
          kind: 'skill',
          definitionHash: hash(c),
          source: { sourceId: 'invented', locator: 'Fixture!defeat-child' },
          effects:
            c.id === 'role-2-skill-1'
              ? [
                  { op: 'convert-one-scout', scout: 1 },
                  { op: 'limits', damage: 0, fear: 1 },
                ]
              : [{ op: 'after-prepare-flip-fear' }],
        });
    },
  );
  await arrive(r);
  await ok(interact(r));
  let s = await finishPhysical(r);
  assert.equal(playable(s).variables.seen, false);
  assert.equal(s.physical.heroes[1].facedown.fear, 2);
  await ok(cycleCommand(r, 'END_TURN'));
  await arrive(r, r.other);
  await ok(interact(r, r.other));
  await ok(scenarioInput(r.host, r.other, { kind: 'physical-choice', option: 'reveal' }));
  await ok(scenarioInput(r.host, r.other, { kind: 'physical-choice', option: 'role-2-skill-1:1' }));
  s = await readSession(r.host);
  assert.equal(s.physical.active.mode, 'scout');
  const cards = s.physical.active.options.map((o) => o.id);
  assert.equal(cards.length, 1);
  await ok(
    scenarioInput(r.host, r.other, {
      kind: 'physical-scout',
      prepare: cards[0],
      discard: null,
      top: [],
      bottom: [],
    }),
  );
  s = await finishPhysical(r);
  assert.equal(
    s.physical.lastStand.heroes.find((h) => h.heroId === 'hero-2').defeated,
    true,
    JSON.stringify({
      lastStand: s.physical.lastStand,
      areas: s.physical.heroes,
      fronts: s.physical.fronts,
      pending: s.scenario.pending?.kind,
      tests: s.scenario.play.tests,
    }),
  );
  assert.equal(s.scenario.play.tests.at(-1).successes, 1);
  assert.equal(playable(s).variables.seen, true);
  assert.equal(s.scenario.pending, null);
  assert.equal(s.scenario.play.active, null);
  assert.equal(s.scenario.play.attempts.at(-1).interrupted, 'hero-defeated');
  assert.equal(s.scenario.play.attempts.at(-1).returned, true);
  assert.equal(playable(s).visible, true);
  assert.equal(playable(s).state, 0);
  assert.equal(s.round.heroes[1].actionsUsed, 2);
  assert.equal(s.round.activeHeroId, null);
  assert.equal(s.journey.travel, null);
  assert.ok(s.physical.parents.every((p) => p.returnCount === 1));
});
