import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readyItemCamp,
  reachCamp,
  itemInput,
  itemHero,
  scenarioInput,
  readSession,
  readBackup,
  ok,
} from './camp-items-helper.mjs';

test('HTTP/SQLite camp upgrade replaces the actual owned copy and records its source requirement without spending lore or XP', async (t) => {
  const r = await readyItemCamp(t);
  const camp = await reachCamp(r);
  assert.equal(camp.scenario.play.lore, 3);
  const before = (await readBackup(r.host)).payload;
  const input = itemInput();
  const response = await (await ok(scenarioInput(r.host, r.player, input))).json();
  const after = (await readBackup(r.host)).payload;
  const s = await readSession(r.host);
  assert.deepEqual(itemHero(s).itemCopies, ['advanced:1', 'armor:1']);
  assert.deepEqual(response.receipt.item, {
    heroId: 'hero-1',
    copy: 'sword:1',
    upgrade: 'advanced:1',
    fromModelId: 500,
    toModelId: 505,
    fromRank: 1,
    toRank: 2,
    threshold: 3,
    lore: 3,
  });
  assert.equal(s.scenario.play.lore, 3);
  assert.deepEqual(s.scenario.conclusion.xp, camp.scenario.conclusion.xp);
  assert.deepEqual(
    s.scenario.conclusion.campaign.training,
    camp.scenario.conclusion.campaign.training,
  );
  assert.deepEqual(after.state.preparation, before.state.preparation);
  assert.deepEqual(after.state.physical.snapshot, before.state.physical.snapshot);
  assert.deepEqual(after.state.physical.cycle.seed, before.state.physical.cycle.seed);
  assert.equal(after.state.physical.cycle.records.at(-1).intent.input.kind, 'camp-item');
  assert.equal((await scenarioInput(r.host, r.player, input)).status, 409);
  assert.deepEqual((await readBackup(r.host)).payload, after);
});

test('below and above the lore threshold read the same authoritative inventory and never charge lore or XP', async (t) => {
  for (const lore of [2, 4]) {
    const r = await readyItemCamp(t, { lore });
    const camp = await reachCamp(r),
      before = (await readBackup(r.host)).payload;
    const response = await scenarioInput(r.host, r.player, itemInput());
    assert.equal(response.status, lore < 3 ? 409 : 200);
    if (lore < 3) assert.deepEqual((await readBackup(r.host)).payload, before);
    const s = await readSession(r.host);
    assert.equal(s.scenario.play.lore, lore);
    assert.deepEqual(s.scenario.conclusion.xp, camp.scenario.conclusion.xp);
    assert.deepEqual(
      s.scenario.conclusion.campaign.training,
      camp.scenario.conclusion.campaign.training,
    );
    assert.deepEqual(
      itemHero(s).itemCopies,
      lore < 3 ? ['sword:1', 'armor:1'] : ['advanced:1', 'armor:1'],
    );
  }
});

test('direct alternatives and successive ranks release the old supply copy, preserve ownership and reject skips, downgrade and maximum rank', async (t) => {
  const r = await readyItemCamp(t, { lore: 8 });
  let s = await reachCamp(r);
  const origin = (await readBackup(r.host)).payload.state.physical.cycle.seed;
  const reject = async (input) => {
    const b = (await readBackup(r.host)).payload;
    assert.equal((await scenarioInput(r.host, r.player, input)).status, 409);
    assert.deepEqual((await readBackup(r.host)).payload, b);
  };
  await reject(itemInput({ upgrade: 'invented-final:1' }));
  await ok(scenarioInput(r.host, r.player, itemInput({ upgrade: 'invented-alternative:1' })));
  s = await readSession(r.host);
  assert.deepEqual(itemHero(s).itemCopies, ['invented-alternative:1', 'armor:1']);
  await ok(
    scenarioInput(
      r.host,
      r.player,
      itemInput({ copy: 'invented-alternative:1', upgrade: 'invented-final:1' }),
    ),
  );
  await ok(
    scenarioInput(
      r.host,
      r.other,
      itemInput({ heroId: 'hero-2', copy: 'sword:2', upgrade: 'invented-alternative:1' }),
    ),
  );
  s = await readSession(r.host);
  assert.deepEqual(itemHero(s).itemCopies, ['invented-final:1', 'armor:1']);
  assert.deepEqual(itemHero(s, 'hero-2').itemCopies, ['invented-alternative:1', 'armor:2']);
  for (const upgrade of ['sword:1', 'advanced:1', 'invented-alternative:1', 'invented-final:1'])
    await reject(itemInput({ copy: 'invented-final:1', upgrade }));
  assert.equal(s.scenario.play.lore, 8);
  assert.deepEqual((await readBackup(r.host)).payload.state.physical.cycle.seed, origin);
});

