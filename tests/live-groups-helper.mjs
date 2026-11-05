// Invented pre-startup fixture. Every subsequent state transition uses HTTP commands.
import { readyRounds, endTurns, answerCycle, actorFor } from './original-round-helper.mjs';
import { attachFollowup } from './fixtures/shadow-followup.mjs';
import { attachFailure } from './fixtures/adventure-failure.mjs';
import { attachLiveGroups } from './fixtures/live-groups.mjs';
import { sourceCatalog } from './original-encounter-helper.mjs';
import { readSession } from './skill-test-helper.mjs';
import { scenarioInput } from './scenario-helper.mjs';
import assert from 'node:assert/strict';
export function readyLiveGroups(t, { defeated = 0, edit = () => {} } = {}) {
  return readyRounds(
    t,
    (pack, frozen) => {
      attachFollowup(pack, frozen);
      attachFailure(pack);
      pack.globals.find((v) => v.name === 'pressure').value = 14;
      pack.manifest.rounds.darkness.amount = 2;
      pack.manifest.rounds.darkness.spaces.forEach((s) => {
        s.hasDarkness = true;
      });
      edit(pack, frozen);
      attachLiveGroups(pack);
    },
    (c) => {
      sourceCatalog(c);
      c.heroes.forEach((h, n) => {
        h.stats.fear = n === defeated ? 1 : 20;
        h.stats.damage = 20;
      });
    },
    (ir) => {
      for (const d of ir.definitions) d.body = [{ op: 'keep-faceup' }];
    },
  );
}
export function physicalInput(q, order = ['0', '1', '2']) {
  return q.mode === 'allocate'
    ? { kind: 'physical-allocate', ability: q.options[0]?.id ?? null, damage: 0, fear: 0 }
    : {
        kind: 'physical-choice',
        option:
          [...order, 'resolve', 'reveal', 'close'].find((id) =>
            q.options.some((o) => o.id === id),
          ) ?? q.options.at(-1).id,
      };
}
export function answerLive(r, s, overrides = {}) {
  const actor = actorFor(r, s.physical.active.actorPlayerId);
  const input = physicalInput(s.physical.active);
  return s.scenario.pending?.kind === 'physical'
    ? scenarioInput(r.host, actor, input, overrides, s)
    : answerCycle(r, input, s, actor);
}
export async function untilLive(r, predicate, observe = () => {}) {
  for (let n = 0; n < 100; n++) {
    const s = await readSession(r.host);
    await observe(s);
    if (predicate(s)) return s;
    assert.ok(s.physical.active, 'expected a physical continuation');
    const q = await answerLive(r, s);
    assert.equal(q.status, 200, await q.text());
  }
  assert.fail('physical continuation did not reach the expected boundary');
}
export { endTurns, actorFor };
