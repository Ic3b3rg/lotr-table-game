import test from 'node:test';
import assert from 'node:assert/strict';
import { readySearches, reachSearch, commitSearch } from './search-http-helper.mjs';
import { readSession, readBackup } from './skill-test-helper.mjs';

test('a future uncompiled preparation, including the explicit stock57 dependency, gates the entire search before action/cards/RNG', async (t) => {
  for (const capability of ['invented-uncompiled-after-preparation', 'boon-quantities-57']) {
    const r = await readySearches(t, {
      setupPrepare: false,
      edit(pack) {
        const index = pack.preparedEffects.findIndex((p) => p.skillId === 'role-1-skill-3'),
          { skillId, cardHash } = pack.preparedEffects[index];
        // Declared before startup. The full candidate population stays in the deck.
        pack.preparedEffects[index] = {
          skillId,
          cardHash,
          effect: 'requires-capability',
          capability,
        };
      },
    });
    await reachSearch(r, 'challenge');
    const before = (await readBackup(r.host)).payload,
      view = await readSession(r.host),
      response = await commitSearch(r, 'challenge'),
      body = await response.json();
    assert.equal(response.status, 409);
    assert.equal(body.error.code, 'SCENARIO_PHYSICAL_CAPABILITY');
    assert.ok(body.error.message.includes(capability));
    assert.deepEqual((await readBackup(r.host)).payload, before);
    assert.deepEqual(await readSession(r.host), view);
    assert.equal(view.scenario.pending, null);
    assert.equal(view.scenario.play.attempts.length, 0);
  }
});
