import test from 'node:test';
import assert from 'node:assert/strict';
import { materializeCampDecks } from '../dist/camp-decks-library.mjs';
import { projectCampDeckSource } from '../dist/scenario-library.mjs';
import {
  readyDeparture,
  confirmedCamp,
  scenarioInput,
  readSession,
  readBackup,
  ok,
  finishSetup,
} from './camp-departure-helper.mjs';

test('a real three-owner loss returns all physical harm and appends one certified weakness per owner after Scout3', async (t) => {
  const r = await readyDeparture(t, { outcome: 'loss' }),
    camp = await confirmedCamp(r);
  assert.equal(camp.scenario.conclusion.outcome, 'failure');
  assert.ok(camp.physical.lastStand.heroes.some((h) => h.defeated));
  const before = (await readBackup(r.host)).payload.state;
  await ok(
    scenarioInput(r.host, r.player, {
      kind: 'camp-depart',
      offerFingerprint: camp.campDeparture.fingerprint,
      agreed: true,
    }),
  );
  await finishSetup(r);
  const after = (await readBackup(r.host)).payload.state,
    s = await readSession(r.host),
    cap = before.scenario.pack.manifest.campDeparture,
    seed = after.physical.cycle.seed.departure.entropy;
  const artifact = materializeCampDecks(projectCampDeckSource(before, cap), { seed });
  assert.equal(s.scenario.phase, 'action');
  assert.equal(s.scenario.completedSetup.length, 3);
  assert.ok(
    after.physical.snapshot.areas.every((h) => h.damage.length === 0 && h.fear.length === 0),
  );
  assert.ok(
    after.physical.snapshot.lastStand.heroes.every((h) => !h.defeated && h.difficulty === 1),
  );
  assert.equal(after.physical.snapshot.lastStand.selections.length, 0);
  assert.equal(
    after.scenario.battle.campaign.lastStandsFailed,
    before.physical.snapshot.lastStand.selections.filter((s) => s.outcome === 'fail').length,
  );
  assert.deepEqual(after.episodes[0].physical, before.physical);
  for (const [n, h] of after.preparation.heroes.entries())
    assert.equal(h.deck[0], artifact.materialized.weaknessPool.reserve[n]);
  assert.equal(after.preparation.weaknessDeck.length, 14);
  assert.equal(after.scenario.battle.campaign.lore, before.scenario.play.lore + 2);
  const weak = after.preparation.heroes
    .flatMap((h) => [...h.deck, ...h.prepared, ...h.discard])
    .filter((c) => c.startsWith('weak-'))
    .concat(after.preparation.weaknessDeck);
  assert.equal(new Set(weak).size, 20);
  assert.equal(weak.length, 20);
});
