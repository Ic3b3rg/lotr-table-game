import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readyPreparation,
  reachCamp,
  scenarioInput,
  readSession,
  readBackup,
  ok,
  choice,
  confirm,
} from './camp-preparation-helper.mjs';
import { buyInput } from './camp-skills-helper.mjs';
import { itemInput } from './camp-items-helper.mjs';
import { randomUUID } from 'node:crypto';

test('taking an occupied role clears only that hero role and confirmation; return/re-entry preserves still-valid selections', async (t) => {
  const r = await readyPreparation(t);
  const camp = await reachCamp(r);
  await ok(scenarioInput(r.host, r.player, { kind: 'camp-prepare' }));
  let s = await readSession(r.host);
  await ok(scenarioInput(r.host, r.player, confirm(s)));
  await ok(scenarioInput(r.host, r.other, confirm(await readSession(r.host), 'hero-2')));
  await ok(
    scenarioInput(r.host, r.player, {
      kind: 'camp-select-role',
      heroId: 'hero-1',
      roleId: 'role-2',
    }),
  );
  s = await readSession(r.host);
  assert.equal(choice(s).recipe.roleId, 'role-2');
  assert.equal(choice(s, 'hero-2').recipe.roleId, null);
  assert.ok(
    s.scenario.conclusion.campaign.preparation.heroes.every((h) => h.confirmedRevision === null),
  );
  const before = (await readBackup(r.host)).payload;
  assert.equal((await scenarioInput(r.host, r.other, confirm(s, 'hero-2'))).status, 409);
  assert.deepEqual((await readBackup(r.host)).payload, before);
  await ok(
    scenarioInput(r.host, r.other, {
      kind: 'camp-select-role',
      heroId: 'hero-2',
      roleId: 'role-3',
    }),
  );
  s = await readSession(r.host);
  await ok(scenarioInput(r.host, r.player, confirm(s)));
  const saved = choice(await readSession(r.host));
  await ok(
    scenarioInput(r.host, r.player, {
      kind: 'camp-select-role',
      heroId: 'hero-1',
      roleId: 'role-2',
    }),
  );
  assert.deepEqual(choice(await readSession(r.host)), saved);
  await ok(scenarioInput(r.host, r.other, { kind: 'camp-return' }));
  await ok(scenarioInput(r.host, r.player, { kind: 'camp-prepare' }));
  s = await readSession(r.host);
  assert.deepEqual(choice(s), saved);
  assert.equal(s.scenario.conclusion.campEntryCount, 1);
  assert.equal(s.scenario.conclusion.transitionCount, 1);
  assert.deepEqual(
    s.scenario.conclusion.campaign.training,
    camp.scenario.conclusion.campaign.training,
  );
  assert.deepEqual(
    s.preparation.heroes.map((h) => h.roleId),
    camp.preparation.heroes.map((h) => h.roleId),
  );
});

