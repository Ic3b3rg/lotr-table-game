import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readyDeparture,
  confirmedCamp,
  scenarioInput,
  readSession,
  readBackup,
} from './camp-departure-helper.mjs';

test('three real owners depart a confirmed camp reached by the source victory consumer', async (t) => {
  const r = await readyDeparture(t);
  const s = await confirmedCamp(r);
  assert.equal(s.scenario.conclusion.outcome, 'victory');
  assert.equal(
    s.scenario.conclusion.campaign.preparation.heroes.filter((h) => h.confirmedRevision).length,
    3,
  );
  const response = await scenarioInput(r.host, r.player, {
    kind: 'camp-depart',
    offerFingerprint: s.campDeparture?.fingerprint ?? '0'.repeat(64),
    agreed: true,
  });
  assert.equal(response.status, 200, `${await response.text()}\n${r.host.diagnostics()}`);
  const visible = await readSession(r.host),
    privateState = (await readBackup(r.host)).payload.state;
  for (const h of visible.preparation.episode.heroes)
    assert.deepEqual(
      h.copies,
      [...h.copies].sort(),
      'Public lineage must disclose identities without the initial random deck order',
    );
  assert.equal(visible.episodes, undefined);
  assert.ok(!JSON.stringify(visible).includes(privateState.physical.cycle.seed.departure.entropy));
});
