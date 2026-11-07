import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { interactionIntent, chooseBefore } from './interaction-look-helper.mjs';
import { state, action, text } from './fixtures/scenario.mjs';
import {
  readyLook,
  reachLook,
  interact,
  readSession,
  readBackup,
  scenarioInput,
  ok,
} from './interaction-look-helper.mjs';

test('real three-owner A1 confirmation looks and rewards before the source callback', async (t) => {
  const r = await readyLook(t);
  const before = await reachLook(r),
    original = (await readBackup(r.host)).payload.state;
  assert.equal(before.players.length, 3);
  await ok(interact(r));
  const waiting = await readSession(r.host);
  assert.equal(waiting.physical.active?.purpose, 'interaction-look');
  assert.equal(
    waiting.preparation.heroes[0].inspiration,
    before.preparation.heroes[0].inspiration + 1,
  );
  assert.equal(waiting.scenario.pending.kind, 'physical');
  const privateState = (await readBackup(r.host)).payload.state;
  assert.deepEqual(privateState.preparation.heroes[0].deck, original.preparation.heroes[0].deck);
  assert.equal(privateState.physical.snapshot.resolution.privateLooks.length, 1);
  assert.equal(privateState.scenario.play.attempts[0].returned, false);
  await ok(scenarioInput(r.host, r.player, { kind: 'physical-choice', option: 'continue' }));
  assert.equal((await readSession(r.host)).scenario.pending.kind, 'message');
  await ok(scenarioInput(r.host, r.player, { kind: 'ack' }));
  const done = (await readBackup(r.host)).payload.state;
  assert.equal(done.scenario.play.attempts[0].returned, true);
  assert.equal(done.round.heroes[0].actionsUsed, original.round.heroes[0].actionsUsed + 1);
  assert.deepEqual(done.journey.travel, original.journey.travel);
});

test('two true interactions in the same round look twice, while exact concurrent retry never farms a reward', async (t) => {
  const r = await readyLook(t, { colocated: true });
  let s = await reachLook(r);
  assert.equal(s.round.heroes[0].actionsUsed, 0);
  const request = interactionIntent(s, r, { requestId: randomUUID() });
  const replies = await Promise.all(
    [0, 1].map(() => r.host.request('/api/commands', request, r.player.cookie)),
  );
  const bodies = await Promise.all(
    replies.map(async (response) => {
      assert.equal(response.status, 200, await response.clone().text());
      return response.json();
    }),
  );
  assert.deepEqual(bodies[0].receipt, bodies[1].receipt);
  const first = (await readBackup(r.host)).payload.state;
  const held = (await readBackup(r.host)).payload;
  const concurrent = await interact(r, r.player, { requestId: randomUUID() });
  assert.equal(concurrent.status, 409);
  assert.deepEqual(
    (await readBackup(r.host)).payload,
    held,
    'an active child cannot be borrowed from or start another look',
  );
  await ok(scenarioInput(r.host, r.player, { kind: 'physical-choice', option: 'continue' }));
  // Reward is already applied but the source has not returned yet.
  const retried = await r.host.request('/api/commands', request, r.player.cookie);
  assert.equal(retried.status, 200);
  assert.deepEqual((await retried.json()).receipt, bodies[0].receipt);
  assert.equal((await readSession(r.host)).scenario.pending.kind, 'message');
  await ok(scenarioInput(r.host, r.player, { kind: 'ack' }));
  await ok(interact(r));
  s = await readSession(r.host);
  assert.equal(s.physical.active.purpose, 'interaction-look');
  const second = (await readBackup(r.host)).payload.state;
  assert.equal(second.physical.snapshot.resolution.privateLooks.length, 2);
  assert.equal(
    second.physical.snapshot.resolution.privateLooks[0].copy,
    second.physical.snapshot.resolution.privateLooks[1].copy,
  );
  assert.equal(
    second.preparation.heroes[0].inspiration,
    first.preparation.heroes[0].inspiration + 1,
  );
  await ok(scenarioInput(r.host, r.player, { kind: 'physical-choice', option: 'continue' }));
  await ok(scenarioInput(r.host, r.player, { kind: 'ack' }));
  const final = await readBackup(r.host);
  assert.equal(final.payload.state.round.heroes[0].actionsUsed, 2);
  assert.equal(final.payload.state.scenario.play.attempts.filter((a) => a.returned).length, 2);
  assert.equal(final.payload.commands.filter((c) => c.requestId === request.requestId).length, 1);
});

