import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readyLook,
  reachLook,
  interact,
  readSession,
  readBackup,
  scenarioInput,
  ok,
  interactionIntent,
} from './interaction-look-helper.mjs';
import { randomUUID } from 'node:crypto';

test('look card, reward result and history stay private across common replies, continuation and source return', async (t) => {
  const r = await readyLook(t);
  const before = await reachLook(r);
  const intent = interactionIntent(before, r, { requestId: randomUUID() });
  const response = await ok(r.host.request('/api/commands', intent, r.player.cookie));
  const result = await response.json(),
    state = (await readBackup(r.host)).payload.state;
  const privateResult = state.physical.snapshot.resolution.privateLooks[0];
  const card = state.content.skills.find((c) => c.id === privateResult.skillId);
  const check = (value) => {
    const encoded = JSON.stringify(value);
    for (const key of ['privateLooks', 'interactionWindow', 'skillId', 'look-reset'])
      assert.equal(encoded.includes(key), false, key);
    assert.equal(encoded.includes(card.name.text), false, 'no looked-card name correlation');
    assert.equal(encoded.includes('entropy'), false);
  };
  check(result);
  check(await readSession(r.host));
  for (const actor of [undefined, r.other, r.third]) {
    const publicReply = await r.host.request('/api/session', undefined, actor?.cookie);
    assert.deepEqual(await publicReply.json(), result.session);
  }
  const reply = await ok(
    scenarioInput(r.host, r.player, { kind: 'physical-choice', option: 'continue' }),
  );
  check(await reply.json());
  await ok(scenarioInput(r.host, r.player, { kind: 'ack' }));
  check(await readSession(r.host));
  const final = (await readBackup(r.host)).payload.state;
  assert.equal(
    final.physical.snapshot.resolution.history.some((h) => h.active.purpose === 'interaction-look'),
    true,
  );
  assert.equal(final.physical.snapshot.resolution.privateLooks.length, 1);
});

test('recovering another seat cannot read a previous owner look and recovery never changes domain', async (t) => {
  const r = await readyLook(t);
  await reachLook(r);
  await ok(interact(r));
  const s = await readSession(r.host),
    before = (await readBackup(r.host)).payload;
  const response = await r.host.request(
    '/api/recover',
    { recoveryCode: r.other.recoveryCode, generation: s.generation },
    r.player.cookie,
  );
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie').split(';')[0];
  assert.equal(
    (
      await r.host.request(
        `/api/private/looks/${s.scenario.pending.id}?generation=${s.generation}`,
        undefined,
        cookie,
      )
    ).status,
    403,
  );
  assert.deepEqual((await readBackup(r.host)).payload, before);
});