test('contending owners and retry return the actual winning receipt once and reject a changed intent or already held copy atomically', async (t) => {
  const r = await readyItemCamp(t),
    s = await reachCamp(r);
  const { randomUUID } = await import('node:crypto');
  const ids = [randomUUID(), randomUUID()],
    actors = [r.player, r.other],
    inputs = [itemInput(), itemInput({ heroId: 'hero-2', copy: 'sword:2' })];
  const replies = await Promise.all(
    actors.map((p, n) => scenarioInput(r.host, p, inputs[n], { requestId: ids[n] }, s)),
  );
  assert.deepEqual(replies.map((r) => r.status).sort(), [200, 409]);
  const winner = replies.findIndex((r) => r.status === 200),
    loser = 1 - winner,
    result = await replies[winner].json();
  assert.deepEqual(result.receipt.item, {
    ...Object.fromEntries(Object.entries(inputs[winner]).filter(([k]) => k !== 'kind')),
    fromModelId: 500,
    toModelId: 505,
    fromRank: 1,
    toRank: 2,
    threshold: 3,
    lore: 3,
  });
  assert.deepEqual(
    await (
      await ok(scenarioInput(r.host, actors[winner], inputs[winner], { requestId: ids[winner] }, s))
    ).json(),
    result,
  );
  const after = (await readBackup(r.host)).payload;
  assert.deepEqual(after.commands.find((c) => c.requestId === ids[winner]).receipt, result.receipt);
  assert.equal(
    after.state.scenario.conclusion.campaign.heroes
      .flatMap((h) => h.itemCopies)
      .filter((c) => c === 'advanced:1').length,
    1,
  );
  assert.equal((await scenarioInput(r.host, actors[loser], inputs[loser])).status, 409);
  assert.equal(
    (
      await scenarioInput(
        r.host,
        actors[winner],
        { ...inputs[winner], upgrade: 'invented-alternative:1' },
        { requestId: ids[winner] },
      )
    ).status,
    409,
  );
  assert.deepEqual((await readBackup(r.host)).payload, after);
});

test('wrong owner, hero, phase, copy, source, cursor, revision, generation and anonymous commands leave the entire payload unchanged', async (t) => {
  const { randomUUID } = await import('node:crypto');
  const { command } = await import('./preparation-helper.mjs');
  const r = await readyItemCamp(t);
  let s = await readSession(r.host),
    before = (await readBackup(r.host)).payload;
  const binding = (s) => ({
    type: 'SCENARIO_INPUT',
    requestId: randomUUID(),
    generation: s.generation,
    expectedRevision: s.revision,
    scenarioId: s.scenario.id,
    packFingerprint: s.scenario.packFingerprint,
    projectionFingerprint: s.scenario.projectionFingerprint,
    pendingId: s.scenario.pending?.id ?? randomUUID(),
    sourceFingerprint: s.scenario.pending?.fingerprint ?? 'e'.repeat(64),
    heroId: null,
    input: itemInput(),
  });
  assert.equal((await r.host.request('/api/commands', binding(s), r.player.cookie)).status, 409);
  assert.deepEqual((await readBackup(r.host)).payload, before);
  s = await reachCamp(r);
  before = (await readBackup(r.host)).payload;
  assert.equal((await scenarioInput(r.host, r.other, itemInput())).status, 403);
  assert.equal(
    (await scenarioInput(r.host, r.player, itemInput({ heroId: 'missing-hero' }))).status,
    403,
  );
  const raw = binding(s);
  assert.equal((await r.host.request('/api/commands', raw)).status, 401);
  for (const change of [
    { pendingId: randomUUID() },
    { sourceFingerprint: 'e'.repeat(64) },
    { packFingerprint: 'd'.repeat(64) },
    { projectionFingerprint: 'c'.repeat(64) },
    { expectedRevision: s.revision - 1 },
    { generation: randomUUID() },
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
  for (const input of [
    itemInput({ copy: 'sword:2' }),
    itemInput({ copy: 'sword:6' }),
    itemInput({ copy: 'foreign:1' }),
    itemInput({ upgrade: 'advanced:2' }),
    itemInput({ upgrade: 'armor:1' }),
    itemInput({ heroId: null }),
    { ...itemInput(), lore: 999 },
    { ...itemInput(), threshold: 0 },
    { ...itemInput(), operation: 'sell' },
    { ...itemInput(), roleId: 'role-2' },
  ]) {
    assert.ok([409, 422].includes((await scenarioInput(r.host, r.player, input)).status));
    assert.deepEqual((await readBackup(r.host)).payload, before);
  }
  delete r.pack.manifest.campItems;
  // The running campaign retains its frozen capability; changing an external object cannot retrofit it.
  assert.ok((await readSession(r.host)).scenario.pack.manifest.campItems);
});

test('a camp without the optional item capability cannot gain it from a subsequently changed external pack', async (t) => {
  const { writeFile } = await import('node:fs/promises');
  const { attachCampItems } = await import('./fixtures/camp-items.mjs');
  const r = await readyItemCamp(t, {
    edit(pack) {
      delete pack.manifest.campItems;
    },
  });
  await reachCamp(r);
  const before = (await readBackup(r.host)).payload;
  attachCampItems(r.pack, r.catalog);
  await writeFile(r.scenarioPath, JSON.stringify(r.pack));
  assert.equal((await scenarioInput(r.host, r.player, itemInput())).status, 409);
  assert.equal((await readSession(r.host)).scenario.pack.manifest.campItems, undefined);
  assert.deepEqual((await readBackup(r.host)).payload, before);
});

test('improved cards remain readable while future effects and departure are gated before cards, costs or RNG', async (t) => {
  const { command } = await import('./preparation-helper.mjs');
  const r = await readyItemCamp(t);
  let s = await reachCamp(r);
  await ok(scenarioInput(r.host, r.player, itemInput()));
  s = await readSession(r.host);
  const before = (await readBackup(r.host)).payload;
  const response = await scenarioInput(r.host, r.player, { kind: 'ack' });
  assert.equal(response.status, 409);
  assert.match((await response.json()).error.message, /prossima avventura.*istruzioni/i);
  assert.equal(
    (await scenarioInput(r.host, r.player, { kind: 'physical-choice', option: 'reveal' })).status,
    409,
  );
  assert.equal(
    (
      await command(
        r.host,
        r.player,
        { type: 'START_TURN', roundId: s.round.id, heroId: 'hero-1', agreed: true },
        s,
      )
    ).status,
    409,
  );
  assert.deepEqual((await readBackup(r.host)).payload, before);
});
