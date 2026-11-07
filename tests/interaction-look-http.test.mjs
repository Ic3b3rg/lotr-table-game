import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  readyLook,
  reachLook,
  interact,
  readSession,
  readBackup,
  scenarioInput,
  ok,
} from './interaction-look-helper.mjs';

test('only the authenticated current owner reads the pending look; GET is pure and expires', async (t) => {
  const r = await readyLook(t);
  await reachLook(r);
  await ok(interact(r));
  const s = await readSession(r.host),
    before = await readBackup(r.host);
  const path = `/api/private/looks/${s.scenario.pending.id}?generation=${s.generation}`;
  const response = await r.host.request(path, undefined, r.player.cookie);
  assert.equal(response.status, 200, await response.clone().text());
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('vary'), 'Cookie');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  const body = await response.json();
  assert.equal(body.heroId, 'hero-1');
  assert.equal(body.card.fate, 1);
  assert.equal(body.reward, 1);
  assert.deepEqual(Object.keys(body.card).sort(), ['fate', 'name', 'success', 'text']);
  assert.equal((await r.host.request(path)).status, 401);
  for (const actor of [r.other, r.third])
    assert.equal((await r.host.request(path, undefined, actor.cookie)).status, 403);
  assert.equal((await r.host.request(path, undefined, 'lotr-seat=spoof.signature')).status, 401);
  assert.equal(
    (await r.host.request(path + `&playerId=${r.player.body.player.id}`, undefined, r.other.cookie))
      .status,
    403,
  );
  assert.equal(
    (await r.host.request(path.replace(s.generation, randomUUID()), undefined, r.player.cookie))
      .status,
    409,
  );
  assert.equal(
    (
      await r.host.request(
        path.replace(s.scenario.pending.id, randomUUID()),
        undefined,
        r.player.cookie,
      )
    ).status,
    409,
  );
  assert.deepEqual(await (await r.host.request(path, undefined, r.player.cookie)).json(), body);
  assert.deepEqual((await readBackup(r.host)).payload, before.payload);
  await ok(scenarioInput(r.host, r.player, { kind: 'physical-choice', option: 'continue' }));
  assert.equal((await r.host.request(path, undefined, r.player.cookie)).status, 409);
});
