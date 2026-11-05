import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  readyBase,
  prepareBase,
  reachBase,
  commitBase,
  baseNode,
  baseIntent,
  ok,
} from './base-products-http-helper.mjs';
import { readSession, readBackup } from './skill-test-helper.mjs';
import { command } from './preparation-helper.mjs';
import { scenarioInput, startScenario } from './scenario-helper.mjs';
import { hash } from './fixtures/map-freeze.mjs';

test('HTTP source test charges once, authorizes cards and conversions, rewards once and preserves the base chain', async (t) => {
  const r = await readyBase(t);
  await reachBase(r);
  const before = await readBackup(r.host),
    s = await readSession(r.host);
  const c = { ...baseIntent(s), requestId: randomUUID() };
  assert.equal((await command(r.host, r.other, c, s)).status, 403);
  assert.deepEqual((await readBackup(r.host)).payload, before.payload);
  const replies = await Promise.all([
    command(r.host, r.player, c, s),
    command(r.host, r.player, c, s),
  ]);
  assert.deepEqual(
    replies.map((r) => r.status),
    [200, 200],
  );
  const receipt = await replies[0].json();
  assert.deepEqual(await replies[1].json(), receipt);
  let view = await readSession(r.host);
  assert.equal(view.round.heroes[0].actionsUsed, 2);
  for (const [actor, input, overrides] of [
    [r.other, { kind: 'physical-choice', option: 'reveal' }, {}],
    [r.player, { kind: 'physical-choice', option: 'reveal' }, { heroId: 'hero-2' }],
    [r.player, { kind: 'choice', event: 'SOLVED' }, {}],
    [r.player, { kind: 'choice', event: 'EXTRA' }, {}],
    [r.player, { kind: 'physical-select', ids: ['foreign-copy:1'] }, {}],
    [
      r.player,
      { kind: 'physical-choice', option: 'reveal' },
      { sourceFingerprint: 'f'.repeat(64) },
    ],
  ]) {
    const old = (await readBackup(r.host)).payload;
    assert.ok([403, 409].includes((await scenarioInput(r.host, actor, input, overrides)).status));
    assert.deepEqual((await readBackup(r.host)).payload, old);
  }
  await ok(scenarioInput(r.host, r.player, { kind: 'physical-choice', option: 'reveal' }));
  view = await readSession(r.host);
  const revealed = view.physical.sourceTest;
  assert.equal(revealed.cards.length, 2);
  assert.equal(revealed.successes, 2);
  assert.equal(revealed.fateRemaining, 2);
  const at = view,
    id = randomUUID();
  const a = await ok(
    scenarioInput(
      r.host,
      r.player,
      { kind: 'physical-choice', option: 'inspiration' },
      { requestId: id },
      at,
    ),
  );
  const b = await ok(
    scenarioInput(
      r.host,
      r.player,
      { kind: 'physical-choice', option: 'inspiration' },
      { requestId: id },
      at,
    ),
  );
  assert.deepEqual(await a.json(), await b.json());
  assert.equal(
    (
      await scenarioInput(
        r.host,
        r.player,
        { kind: 'physical-choice', option: 'inspiration' },
        {},
        at,
      )
    ).status,
    409,
  );
  await ok(scenarioInput(r.host, r.player, { kind: 'physical-choice', option: 'resolve' }));
  view = await readSession(r.host);
  assert.equal(view.scenario.play.tests[0].successes, 3);
  assert.equal(view.preparation.heroes[0].inspiration, 1);
  assert.equal(view.scenario.pending.kind, 'message');
  await ok(scenarioInput(r.host, r.other, { kind: 'ack' }));
  const final = (await readBackup(r.host)).payload,
    state = final.state;
  assert.equal(state.scenario.globals.inventedChain, 7);
  assert.equal(state.physical.snapshot.lastStand.titles.length, 0);
  assert.equal(baseNode(state).visible, false);
  assert.equal(baseNode(state).stopped, true);
  assert.equal(state.scenario.play.active, null);
  assert.equal(state.scenario.play.attempts.length, 1);
  assert.equal(state.journey.travel.remaining, 1);
  assert.deepEqual(
    (await (await ok(command(r.host, r.player, c, s))).json()).receipt,
    receipt.receipt,
  );
  assert.deepEqual((await readBackup(r.host)).payload, final);
});

