import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readyDeparture, confirmedCamp, readBackup } from './camp-departure-helper.mjs';
import { runtime } from './camp-departure-runtime.mjs';
import { validatePhysical, openPhysical } from '../dist/physical-resolution-library.mjs';

test('resource/kernel projection retains every explicitly owned later-campaign copy above56 and restores removed titles', async (t) => {
  const r = await readyDeparture(t);
  await confirmedCamp(r);
  const s = (await readBackup(r.host)).payload.state,
    c = s.scenario.conclusion.campaign,
    cap = s.scenario.pack.manifest.campDeparture,
    h = c.heroes[0];
  // Technical later-campaign ownership fixture, not a playable or valid A1 history:
  // a first camp cannot earn all54 upgrades. Source replay must still reject it.
  const purchases = cap.deckCatalog.cards
    .filter((c) => c.kind === 'purchased')
    .flatMap((c) => c.copies);
  h.skillCopies.push(...purchases);
  const title = cap.campaignSkills.find((c) => c.kind === 'title'),
    copy = title.id + ':1';
  h.titleCopies.push(copy);
  const oldTitle = {
    heroId: h.heroId,
    cardId: title.id,
    copy,
    removed: true,
    pending: false,
    source: 'invented-later-campaign-ownership',
  };
  s.physical.snapshot.lastStand = {
    version: 1,
    algorithm: 'sha256-last-stand-counter-rejection-v1',
    heroes: s.preparation.heroes.map((h) => ({ heroId: h.heroId, difficulty: 1, defeated: false })),
    titles: [oldTitle],
    selections: [],
    random: [],
    rngCursor: 0,
    lossDue: null,
    terminal: null,
    test: null,
  };
  runtime.refreshCampPreparation(s);
  for (const choice of c.preparation.heroes) choice.confirmedRevision = s.revision;
  const q = s.scenario.pending,
    actor = {
      playerId: r.player.body.player.id,
      requestId: randomUUID(),
      pendingId: q.id,
      sourceFingerprint: q.fingerprint,
    },
    offer = runtime.campDepartureOffer(s);
  assert.equal(offer.available, true, offer.reason);
  runtime.beginCampDeparture(
    s,
    actor,
    { kind: 'camp-depart', offerFingerprint: offer.fingerprint, agreed: true },
    cap,
    () => 'b'.repeat(64),
  );
  const hero = s.preparation.heroes[0],
    all = [...hero.prepared, ...hero.deck, ...hero.discard];
  assert.ok(hero.deck.length > 56);
  assert.equal(new Set(all).size, all.length);
  for (const owned of [...purchases, copy]) assert.ok(all.includes(owned));
  assert.equal(s.physical.episode.titles[0].removed, false);
  assert.equal(s.episodes[0].physical.snapshot.lastStand.titles[0].removed, true);
  assert.throws(
    () => runtime.validateEpisodeState(s),
    'Technical ownership is never accepted as native A1 source history',
  );
  const p = s.physical,
    program = {
      profile: 'source-fronts-v1',
      startupRules: 'source-startup-preparation-v1',
      initialCredits: p.heroes.map(() => 0),
      limits: p.heroes.map(() => ({ kind: 'requires-capability', capability: 'source-derived' })),
      darknessHeroes: [],
      children: [{ kind: 'rally-reset', hero: 0 }],
    };
  const context = structuredClone(p.snapshot.resolution.resources),
    run = openPhysical(
      p,
      {
        effectId: 'invented-later-campaign-shuffle',
        instanceId: 'invented',
        state: 0,
        entry: 0,
        action: 0,
        parameterHash: 'a'.repeat(64),
      },
      program,
      context,
    );
  assert.equal(p.snapshot.parents.find((r) => r.id === run).status, 'completed');
  const after = p.snapshot.resolution.resources.preparation.heroes[0];
  assert.deepEqual([...after.deck].sort(), [...hero.deck].sort());
  assert.doesNotThrow(() => validatePhysical(p));
});
