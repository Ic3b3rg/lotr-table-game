import assert from 'node:assert/strict';
import { readyRounds } from './original-round-helper.mjs';
import { attachFailure } from './fixtures/adventure-failure.mjs';
import { cycleCommand } from './physical-cycle-helper.mjs';
import { playable, interact, finishPhysical } from './original-encounter-helper.mjs';
import { scenarioInput } from './scenario-helper.mjs';
import { readSession } from './skill-test-helper.mjs';
export async function ok(p) {
  const r = await p;
  assert.equal(r.status, 200, await r.text());
  return r;
}
export function readyFailure(t, edit = () => {}, catalogEdit = () => {}) {
  return readyRounds(
    t,
    (pack, frozen) => {
      attachFailure(pack);
      const d = pack.definitions.find((d) => d.source === pack.manifest.prefabs[0].fsmSource);
      d.states.find((s) => s.index === 31).actions[0].consequence = {
        family: 'fear',
        amount: 2,
        face: 'faceup',
      };
      edit(pack, frozen);
    },
    (c) => {
      for (const s of c.skills) {
        s.success = 1;
        s.fate = 0;
      }
      for (const h of c.heroes) h.stats.fear = 1;
      catalogEdit(c);
    },
    (ir) => {
      for (const d of ir.definitions.filter((d) => /fear/.test(d.cardId)))
        d.body = [{ op: 'keep-faceup' }];
    },
  );
}
export async function defeatHero(r, actor = r.player) {
  let s = await readSession(r.host),
    h = s.preparation.heroes.find((h) => h.playerId === actor.body.player.id);
  await ok(cycleCommand(r, 'START_TURN', {}, actor));
  await ok(cycleCommand(r, 'START_TRAVEL', {}, actor));
  s = await readSession(r.host);
  const i = playable(s),
    to = s.scenario.spaceBindings.find((b) => b.sourceId === i.spaceId).id;
  const from = s.journey.heroes.find((p) => p.heroId === h.heroId).spaceId;
  if (from !== to)
    await ok(cycleCommand(r, 'MOVE_HERO', { fromSpaceId: from, destinationSpaceId: to }, actor));
  await ok(interact(r, actor));
  s = await finishPhysical(r);
  assert.equal(s.scenario.pending.kind, 'choice');
  await ok(
    scenarioInput(r.host, actor, { kind: 'choice', event: actor === r.player ? 'COUNT' : 'OTHER' }),
  );
  s = await finishPhysical(r);
  assert.equal(s.physical.lastStand.heroes.find((x) => x.heroId === h.heroId).defeated, true);
  return s;
}
