import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readyScenario, startScenario, scenarioInput } from './scenario-helper.mjs';
import { readSession, readBackup, signBackup } from './skill-test-helper.mjs';
import { catalogFixture } from './fixtures/catalog.mjs';
import { hash } from './fixtures/map-freeze.mjs';
function policy(pack, frozen, effect = 'inspiration') {
  const copy = frozen.preparation.heroes[0].prepared[0],
    id = copy.split(':')[0],
    card = catalogFixture().skills.find((c) => c.id === id);
  pack.preparedEffects = [
    {
      skillId: id,
      cardHash: hash(card),
      ...(effect === 'inspiration'
        ? { effect, amount: 1 }
        : { effect, capability: 'faceup-fear-flip' }),
    },
  ];
}
test('trigger preparato vincolato alla carta: ispirazione once-only nel nuovo contesto fonte', async (t) => {
  const { host, player } = await readyScenario(t, policy),
    requestId = randomUUID();
  const before = await readSession(host);
  assert.equal(before.preparation.heroes[0].inspiration, 0);
  const plan = await (await host.request('/api/scenario-plan')).json();
  const body = {
    type: 'START_SCENARIO',
    requestId,
    generation: before.generation,
    expectedRevision: before.revision,
    packFingerprint: plan.packFingerprint,
    projectionFingerprint: plan.projectionFingerprint,
    agreed: true,
  };
  const r = await host.request('/api/commands', body, player.cookie);
  assert.equal(r.status, 200, await r.text());
  const after = await readSession(host);
  assert.equal(after.preparation.heroes[0].inspiration, 1);
  assert.equal(after.scenario.cardEffects.length, 1);
  assert.equal((await host.request('/api/commands', body, player.cookie)).status, 200);
  assert.deepEqual(await readSession(host), after);
  const original = (await readBackup(host)).payload.commands.find((c) => c.requestId === requestId);
  assert.ok(original);
  const q = after.scenario.pending;
  assert.equal(q.kind, 'message');
  assert.equal((await scenarioInput(host, player, { kind: 'ack' })).status, 200);
  assert.equal((await readSession(host)).preparation.heroes[0].inspiration, 1);
});
for (const mode of ['mismatch', 'physical'])
  test(`prepared trigger ${mode}: gate preciso, nessun effetto parziale`, async (t) => {
    const { host, player } = await readyScenario(t, (p, s) => {
      policy(p, s, mode === 'physical' ? 'requires-capability' : 'inspiration');
      if (mode === 'mismatch') p.preparedEffects[0].cardHash = '0'.repeat(64);
    });
    const before = await readSession(host),
      r = await startScenario(host, player, {
        packFingerprint: 'a'.repeat(64),
        projectionFingerprint: before.mapGeneration.projection.fingerprint,
      });
    assert.equal(r.status, 409, await r.text());
    assert.deepEqual(await readSession(host), before);
  });
