import test from 'node:test';
import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { readyClues, atClue, clueIntent } from './clue-progression-http-helper.mjs';
import { readSession, readBackup, signBackup } from './skill-test-helper.mjs';
import { command } from './preparation-helper.mjs';
import { scenarioInput } from './scenario-helper.mjs';
import { startHost } from './host-helper.mjs';
test('clue cost, cards, event, revelations and return recover packless and reject re-signed gameplay changes', async (t) => {
  const r = await readyClues(t),
    at = await atClue(r),
    intent = clueIntent(at, randomUUID());
  let host = r.host;
  t.after(() => host.stop());
  let response = await command(host, r.player, intent, at);
  assert.equal(response.status, 200, await response.text());
  const origin = (await readBackup(host)).payload.state.physical.cycle.seed;
  for (const path of [
    r.scenarioPath,
    ...['physical-content', 'physical-fronts', 'physical-last-stand'].map((n) =>
      join(host.dataDir, n + '.json'),
    ),
  ])
    await rm(path);
  const stages = [];
  for (let n = 0; n < 16; n++) {
    const before = await readBackup(host),
      s = await readSession(host),
      q = s.scenario.pending;
    stages.push(
      q?.kind === 'physical' ? (s.physical.sourceTest ? 'cards' : 'cost') : (q?.kind ?? 'return'),
    );
    await host.stop('SIGKILL');
    host = await startHost({ LOTR_DATA_DIR: host.dataDir });
    r.host = host;
    assert.deepEqual(
      (await readBackup(host)).payload,
      before.payload,
      'whole payload survives actual process death',
    );
    assert.deepEqual(
      (await readBackup(host)).payload.state.physical.cycle.seed,
      origin,
      'origin remains startup round1/action',
    );
    if (!q) break;
    const input =
      q.kind === 'physical'
        ? {
            kind: 'physical-choice',
            option: s.physical.active.options.some((o) => o.id === 'reveal') ? 'reveal' : 'resolve',
          }
        : { kind: 'ack' };
    response = await scenarioInput(host, r.player, input);
    assert.equal(response.status, 200, await response.text());
  }
  assert.ok(
    stages.includes('cost') &&
      stages.includes('cards') &&
      stages.includes('placement') &&
      stages.includes('exploration-markers') &&
      stages.includes('message') &&
      stages.includes('return'),
    stages.join(','),
  );
  const stable = await readSession(host),
    good = await readBackup(host);
  assert.equal(stable.scenario.globals.clueTotal, 2);
  assert.equal(stable.scenario.play.attempts.at(-1).returned, true);
  for (const edit of [
    (b) => b.payload.state.scenario.globals.clueTotal++,
    (b) => b.payload.state.scenario.play.lore++,
    (b) => b.payload.state.scenario.play.tests[0].successes++,
    (b) =>
      b.payload.state.scenario.events.splice(
        b.payload.state.scenario.events.findIndex((e) => e.event === 'INVENTED_TRACE'),
        1,
      ),
    (b) => (b.payload.state.scenario.tiles.find((t) => !t.explored && t.visible).visible = false),
    (b) => (b.payload.state.scenario.play.attempts.at(-1).returned = false),
    (b) => b.payload.state.physical.snapshot.rngCursor++,
    (b) => (b.payload.state.physical.cycle.seed.round.number = 3),
    (b) =>
      (b.payload.state.scenario.objective.text[0].text =
        'Obiettivo coerentemente risignato ma estraneo'),
  ]) {
    const bad = structuredClone(good);
    edit(bad);
    signBackup(bad);
    const res = await host.request('/api/restores', {
      backup: bad,
      generation: stable.generation,
      expectedRevision: stable.revision,
      confirmed: true,
    });
    assert.equal(res.status, 422, await res.text());
    assert.deepEqual(await readSession(host), stable);
  }
  const retried = await command(host, r.player, intent, at);
  assert.equal(retried.status, 200, await retried.text());
  assert.deepEqual((await readBackup(host)).payload, good.payload);
});
