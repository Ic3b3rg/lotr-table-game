import test from 'node:test';
import assert from 'node:assert/strict';
import { readyBase, reachBase, commitBase, baseNode, ok } from './base-products-http-helper.mjs';
import { scenarioInput } from './scenario-helper.mjs';
import { readSession, readBackup } from './skill-test-helper.mjs';
import { buildSync } from 'esbuild';

const protocol = buildSync({
  stdin: {
    contents: "export { SessionSchema } from './src/shared/protocol';",
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
  target: 'node24',
});
const { SessionSchema } = await import(
  `data:text/javascript;base64,${Buffer.from(protocol.outputFiles[0].contents).toString('base64')}`
);

test('the source sprint explores its full destination and returns from the child to cleanup with travel intact', async (t) => {
  const r = await readyBase(t, { unexploredNeighbor: true });
  await reachBase(r);
  await ok(commitBase(r));
  await ok(scenarioInput(r.host, r.player, { kind: 'physical-choice', option: 'reveal' }));
  await ok(scenarioInput(r.host, r.player, { kind: 'physical-choice', option: 'resolve' }));
  let s = await readSession(r.host);
  assert.equal(s.scenario.pending.kind, 'sprint');
  const here = s.journey.heroes[0].spaceId,
    remaining = s.journey.travel.remaining,
    option = s.scenario.pending.options.find(
      (o) =>
        o.event.startsWith('move:') &&
        s.scenario.tiles.some(
          (t) =>
            !t.explored &&
            s.mapGeneration.projection.spaces.some(
              (c) =>
                c.tileSource === t.source &&
                s.scenario.spaceBindings.some(
                  (b) => b.sourceId === c.id && o.event === `move:${b.id}`,
                ),
            ),
        ),
    );
  assert.ok(option, 'complete, unfiltered destination population includes the unexplored tile');
  const destinationSpaceId = option.event.slice(5),
    before = (await readBackup(r.host)).payload;
  assert.equal(
    (await scenarioInput(r.host, r.other, { kind: 'source-sprint', destinationSpaceId })).status,
    403,
  );
  assert.deepEqual((await readBackup(r.host)).payload, before);
  await ok(scenarioInput(r.host, r.player, { kind: 'source-sprint', destinationSpaceId }));
  s = await readSession(r.host);
  assert.equal(s.scenario.pending.kind, 'exploration-intro');
  assert.deepEqual(SessionSchema.parse(s), s, 'the client accepts the whole live sprint view');
  assert.equal(s.journey.heroes[0].spaceId, destinationSpaceId);
  assert.notEqual(destinationSpaceId, here);
  assert.equal(s.journey.travel.remaining, remaining);
  assert.equal(baseNode(s).visible, true, 'source cleanup waits for the real exploration callback');
  assert.equal(s.scenario.play.attempts[0].returned, false);
  const frame = s.scenario.explorations.attempts[0];
  assert.equal(frame.sprintOrigin.attemptId, s.scenario.play.attempts[0].id);
  assert.equal((await scenarioInput(r.host, r.other, { kind: 'ack' })).status, 403);
  const seen = [];
  for (let n = 0; n < 25; n++) {
    s = await readSession(r.host);
    assert.deepEqual(SessionSchema.parse(s), s);
    const q = s.scenario.pending;
    if (!q) break;
    seen.push(q.kind);
    const actor = q.actorPlayerId === r.other.body.player.id ? r.other : r.player;
    await ok(scenarioInput(r.host, actor, { kind: 'ack' }));
  }
  s = await readSession(r.host);
  assert.deepEqual(SessionSchema.parse(s), s);
  assert.equal(s.scenario.pending, null);
  assert.ok(seen.includes('exploration-outro'));
  assert.equal(s.scenario.explorations.attempts[0].returned, true);
  assert.equal(s.scenario.play.active, null);
  assert.equal(baseNode(s).visible, false);
  assert.equal(baseNode(s).stopped, true);
  assert.equal(s.round.heroes[0].actionsUsed, 2);
  assert.equal(s.journey.travel.remaining, remaining);
  assert.equal(s.scenario.globals.inventedChain, 7);
});
