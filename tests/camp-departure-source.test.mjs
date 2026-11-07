import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readyDeparture, confirmedCamp, readBackup } from './camp-departure-helper.mjs';
import { runtime } from './camp-departure-runtime.mjs';
import { hash } from './fixtures/map-freeze.mjs';

export const actorAt = (s) => ({
  playerId: s.players[0].id,
  requestId: randomUUID(),
  pendingId: s.scenario.pending.id,
  sourceFingerprint: s.scenario.pending.fingerprint,
});
test('departure preflight rejects every stale or unattested prerequisite before entropy or any state change', async (t) => {
  const r = await readyDeparture(t),
    camp = await confirmedCamp(r),
    original = (await readBackup(r.host)).payload.state;
  const rejected = (edit, overrides = {}) => {
    const state = structuredClone(original);
    edit(state);
    const before = structuredClone(state),
      actor = { ...actorAt(state), ...overrides.actor },
      input = {
        kind: 'camp-depart',
        offerFingerprint: runtime.campDepartureOffer(state).fingerprint ?? '0'.repeat(64),
        agreed: true,
        ...overrides.input,
      };
    let calls = 0;
    assert.throws(() =>
      runtime.beginCampDeparture(
        state,
        actor,
        input,
        overrides.source ?? state.scenario.pack.manifest.campDeparture,
        () => {
          calls++;
          return 'd'.repeat(64);
        },
      ),
    );
    assert.equal(calls, 0, 'Rejected preflight must never ask the host for entropy');
    assert.deepEqual(state, before, 'Rejected preflight must preserve the whole game');
  };
  for (const [name, edit] of [
    ['missing prospective capability', (s) => delete s.scenario.pack.manifest.campDeparture],
    [
      'unknown quantities57',
      (s) => {
        s.scenario.pack.manifest.campDeparture.quantities = {
          status: 'unverified',
          values: [null, null, null],
        };
      },
    ],
    [
      'unconfirmed owner',
      (s) => {
        s.scenario.conclusion.campaign.preparation.heroes[1].confirmedRevision = null;
      },
    ],
    [
      'changed confirmed recipe',
      (s) => {
        s.scenario.conclusion.campaign.preparation.heroes[0].summaryHash = '0'.repeat(64);
      },
    ],
    [
      'missing conserved weakness',
      (s) => {
        s.preparation.weaknessDeck.pop();
      },
    ],
    [
      'missing window on any possible prepared card',
      (s) => {
        s.scenario.pack.manifest.campDeparture.windows =
          s.scenario.pack.manifest.campDeparture.windows.filter((w) => w.cardId !== 'basic-1');
      },
    ],
    [
      'requires-content skill',
      (s) => {
        s.scenario.pack.manifest.campDeparture.windows.find((w) => w.cardId === 'basic-1').prepare =
          'requires-content';
      },
    ],
    [
      'unattested physical fronts',
      (s) => {
        s.scenario.pack.manifest.campDeparture.frontsFingerprint = '0'.repeat(64);
      },
    ],
    [
      'wrong target',
      (s) => {
        s.scenario.conclusion.nextAdventureId = 99;
      },
    ],
    [
      'missing board anchor',
      (s) => {
        s.scenario.pack.manifest.campDeparture.instructions[2].anchor = 'absent';
      },
    ],
  ])
    await t.test(name, () => rejected(edit));
  await t.test('actor outside the live company', () =>
    rejected(() => {}, { actor: { playerId: randomUUID() } }),
  );
  await t.test('stale pending source', () =>
    rejected(() => {}, { actor: { pendingId: randomUUID() } }),
  );
  await t.test('client cannot supply a seed or a program through the departure API', () =>
    rejected(() => {}, { input: { seed: 'f'.repeat(64), program: { children: [] } } }),
  );
  await t.test('attested no-effect cannot contradict an executable preparation trigger', () =>
    rejected((s) => {
      s.scenario.pack.manifest.campDeparture.windows.find(
        (w) => w.cardId === 'role-1-skill-1',
      ).prepare = 'none';
    }),
  );
  await t.test('a renamed selected window remains gated', () => {
    const s = structuredClone(original);
    s.scenario.pack.manifest.campDeparture.windows[0].cardId = 'unselected-extra';
    assert.equal(runtime.campDepartureOffer(s).available, false);
  });
  await t.test('ordinary nested source locators stay inert data', () => {
    const s = structuredClone(original);
    s.scenario.pack.manifest.campDeparture.deckCatalog.cards[0].evidence[0].locator =
      '/invented/absent/source-only.data';
    assert.equal(runtime.campDepartureOffer(s).available, true);
  });
  await t.test('the conflicting loss message remains gated for a multihero owner', () => {
    const s = structuredClone(original);
    s.scenario.conclusion.outcome = 'failure';
    s.preparation.heroes[1].playerId = s.preparation.heroes[0].playerId;
    const offer = runtime.campDepartureOffer(s);
    assert.equal(offer.available, false);
    assert.match(offer.reason, /multihero/);
  });
  assert.equal(camp.campDeparture.available, true);
});

test('new episode retains owned campaign copies and cumulative globals as active campaign authority', async (t) => {
  const r = await readyDeparture(t, {
    edit(pack) {
      pack.globals.push({ name: 'inventedCumulative', type: 'int', value: 11 });
    },
  });
  await confirmedCamp(r);
  const s = (await readBackup(r.host)).payload.state,
    campaign = s.scenario.conclusion.campaign,
    offer = runtime.campDepartureOffer(s),
    actor = actorAt(s);
  runtime.beginCampDeparture(
    s,
    actor,
    { kind: 'camp-depart', offerFingerprint: offer.fingerprint, agreed: true },
    s.scenario.pack.manifest.campDeparture,
    () => 'a'.repeat(64),
  );
  s.revision++;
  const expected = {
    heroes: campaign.heroes.map((h) => ({
      heroId: h.heroId,
      roleId: h.roleId,
      itemCopies: h.itemCopies,
      titleCopies: h.titleCopies,
      purchasedCopies: h.skillCopies.filter((copy) =>
        campaign.preparation.heroes
          .find((c) => c.heroId === h.heroId)
          .recipe.cards.some((c) => c.kind === 'purchased' && c.copy === copy),
      ),
    })),
    inventory: campaign.inventory ?? [],
  };
  assert.deepEqual(s.scenario.battle.campaign.ownership, expected);
  assert.equal(s.scenario.battle.campaign.globals.inventedCumulative, 11);
  assert.ok(runtime.StateSchema.safeParse(s).success);
  assert.equal(hash(s.episodes[0]), s.physical.cycle.seed.departure.archiveFingerprint);
});