test('real purchases, full refunds and personal upgrades invalidate changed summaries and preserve other confirmations', async (t) => {
  const r = await readyPreparation(t);
  await reachCamp(r);
  await ok(scenarioInput(r.host, r.player, { kind: 'camp-prepare' }));
  let s = await readSession(r.host);
  await ok(scenarioInput(r.host, r.player, confirm(s)));
  await ok(scenarioInput(r.host, r.other, confirm(await readSession(r.host), 'hero-2')));
  const other = choice(await readSession(r.host), 'hero-2');
  const stale = confirm(await readSession(r.host));
  await ok(scenarioInput(r.host, r.player, { kind: 'camp-return' }));
  s = await readSession(r.host);
  const purchase = buyInput(s);
  await ok(scenarioInput(r.host, r.player, purchase));
  s = await readSession(r.host);
  assert.equal(choice(s).confirmedRevision, null);
  assert.ok(choice(s).recipe.cards.some((c) => c.kind === 'purchased' && c.copy === purchase.copy));
  assert.deepEqual(choice(s, 'hero-2'), other);
  await ok(scenarioInput(r.host, r.player, { kind: 'camp-prepare' }));
  assert.equal((await scenarioInput(r.host, r.player, stale)).status, 409);
  await ok(
    scenarioInput(r.host, r.player, {
      kind: 'camp-select-role',
      heroId: 'hero-1',
      roleId: 'role-4',
    }),
  );
  s = await readSession(r.host);
  assert.ok(choice(s).recipe.cards.some((c) => c.kind === 'purchased' && c.copy === purchase.copy));
  assert.equal(
    choice(s)
      .recipe.cards.filter((c) => c.kind === 'role')
      .every((c) => c.cardId.startsWith('role-4-')),
    true,
  );
  await ok(scenarioInput(r.host, r.player, confirm(s)));
  await ok(scenarioInput(r.host, r.player, { kind: 'camp-return' }));
  await ok(scenarioInput(r.host, r.player, { ...purchase, operation: 'sell' }));
  s = await readSession(r.host);
  assert.equal(choice(s).confirmedRevision, null);
  assert.equal(
    choice(s).recipe.cards.some((c) => c.kind === 'purchased'),
    false,
  );
  await ok(scenarioInput(r.host, r.player, { kind: 'camp-prepare' }));
  await ok(scenarioInput(r.host, r.player, confirm(await readSession(r.host))));
  await ok(scenarioInput(r.host, r.player, { kind: 'camp-return' }));
  await ok(scenarioInput(r.host, r.player, itemInput()));
  s = await readSession(r.host);
  assert.equal(choice(s).confirmedRevision, null);
  assert.deepEqual(choice(s).recipe.itemCopies, ['advanced:1', 'armor:1']);
  assert.deepEqual(choice(s, 'hero-2'), other);
  assert.equal(s.scenario.play.lore, 3);
});

test('personal actor, phase, source, cursor, revision, generation, recipe injection and unavailable identities reject atomically', async (t) => {
  const r = await readyPreparation(t, {
    edit(pack) {
      pack.manifest.campPreparation.cards.find(
        (c) => c.kind === 'role' && c.ownerId === 'role-6',
      ).identity = 'requires-content';
    },
  });
  await reachCamp(r);
  const reject = async (input, actor = r.player, status = 409) => {
    const before = (await readBackup(r.host)).payload;
    assert.equal((await scenarioInput(r.host, actor, input)).status, status);
    assert.deepEqual((await readBackup(r.host)).payload, before);
  };
  await reject({ kind: 'camp-confirm', heroId: 'hero-1', summaryHash: 'a'.repeat(64) });
  await ok(scenarioInput(r.host, r.player, { kind: 'camp-prepare' }));
  let s = await readSession(r.host);
  await reject(confirm(s), r.other, 403);
  await reject({ ...confirm(s), heroId: 'missing' }, r.player, 403);
  await reject({ kind: 'camp-select-role', heroId: 'hero-1', roleId: 'role-6' });
  await reject({ kind: 'camp-select-role', heroId: 'hero-1', roleId: 'missing' });
  await reject({ kind: 'camp-accessory', heroId: 'hero-1', copy: 'trinket:1' });
  await reject({ ...confirm(s), recipe: choice(s).recipe }, r.player, 422);
  await reject({ ...confirm(s), seed: 0 }, r.player, 422);
  const q = s.scenario.pending;
  const raw = {
    type: 'SCENARIO_INPUT',
    requestId: randomUUID(),
    generation: s.generation,
    expectedRevision: s.revision,
    scenarioId: s.scenario.id,
    packFingerprint: s.scenario.packFingerprint,
    projectionFingerprint: s.scenario.projectionFingerprint,
    pendingId: q.id,
    sourceFingerprint: q.fingerprint,
    heroId: null,
    input: confirm(s),
  };
  const before = (await readBackup(r.host)).payload;
  assert.equal((await r.host.request('/api/commands', raw)).status, 401);
  for (const change of [
    { generation: randomUUID() },
    { expectedRevision: s.revision - 1 },
    { sourceFingerprint: 'e'.repeat(64) },
    { pendingId: randomUUID() },
    { scenarioId: randomUUID() },
    { packFingerprint: 'd'.repeat(64) },
    { projectionFingerprint: 'c'.repeat(64) },
    { heroId: 'hero-1' },
  ]) {
    assert.equal(
      (
        await r.host.request(
          '/api/commands',
          { ...raw, requestId: randomUUID(), ...change },
          r.player.cookie,
        )
      ).status,
      409,
    );
    assert.deepEqual((await readBackup(r.host)).payload, before);
  }
  const requestId = randomUUID();
  const result = await (
    await ok(scenarioInput(r.host, r.player, confirm(s), { requestId }, s))
  ).json();
  assert.deepEqual(
    await (await ok(scenarioInput(r.host, r.player, confirm(s), { requestId }, s))).json(),
    result,
  );
  await reject(confirm(await readSession(r.host)));
  assert.equal(
    (await scenarioInput(r.host, r.player, { kind: 'camp-return' }, { requestId }, s)).status,
    409,
  );
});