test('failed HTTP test exposes a source-bound sprint and returns to the other owner without a second cost', async (t) => {
  const r = await readyBase(t);
  await reachBase(r);
  await ok(commitBase(r));
  await ok(scenarioInput(r.host, r.player, { kind: 'physical-choice', option: 'reveal' }));
  await ok(scenarioInput(r.host, r.player, { kind: 'physical-choice', option: 'resolve' }));
  const s = await readSession(r.host);
  assert.equal(s.scenario.play.tests[0].successes, 2);
  assert.equal(s.scenario.pending.kind, 'sprint');
  const prior = (await readBackup(r.host)).payload;
  assert.equal(
    (await scenarioInput(r.host, r.other, { kind: 'source-sprint', destinationSpaceId: null }))
      .status,
    403,
  );
  assert.equal(
    (
      await scenarioInput(r.host, r.player, {
        kind: 'source-sprint',
        destinationSpaceId: 'foreign-space',
      })
    ).status,
    409,
  );
  assert.equal(
    (await scenarioInput(r.host, r.player, { kind: 'choice', event: 'LEAVE' })).status,
    409,
  );
  assert.deepEqual((await readBackup(r.host)).payload, prior);
  const id = randomUUID();
  const a = await ok(
    scenarioInput(
      r.host,
      r.player,
      { kind: 'source-sprint', destinationSpaceId: null },
      { requestId: id },
      s,
    ),
  );
  assert.deepEqual(
    await (
      await ok(
        scenarioInput(
          r.host,
          r.player,
          { kind: 'source-sprint', destinationSpaceId: null },
          { requestId: id },
          s,
        ),
      )
    ).json(),
    await a.json(),
  );
  const final = await readSession(r.host);
  assert.equal(final.scenario.play.active, null);
  assert.equal(final.scenario.globals.inventedChain, 7);
  assert.equal(final.round.heroes[0].actionsUsed, 2);
  assert.equal(final.journey.travel.remaining, 1);
  assert.equal(baseNode(final).visible, false);
});

test('the full optional sprint continuation gates missing exploration before any cost or cards; unknown input blocks startup', async (t) => {
  const r = await readyBase(t, {
    unexploredNeighbor: true,
    edit: (p, frozen) => {
      const projection = frozen.mapGeneration.projection,
        assignment = projection.assignments.find(
          (a) => a.prefab.source === p.manifest.baseProducts.prefab,
        ),
        adjacent = projection.movementGraph.edges.flatMap((e) =>
          e.a === assignment.spaceId ? [e.b] : e.b === assignment.spaceId ? [e.a] : [],
        ),
        start = projection.sections.find((s) => s.id === 0).tiles[0].source,
        missing = projection.spaces.find((s) => adjacent.includes(s.id) && s.tileSource !== start);
      assert.ok(missing, 'invented map must expose an unexplored sprint destination');
      p.manifest.exploration.tiles = p.manifest.exploration.tiles.filter(
        (t) => t.source !== missing.tileSource,
      );
    },
  });
  await reachBase(r);
  const before = (await readBackup(r.host)).payload;
  const reply = await commitBase(r);
  assert.equal(reply.status, 409);
  assert.match((await reply.json()).error.code, /SPRINT|CONTINUATION/);
  assert.deepEqual((await readBackup(r.host)).payload, before);
  const bad = await prepareBase(t, {
    edit: (p) => p.manifest.baseProducts.ownedProductIds.push(987),
  });
  const old = (await readBackup(bad.host)).payload;
  assert.equal(
    (
      await startScenario(bad.host, bad.player, {
        packFingerprint: hash(bad.pack),
        projectionFingerprint: bad.frozen.mapGeneration.projection.fingerprint,
      })
    ).status,
    409,
  );
  assert.deepEqual((await readBackup(bad.host)).payload, old);
});
