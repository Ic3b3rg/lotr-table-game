import test from 'node:test';
import assert from 'node:assert/strict';
import { readyClues, atClue, clueIntent, finishPhysical } from './clue-progression-http-helper.mjs';
import { readSession, readBackup } from './skill-test-helper.mjs';
import { command } from './preparation-helper.mjs';
import { scenarioInput } from './scenario-helper.mjs';
import { randomUUID } from 'node:crypto';
import { validateScenarioBinding } from '../dist/scenario-library.mjs';
test('a real-card clue costs once, preserves travel and updates the mission and only its due section', async (t) => {
  const r = await readyClues(t),
    at = await atClue(r),
    before = await readBackup(r.host),
    c = clueIntent(at, randomUUID());
  assert.ok(c.sourceFingerprint, 'new clue has a public source-bound command');
  assert.equal((await command(r.host, r.other, c, at)).status, 403);
  const pending = await Promise.all([
    command(r.host, r.player, c, at),
    command(r.host, r.player, c, at),
    command(r.host, r.player, { ...c, requestId: randomUUID() }, at),
  ]);
  assert.deepEqual(pending.map((r) => r.status).sort(), [200, 200, 409]);
  const receipts = await Promise.all(pending.filter((r) => r.status === 200).map((r) => r.json()));
  assert.deepEqual(receipts[0].receipt, receipts[1].receipt);
  let s = await finishPhysical(r);
  assert.equal(
    s.scenario.pending.kind,
    'message',
    'the source reward must be acknowledged before the clue event',
  );
  assert.equal(s.scenario.globals.clueTotal, 3);
  const reward = await scenarioInput(r.host, r.player, { kind: 'ack' });
  assert.equal(reward.status, 200, await reward.text());
  s = await readSession(r.host);
  assert.equal(s.scenario.globals.clueTotal, 2);
  assert.equal(s.scenario.play.lore, 0, 'section placement precedes the mission award');
  assert.equal(s.scenario.objective.id, 0);
  assert.equal(s.scenario.pending.kind, 'placement');
  while (s.scenario.pending) {
    const q = await scenarioInput(r.host, r.player, { kind: 'ack' });
    assert.equal(q.status, 200, await q.text());
    s = await readSession(r.host);
  }
  const end = await readBackup(r.host),
    hero = s.round.heroes.find((h) => h.heroId === c.heroId);
  assert.equal(s.scenario.play.lore, 2);
  assert.equal(s.scenario.objective.id, 8);
  assert.match(s.scenario.objective.text.map((t) => t.text ?? '').join(''), /2/);
  assert.equal(hero.actionsUsed, 2);
  assert.equal(s.journey.travel.remaining, at.journey.travel.remaining);
  assert.equal(s.scenario.instances.find((i) => i.id === c.instanceId).visible, false);
  assert.equal(s.scenario.play.tests.length, 1);
  assert.equal(s.scenario.events.filter((e) => e.event === 'INVENTED_TRACE').length, 1);
  assert.equal(s.scenario.play.attempts.at(-1).returned, true);
  assert.deepEqual(end.payload.state.physical.cycle.seed, before.payload.state.physical.cycle.seed);
  const p = s.mapGeneration.projection;
  assert.ok(
    p.sections
      .find((x) => x.id === 3)
      .tiles.every((t) => s.scenario.tiles.find((v) => v.source === t.source).visible),
  );
  assert.ok(
    p.sections
      .find((x) => x.id === 2)
      .tiles.every((t) => !s.scenario.tiles.find((v) => v.source === t.source).visible),
  );
  const incomplete = structuredClone(s.scenario.pack);
  const futureTile = p.sections.find((section) => section.id === 3).tiles[0].source;
  incomplete.manifest.followup.explorationNodes =
    incomplete.manifest.followup.explorationNodes.filter((n) => n.tileSource !== futureTile);
  assert.throws(
    () => validateScenarioBinding(incomplete, p),
    /esplorazione/i,
    'a missing future marker cannot masquerade as an explored fort',
  );
});