test('later confirmations of the same committed source do not trigger another look', async (t) => {
  const r = await readyLook(t, {
    edit(pack) {
      const prefab = pack.manifest.prefabs[0],
        d = pack.definitions.find((d) => d.source === prefab.fsmSource);
      d.states.find((s) => s.index === 21).transitions.FINISHED = 22;
      d.states.push(
        state(
          22,
          [{ ...structuredClone(d.states.find((s) => s.index === 20).actions[0]), index: 0 }],
          { YES: 23, NO: 0 },
        ),
        state(
          23,
          [
            action(0, 'message', {
              mode: 'ordinary',
              text: text('Secondo ritorno inventato'),
              ignoreLog: false,
            }),
          ],
          { FINISHED: 0 },
        ),
      );
    },
  });
  await reachLook(r);
  await ok(interact(r));
  await ok(scenarioInput(r.host, r.player, { kind: 'physical-choice', option: 'continue' }));
  await ok(scenarioInput(r.host, r.player, { kind: 'ack' }));
  assert.equal((await readSession(r.host)).scenario.pending.kind, 'message');
  const saved = (await readBackup(r.host)).payload.state;
  assert.equal(saved.physical.snapshot.resolution.privateLooks.length, 1);
  assert.equal(saved.physical.runs.filter((r) => r.program.interactionBefore === 'once').length, 1);
  assert.equal(
    saved.physical.runs.filter((r) => r.program.interactionBefore === 'already-completed').length,
    1,
  );
  await ok(scenarioInput(r.host, r.player, { kind: 'ack' }));
  assert.equal((await readSession(r.host)).scenario.pending, null);
});

for (const first of ['look', 'spend'])
  test(`actual damage before-cost ${first} order returns with ${first === 'look' ? 5 : 6} inspiration`, async (t) => {
    const r = await readyLook(t, { costs: 1, initialInspiration: 6 });
    const before = await reachLook(r);
    await ok(interact(r));
    assert.equal((await readSession(r.host)).physical.active.purpose, 'interaction-order');
    await chooseBefore(r, first);
    if (first === 'look')
      await ok(scenarioInput(r.host, r.player, { kind: 'physical-choice', option: 'continue' }));
    else await ok(scenarioInput(r.host, r.player, { kind: 'physical-choice', option: 'continue' }));
    const s = await readSession(r.host);
    assert.equal(s.preparation.heroes[0].inspiration, first === 'look' ? 5 : 6);
    assert.equal(s.scenario.pending.kind, 'message');
    await ok(scenarioInput(r.host, r.player, { kind: 'ack' }));
    const done = (await readBackup(r.host)).payload.state;
    assert.equal(done.scenario.play.attempts[0].returned, true);
    assert.deepEqual(done.journey.travel, before.journey.travel);
    assert.equal(done.round.heroes[0].actionsUsed, before.round.heroes[0].actionsUsed + 1);
  });

test('zero plus hidden reward and mandatory damage cost gates uniformly over real HTTP before every mutation', async (t) => {
  const errors = [];
  for (const fate of [0, 1]) {
    const r = await readyLook(t, { fate, costs: 1, initialInspiration: 0 });
    await reachLook(r);
    const before = (await readBackup(r.host)).payload;
    const response = await interact(r);
    assert.equal(response.status, 409);
    errors.push(await response.json());
    assert.equal(errors.at(-1).error.code, 'INTERACTION_HIDDEN_FUNDING');
    assert.deepEqual((await readBackup(r.host)).payload, before);
  }
  assert.deepEqual(errors[0], errors[1]);
});

test('zero with a known guaranteed before-resource can legally pay a damage obligation', async (t) => {
  const r = await readyLook(t, { fate: 0, costs: 1, initialInspiration: 0, guaranteed: true });
  await reachLook(r);
  await ok(interact(r));
  const first = await readSession(r.host);
  const blockedSpend = first.physical.active.options.find((o) => o.id.startsWith('cost:'));
  assert.ok(blockedSpend.unavailable);
  await chooseBefore(r, 'inspiration');
  await chooseBefore(r, 'spend');
  await ok(scenarioInput(r.host, r.player, { kind: 'physical-choice', option: 'continue' }));
  assert.equal((await readSession(r.host)).preparation.heroes[0].inspiration, 0);
  await ok(scenarioInput(r.host, r.player, { kind: 'ack' }));
});

test('wrong actor, source, turn, revision, generation and remote space reject the full actual intent', async (t) => {
  const r = await readyLook(t);
  await ok((await import('./physical-cycle-helper.mjs')).cycleCommand(r, 'START_TURN'));
  const remote = (await readBackup(r.host)).payload;
  const remoteResponse = await interact(r);
  assert.equal(remoteResponse.status, 409);
  assert.equal((await remoteResponse.json()).error.code, 'INTERACTION_SPACE');
  assert.deepEqual((await readBackup(r.host)).payload, remote);
  await reachLook(r);
  const s = await readSession(r.host),
    before = (await readBackup(r.host)).payload;
  for (const [extra, actor, status] of [
    [{}, r.other, 403],
    [{ sourceFingerprint: 'a'.repeat(64) }, r.player, 409],
    [{ turnId: randomUUID() }, r.player, 409],
    [{ expectedRevision: s.revision - 1 }, r.player, 409],
    [{ generation: randomUUID() }, r.player, 409],
    [{ heroId: 'hero-2' }, r.player, 403],
    [{ program: {} }, r.player, 422],
  ]) {
    const response = await r.host.request(
      '/api/commands',
      interactionIntent(s, r, { requestId: randomUUID(), ...extra }),
      actor.cookie,
    );
    assert.equal(response.status, status, await response.clone().text());
    assert.deepEqual((await readBackup(r.host)).payload, before);
  }
});
