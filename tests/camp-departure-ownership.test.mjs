import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readyDeparture,
  reachDepartureCamp,
  readSession,
  readBackup,
  scenarioInput,
  ok,
  finishSetup,
} from './camp-departure-helper.mjs';
import { buyInput } from './camp-skills-helper.mjs';
import { confirm, choice } from './camp-preparation-helper.mjs';
import { runtime } from './camp-departure-runtime.mjs';
import { compilePhysicalFronts } from '../dist/physical-resolution-library.mjs';
import { hash } from './fixtures/map-freeze.mjs';

test('native changed roles, purchased/refunded copies, personal upgrade and selected shared upgrade reach their actual A2 windows', async (t) => {
  const r = await readyDeparture(t, { groupItem: true });
  await reachDepartureCamp(r);
  let s = await readSession(r.host);
  const purchase = buyInput(s);
  await ok(scenarioInput(r.host, r.player, purchase));
  await ok(scenarioInput(r.host, r.player, { ...purchase, operation: 'sell' }));
  await ok(scenarioInput(r.host, r.player, purchase));
  await ok(
    scenarioInput(r.host, r.player, {
      kind: 'camp-item',
      heroId: 'hero-1',
      copy: 'sword:1',
      upgrade: 'advanced:1',
    }),
  );
  await ok(
    scenarioInput(r.host, r.player, {
      kind: 'camp-item',
      heroId: null,
      copy: 'trinket:1',
      upgrade: 'invented-trinket-2:1',
    }),
  );
  await ok(scenarioInput(r.host, r.player, { kind: 'camp-prepare' }));
  s = await readSession(r.host);
  for (const [n, actor] of r.actors.entries())
    await ok(scenarioInput(r.host, actor, confirm(await readSession(r.host), `hero-${n + 1}`)));
  const stale = await readSession(r.host),
    staleInput = {
      kind: 'camp-depart',
      offerFingerprint: stale.campDeparture.fingerprint,
      agreed: true,
    };
  await ok(
    scenarioInput(r.host, r.player, {
      kind: 'camp-select-role',
      heroId: 'hero-1',
      roleId: 'role-4',
    }),
  );
  s = await readSession(r.host);
  assert.equal(choice(s).confirmedRevision, null);
  assert.equal(s.campDeparture.available, false);
  const unchanged = (await readBackup(r.host)).payload;
  assert.equal((await scenarioInput(r.host, r.player, staleInput)).status, 409);
  assert.deepEqual((await readBackup(r.host)).payload, unchanged);
  assert.equal(
    (
      await scenarioInput(r.host, r.other, {
        kind: 'camp-accessory',
        heroId: 'hero-1',
        copy: 'invented-trinket-2:1',
      })
    ).status,
    403,
  );
  await ok(
    scenarioInput(r.host, r.player, {
      kind: 'camp-accessory',
      heroId: 'hero-1',
      copy: 'invented-trinket-2:1',
    }),
  );
  s = await readSession(r.host);
  assert.equal(choice(s).recipe.roleId, 'role-4');
  assert.ok(choice(s).recipe.cards.some((c) => c.copy === purchase.copy));
  await ok(scenarioInput(r.host, r.player, confirm(s)));
  s = await readSession(r.host);
  assert.equal(s.campDeparture.available, true, s.campDeparture.reason);
  const before = (await readBackup(r.host)).payload;
  const unsupported = structuredClone(before.state),
    cap = unsupported.scenario.pack.manifest.campDeparture;
  const { fingerprint, rawFingerprint, ...frontInput } = cap.fronts;
  frontInput.policies.find((p) => p.id === 'invented-trinket-2').effects = frontInput.policies
    .find((p) => p.id === 'invented-trinket-2')
    .effects.filter((e) => e.op !== 'fear-facedown-only');
  cap.fronts = compilePhysicalFronts(
    unsupported.physical.raw,
    frontInput,
    unsupported.content,
    cap.campaignSkills,
  );
  cap.frontsFingerprint = cap.fronts.fingerprint;
  cap.windows.find((w) => w.cardId === 'invented-trinket-2').policyHash = hash(
    cap.fronts.policies.find((p) => p.id === 'invented-trinket-2'),
  );
  assert.equal(
    runtime.campDepartureOffer(unsupported).available,
    false,
    'An accessory without a supported custody/depletion consumer must gate before activation',
  );
  await ok(
    scenarioInput(r.host, r.player, {
      kind: 'camp-depart',
      offerFingerprint: s.campDeparture.fingerprint,
      agreed: true,
    }),
  );
  await finishSetup(r);
  const after = (await readBackup(r.host)).payload,
    h = after.state.preparation.heroes[0],
    campaign = after.state.scenario.battle.campaign;
  assert.equal(h.roleId, 'role-4');
  assert.deepEqual(h.itemCopies, ['advanced:1', 'armor:1']);
  assert.ok([...h.deck, ...h.prepared, ...h.discard].includes(purchase.copy));
  assert.ok(h.prepared.includes('role-4-skill-1:1'));
  assert.ok(![...h.deck, ...h.prepared, ...h.discard].includes('role-1-skill-1:1'));
  assert.equal(
    campaign.balances.find((b) => b.heroId === 'hero-1' && b.roleId === 'role-4').availableXP,
    0,
  );
  assert.equal(
    campaign.balances.find((b) => b.heroId === 'hero-1' && b.roleId === 'role-1').availableXP,
    before.state.scenario.conclusion.campaign.training.balances.find(
      (b) => b.heroId === 'hero-1' && b.roleId === 'role-1',
    ).availableXP,
  );
  assert.deepEqual(
    campaign.ownership.inventory,
    before.state.scenario.conclusion.campaign.inventory,
  );
  const resources = after.state.physical.snapshot.resolution.resources;
  assert.equal(resources.depletion.find((d) => d.copy === 'invented-trinket-2:1').remaining, 3);
  assert.ok(
    resources.itemCustody.some((i) => i.copy === 'invented-trinket-2:1' && i.heroId === 'hero-1'),
  );
  const hooks = after.state.physical.runs
    .flatMap((run) => run.answers)
    .filter((a) => a.input.kind === 'physical-scout');
  assert.equal(
    hooks.length,
    4,
    'Three Scout3 windows and the actual selected accessory Scout1 must execute',
  );
  assert.equal(
    h.inspiration,
    2,
    'Initial role and the actual upgraded personal item each grant inspiration',
  );
  assert.deepEqual(after.state.episodes[0].scenario, before.state.scenario);
});
