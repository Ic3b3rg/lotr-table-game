import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { readyRounds, endTurns, answerCycle, finishCycle } from './original-round-helper.mjs';
import { cycleCommand } from './physical-cycle-helper.mjs';
import { command } from './preparation-helper.mjs';
import { readSession, readBackup, signBackup } from './skill-test-helper.mjs';
import { startHost } from './host-helper.mjs';

test('source phase/scouting checkpoints survive SIGKILL and packless restore; replay rejects re-signed history changes', async (t) => {
  const r = await readyRounds(t);
  await endTurns(r);
  let host = r.host;
  t.after(() => host.stop());
  const at = await readSession(host),
    requestId = randomUUID();
  const intent = { type: 'BEGIN_SHADOW', roundId: at.round.id, agreed: true, requestId };
  const responses = await Promise.all([
    command(host, r.player, intent, at),
    command(host, r.player, intent, at),
    command(host, r.other, { ...intent, requestId: randomUUID() }, at),
  ]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 200, 409]);
  const receipts = await Promise.all(
    responses.filter((r) => r.status === 200).map((r) => r.json()),
  );
  assert.deepEqual(receipts[0].receipt, receipts[1].receipt);
  for (const file of [
    r.scenarioPath,
    ...['physical-content.json', 'physical-fronts.json', 'physical-last-stand.json'].map((p) =>
      join(host.dataDir, p),
    ),
  ])
    await rm(file);
  async function restart() {
    const before = await readBackup(host);
    await host.stop('SIGKILL');
    host = await startHost({ LOTR_DATA_DIR: host.dataDir });
    r.host = host;
    assert.deepEqual((await readBackup(host)).payload, before.payload);
    return before;
  }
  async function restore(backup) {
    const stable = await readSession(host);
    return host.request('/api/restores', {
      backup,
      generation: stable.generation,
      expectedRevision: stable.revision,
      confirmed: true,
    });
  }
  async function roundtrip() {
    const before = await restart();
    const res = await restore(before);
    assert.equal(res.status, 200, await res.text());
    const after = await readBackup(host);
    for (const key of Object.keys(before.payload.state).filter(
      (k) => !['generation', 'revision', 'updatedAt'].includes(k),
    ))
      assert.deepEqual(after.payload.state[key], before.payload.state[key], key);
    assert.deepEqual(after.payload.commands, before.payload.commands);
    for (const actor of [r.player, r.other]) {
      const recovered = await host.request('/api/recover', {
        recoveryCode: actor.recoveryCode,
        generation: after.payload.state.generation,
      });
      assert.equal(recovered.status, 200);
      actor.cookie = recovered.headers.get('set-cookie').split(';')[0];
    }
    return after;
  }
  await roundtrip(); // threat presentation, before its real delta/reset
  assert.equal((await cycleCommand(r, 'CONFIRM_SHADOW_STEP', { step: 'threat' })).status, 200);
  await roundtrip(); // decks reset, no hero has scouted
  assert.equal((await cycleCommand(r, 'START_RALLY_SCOUT')).status, 200);
  const pending = await roundtrip(); // real revealed cards and current physical request
  let s = await readSession(host),
    q = s.physical.active;
  const input = {
    kind: 'physical-scout',
    prepare: null,
    top: q.options.slice(0, 1).map((o) => o.id),
    bottom: q.options
      .slice(1)
      .reverse()
      .map((o) => o.id),
    discard: null,
  };
  const before = await readBackup(host);
  assert.equal((await answerCycle(r, input, s, r.other)).status, 403);
  assert.deepEqual((await readBackup(host)).payload, before.payload);
  assert.equal((await cycleCommand(r, 'END_RALLY')).status, 409);
  const id = randomUUID(),
    binding = { ...s.physical.cycle.pending };
  delete binding.type;
  const answer = { type: 'CYCLE_INPUT', ...binding, input, requestId: id };
  const a = await command(host, r.player, answer, s);
  assert.equal(a.status, 200, await a.text());
  assert.equal((await command(host, r.player, answer, s)).status, 200);
  assert.equal(
    (await command(host, r.player, { ...answer, requestId: randomUUID() }, s)).status,
    409,
  );
  await finishCycle(r);
  await roundtrip(); // between different owners
  assert.equal((await cycleCommand(r, 'START_RALLY_SCOUT')).status, 409);
  assert.equal((await cycleCommand(r, 'START_RALLY_SCOUT', {}, r.other)).status, 200);
  await finishCycle(r);
  const complete = await roundtrip(); // all owners done, before new round
  for (const edit of [
    (b) => b.payload.state.scenario.globals.pressure++,
    (b) => b.payload.state.scenario.instances.find((i) => i.kind === 'timer').variables.remaining++,
    (b) => b.payload.state.scenario.rounds.frames[0].threat.delta++,
    (b) => b.payload.state.scenario.events.pop(),
    (b) => b.payload.state.physical.cycle.seed.round.number++,
    (b) => {
      const x = b.payload.state;
      x.scenario.globals.pressure++;
      x.scenario.rounds.frames[0].threat.after++;
      x.scenario.rounds.frames[0].threat.delta++;
    },
    (b) => {
      const x = b.payload.state;
      const ids = new Set(
        x.physical.cycle.records
          .filter((r) =>
            ['BEGIN_SHADOW', 'CONFIRM_SHADOW_STEP', 'START_RALLY_SCOUT', 'CYCLE_INPUT'].includes(
              r.intent.type,
            ),
          )
          .map((r) => r.requestId),
      );
      x.physical.cycle.records = x.physical.cycle.records.filter((r) => !ids.has(r.requestId));
      b.payload.commands = b.payload.commands.filter((r) => !ids.has(r.requestId));
    },
    (b) => {
      const h = b.payload.state.preparation.heroes[0];
      [h.deck[0], h.deck[1]] = [h.deck[1], h.deck[0]];
    },
  ]) {
    const bad = structuredClone(complete);
    edit(bad);
    signBackup(bad);
    const res = await restore(bad);
    assert.equal(res.status, 422, await res.text());
    assert.deepEqual((await readBackup(host)).payload, complete.payload);
  }
  assert.equal((await cycleCommand(r, 'END_RALLY')).status, 200);
  const next = await roundtrip(); // round2/Azione
  assert.equal(next.payload.state.round.number, 2);
  assert.deepEqual(
    next.payload.state.physical.cycle.seed,
    pending.payload.state.physical.cycle.seed,
  );
  assert.equal((await cycleCommand(r, 'START_TURN', {}, r.other)).status, 200);
  s = await readSession(host);
  assert.ok(s.preparation.heroes.every((h) => !('deck' in h) && !('discard' in h)));
  assert.equal(s.physical.active, null);
});