test('old packs remain gated and cannot gain preparation from external post-freeze data', async (t) => {
  const r = await readyPreparation(t, {
    edit(pack) {
      delete pack.manifest.campPreparation;
    },
  });
  await reachCamp(r);
  const before = (await readBackup(r.host)).payload;
  const { attachCampPreparation } = await import('./fixtures/camp-preparation.mjs');
  const { writeFile } = await import('node:fs/promises');
  attachCampPreparation(r.pack, r.catalog);
  await writeFile(r.scenarioPath, JSON.stringify(r.pack));
  assert.equal((await scenarioInput(r.host, r.player, { kind: 'camp-prepare' })).status, 409);
  assert.deepEqual((await readBackup(r.host)).payload, before);
});

test('HTTP/SQLite next choices begin with current roles and confirm a source recipe while departure stays gated', async (t) => {
  const r = await readyPreparation(t);
  const camp = await reachCamp(r),
    before = (await readBackup(r.host)).payload;
  await ok(scenarioInput(r.host, r.player, { kind: 'camp-prepare' }));
  let s = await readSession(r.host);
  assert.equal(s.scenario.conclusion.stage, 'camp-preparation');
  const h = choice(s);
  assert.equal(h.recipe.roleId, 'role-1');
  assert.equal(h.accessory, null);
  assert.equal(h.confirmedRevision, null);
  assert.deepEqual(
    h.recipe.cards.map((c) => c.kind),
    [...Array(6).fill('basic'), ...Array(5).fill('hero'), ...Array(3).fill('role')],
  );
  assert.equal(h.recipe.futurePrepared, 'role-1-skill-1');
  assert.deepEqual(h.recipe.weakness, { count: 1, source: 'future-common-draw' });
  const reply = await (await ok(scenarioInput(r.host, r.player, confirm(s)))).json();
  s = await readSession(r.host);
  assert.equal(choice(s).confirmedRevision, s.revision);
  assert.equal(reply.receipt.kind, 'camp-confirm');
  assert.deepEqual(
    reply.receipt.preparation.heroes,
    s.scenario.conclusion.campaign.preparation.heroes,
  );
  await ok(scenarioInput(r.host, r.other, confirm(s, 'hero-2')));
  s = await readSession(r.host);
  assert.ok(s.scenario.conclusion.campaign.preparation.heroes.every((h) => h.confirmedRevision));
  const saved = (await readBackup(r.host)).payload;
  assert.equal((await scenarioInput(r.host, r.player, { kind: 'ack' })).status, 409);
  assert.deepEqual((await readBackup(r.host)).payload, saved);
  assert.deepEqual(saved.state.preparation, before.state.preparation);
  assert.deepEqual(saved.state.physical.snapshot, before.state.physical.snapshot);
  assert.deepEqual(saved.state.physical.cycle.seed, before.state.physical.cycle.seed);
  assert.deepEqual(saved.state.journey, before.state.journey);
  assert.deepEqual(saved.state.round, before.state.round);
  assert.deepEqual(
    s.scenario.conclusion.campaign.training,
    camp.scenario.conclusion.campaign.training,
  );
  assert.deepEqual(s.scenario.conclusion.xp, camp.scenario.conclusion.xp);
  assert.equal(s.scenario.play.lore, camp.scenario.play.lore);
});
