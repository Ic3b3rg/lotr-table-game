import assert from 'node:assert/strict';
import { readyOriginal } from './original-encounter-helper.mjs';
import { attachRounds } from './fixtures/source-rounds.mjs';
import { cycleCommand } from './physical-cycle-helper.mjs';
import { readSession } from './skill-test-helper.mjs';
import { command } from './preparation-helper.mjs';

export function readyRounds(t, edit = () => {}, catalogEdit, frontEdit) {
  return readyOriginal(
    t,
    (pack, frozen) => {
      attachRounds(pack, frozen.mapGeneration.projection);
      edit(pack, frozen);
    },
    catalogEdit,
    frontEdit,
  );
}
export function actorFor(ready, playerId) {
  return [ready.player, ready.other].find((p) => p?.body.player.id === playerId);
}
export async function answerCycle(ready, input, at, actor) {
  const s = at ?? (await readSession(ready.host)),
    q = s.physical.cycle.pending;
  const { type: _, ...binding } = q;
  return command(
    ready.host,
    actor ?? actorFor(ready, s.physical.active.actorPlayerId),
    {
      type: 'CYCLE_INPUT',
      ...binding,
      input,
    },
    s,
  );
}
export async function finishCycle(ready) {
  for (let n = 0; n < 150; n++) {
    const s = await readSession(ready.host),
      q = s.physical.active;
    if (!q) return s;
    const input =
      q.mode === 'scout'
        ? {
            kind: 'physical-scout',
            prepare: null,
            top: q.options.map((o) => o.id),
            bottom: [],
            discard: null,
          }
        : q.mode === 'allocate'
          ? { kind: 'physical-allocate', ability: q.ability ?? null, damage: 0, fear: 0 }
          : {
              kind: 'physical-choice',
              option:
                ['close-rest', 'resolve', 'close', 'reveal'].find((id) =>
                  q.options.some((o) => o.id === id),
                ) ?? q.options[0].id,
            };
    const r = await answerCycle(ready, input);
    assert.equal(r.status, 200, await r.text());
  }
  assert.fail('ordinary phase child did not finish');
}
export async function endTurns(ready) {
  const s = await readSession(ready.host);
  for (const h of s.preparation.heroes) {
    const at = await readSession(ready.host);
    if (at.round.heroes.find((p) => p.heroId === h.heroId).turnEnded) continue;
    const actor = actorFor(ready, h.playerId);
    for (const type of at.round.activeHeroId === h.heroId
      ? ['END_TURN']
      : ['START_TURN', 'END_TURN']) {
      const r = await cycleCommand(ready, type, { heroId: h.heroId }, actor);
      assert.equal(r.status, 200, await r.text());
      await finishCycle(ready);
    }
  }
  return readSession(ready.host);
}
