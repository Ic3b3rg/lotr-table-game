import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import {
  readyDeparture,
  confirmedCamp,
  readBackup,
  readSession,
  scenarioInput,
  ok,
} from './camp-departure-helper.mjs';
import { signBackup } from './skill-test-helper.mjs';
import { runtime } from './camp-departure-runtime.mjs';
import { hash } from './fixtures/map-freeze.mjs';

test('signed archive, boundary, cleanup, entropy, composition and paired histories cannot replace source replay', async (t) => {
  const r = await readyDeparture(t, {
      edit(pack) {
        pack.globals.push({ name: 'inventedCumulative', type: 'int', value: 11 });
      },
    }),
    camp = await confirmedCamp(r),
    before = await readBackup(r.host);
  await ok(
    scenarioInput(r.host, r.player, {
      kind: 'camp-depart',
      offerFingerprint: camp.campDeparture.fingerprint,
      agreed: true,
    }),
  );
  const stable = await readBackup(r.host),
    at = await readSession(r.host);
  const reject = async (backup, label) => {
    signBackup(backup);
    const result = await r.host.request('/api/restores', {
      backup,
      generation: at.generation,
      expectedRevision: at.revision,
      confirmed: true,
    });
    assert.equal(result.status, 422, `${label}: ${(await result.text()).slice(0, 300)}`);
    assert.deepEqual((await readBackup(r.host)).payload, stable.payload);
  };
  const dropReceipt = (backup, predicate) => {
    const index = backup.payload.commands.findIndex(predicate);
    assert.ok(index >= 0, 'The targeted mandatory source receipt must exist');
    backup.payload.commands.splice(index, 1);
  };
  for (const [label, edit] of [
    ['archive global', (b) => b.payload.state.episodes[0].scenario.globals.inventedCumulative++],
    [
      'boundary entropy',
      (b) => (b.payload.state.physical.cycle.seed.departure.entropy = 'f'.repeat(64)),
    ],
    [
      'realization pin',
      (b) =>
        (b.payload.state.physical.cycle.seed.departure.receipt.realizationFingerprint = '0'.repeat(
          64,
        )),
    ],
    ['active deck order', (b) => b.payload.state.preparation.heroes[0].deck.reverse()],
    ['personal reset', (b) => b.payload.state.preparation.heroes[0].inspiration++],
    [
      'kernel reset',
      (b) =>
        b.payload.state.physical.snapshot.resolution.resources.preparation.heroes[0].inspiration++,
    ],
    ['active command', (b) => b.payload.state.scenario.commands.pop()],
    ['A1 start receipt', (b) => dropReceipt(b, (c) => c.receipt.type === 'START_SCENARIO')],
    [
      'departure receipt',
      (b) => {
        const boundary = b.payload.state.physical.cycle.seed.departure;
        dropReceipt(
          b,
          (c) => c.playerId === boundary.playerId && c.requestId === boundary.requestId,
        );
      },
    ],
    ['round origin', (b) => (b.payload.state.physical.cycle.seed.round.number = 999)],
    [
      'unowned title',
      (b) =>
        b.payload.state.physical.episode.titles.push({
          heroId: 'hero-1',
          cardId: 'invented',
          copy: 'invented:1',
          removed: false,
          pending: false,
          source: 'invented',
        }),
    ],
  ]) {
    const bad = structuredClone(stable);
    edit(bad);
    await reject(bad, label);
  }
  // Rebuild every A2 origin, deck, resource, hash and boundary receipt from each
  // coherently edited A1 output/ledger. A hash-only boundary would accept these.
  for (const edit of [
    (s) => {
      s.scenario.globals.inventedCumulative++;
      s.physical.cycle.seed.scenario.globals.inventedCumulative++;
    },
    (s) => {
      s.round.number = 999;
      s.physical.cycle.seed.round.number = 999;
    },
  ]) {
    const bad = structuredClone(before),
      s = bad.payload.state;
    edit(s);
    const q = s.scenario.pending,
      actor = {
        playerId: r.player.body.player.id,
        requestId: randomUUID(),
        pendingId: q.id,
        sourceFingerprint: q.fingerprint,
      };
    const input = {
      kind: 'camp-depart',
      offerFingerprint: runtime.campDepartureOffer(s).fingerprint,
      agreed: true,
    };
    const intent = runtime.CommandSchema.parse({
      type: 'SCENARIO_INPUT',
      requestId: actor.requestId,
      generation: s.generation,
      expectedRevision: s.revision,
      scenarioId: s.scenario.id,
      packFingerprint: s.scenario.packFingerprint,
      projectionFingerprint: s.scenario.projectionFingerprint,
      pendingId: q.id,
      sourceFingerprint: q.fingerprint,
      heroId: null,
      input,
    });
    const { requestId, generation, ...fingerprinted } = intent;
    const departure = runtime.beginCampDeparture(
      s,
      actor,
      input,
      s.scenario.pack.manifest.campDeparture,
      () => stable.payload.state.physical.cycle.seed.departure.entropy,
    );
    s.revision++;
    bad.payload.commands.push({
      playerId: actor.playerId,
      requestId,
      fingerprint: createHash('sha256').update(JSON.stringify(fingerprinted)).digest('hex'),
      receipt: {
        requestId,
        type: 'SCENARIO_INPUT',
        appliedRevision: s.revision,
        scenarioId: s.scenario.id,
        pendingId: q.id,
        source: q.fingerprint,
        kind: 'camp-depart',
        phase: 'setup',
        departure,
      },
    });
    bad.payload.commands.sort(
      (a, b) => a.playerId.localeCompare(b.playerId) || a.requestId.localeCompare(b.requestId),
    );
    assert.equal(hash(s.episodes[0]), s.physical.cycle.seed.departure.archiveFingerprint);
    assert.equal(hash(s.scenario.pack.manifest.battleStartup), departure.sourceFingerprint);
    assert.deepEqual(s.physical.cycle.seed.departure.receipt, departure);
    assert.throws(
      () => runtime.validateEpisodeState(s),
      'Coherent outputs must still derive from the unchanged A1 source',
    );
    await reject(bad, 'coherently rebuilt paired histories');
  }
});
