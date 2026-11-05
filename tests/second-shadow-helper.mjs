import assert from 'node:assert/strict';
import { readyRounds, endTurns, finishCycle } from './original-round-helper.mjs';
import { attachFollowup } from './fixtures/shadow-followup.mjs';
import { cycleCommand } from './physical-cycle-helper.mjs';
import { readSession } from './skill-test-helper.mjs';
import { scenarioInput } from './scenario-helper.mjs';
export async function rally(ready) {
  for (const actor of [ready.player, ready.other]) {
    const r = await cycleCommand(ready, 'START_RALLY_SCOUT', {}, actor);
    assert.equal(r.status, 200, await r.text());
    await finishCycle(ready);
  }
  const r = await cycleCommand(ready, 'END_RALLY');
  assert.equal(r.status, 200, await r.text());
}
export async function atSecondShadow(t, edit = () => {}, catalogEdit, frontEdit) {
  const ready = await readyRounds(
    t,
    (pack, frozen) => {
      attachFollowup(pack, frozen);
      edit(pack, frozen);
    },
    catalogEdit,
    frontEdit,
  );
  await endTurns(ready);
  let r = await cycleCommand(ready, 'BEGIN_SHADOW');
  assert.equal(r.status, 200, await r.text());
  r = await cycleCommand(ready, 'CONFIRM_SHADOW_STEP', { step: 'threat' });
  assert.equal(r.status, 200, await r.text());
  await finishCycle(ready);
  await rally(ready);
  await endTurns(ready);
  return ready;
}

export async function answerFollowup(ready, s) {
  s ??= await readSession(ready.host);
  const q = s.scenario.pending;
  const actor =
    [ready.player, ready.other].find((p) => p.body.player.id === q.actorPlayerId) ?? ready.player;
  const active = s.physical.active;
  const input =
    q.kind === 'physical'
      ? {
          kind: 'physical-choice',
          option:
            ['resolve', 'close', 'reveal'].find((id) => active.options.some((o) => o.id === id)) ??
            active.options[0].id,
        }
      : { kind: 'ack' };
  return scenarioInput(ready.host, actor, input);
}
export async function drainFollowup(ready) {
  for (let n = 0; n < 100; n++) {
    const s = await readSession(ready.host);
    if (!s.scenario.pending) return s;
    const r = await answerFollowup(ready, s);
    const body = await r.text();
    assert.equal(r.status, 200, r.status >= 500 ? `${body}\n${ready.host.diagnostics()}` : body);
  }
  assert.fail('source followup did not return');
}
