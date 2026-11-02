import test from 'node:test';
import assert from 'node:assert/strict';
import { readyCompany, readSession, readBackup, startTest } from './skill-test-helper.mjs';
import { command } from './preparation-helper.mjs';
import { startScout, finishScout } from './scouting-helper.mjs';
import { catalogFixture } from './fixtures/catalog.mjs';
import { randomUUID } from 'node:crypto';

test('Scoperta prepara una carta e conserva l’ordine scelto sopra e sotto il mazzo', async (t) => {
  const { host, player } = await readyCompany(t);
  const before = await readBackup(host);
  const original = before.payload.state.preparation.heroes[0].deck;
  const response = await command(host, player, { type: 'START_SCOUT', heroId: 'hero-1', count: 4 });
  assert.equal(response.status, 200);
  const pending = await readSession(host);
  assert.deepEqual(pending.scout.revealed, original.slice(0, 4));
  assert.equal(pending.preparation.heroes[0].composition.length, 15);
  assert.equal(pending.preparation.heroes[0].deckCount, 10);
  const resolve = await command(host, player, {
    type: 'RESOLVE_SCOUT',
    scoutId: pending.scout.id,
    prepareCopy: original[1],
    top: [original[2], original[0]],
    bottom: [original[3]],
    discardPreparedCopy: null,
  });
  assert.equal(resolve.status, 200);
  const after = await readBackup(host);
  const hero = after.payload.state.preparation.heroes[0];
  assert.deepEqual(hero.prepared, ['role-1-skill-1:1', original[1]]);
  assert.deepEqual(hero.deck, [original[2], original[0], ...original.slice(4), original[3]]);
  assert.equal(after.payload.state.scout, null);
  const view = await readSession(host);
  assert.equal('deck' in view.preparation.heroes[0], false);
});

test('debolezze e quattro preparate rispettano il limite, sostituendo anche la carta ruolo 1', async (t) => {
  const { host, player } = await readyCompany(t);
  assert.equal((await startTest(host, player)).status, 200);
  const tested = await readSession(host);
  assert.equal(
    (await command(host, player, { type: 'RESOLVE_SKILL_TEST', testId: tested.skillTest.id }))
      .status,
    200,
  );
  assert.equal((await startScout(host, player, 15)).status, 200);
  let pending = await readSession(host);
  const weakness = pending.scout.revealed.find((copy) => copy.startsWith('weak-'));
  assert.ok(weakness);
  assert.equal((await finishScout(host, player, pending.scout, weakness)).status, 200);
  for (let i = 0; i < 2; i++) {
    assert.equal((await startScout(host, player, 1)).status, 200);
    pending = await readSession(host);
    assert.equal(
      (await finishScout(host, player, pending.scout, pending.scout.revealed[0])).status,
      200,
    );
  }
  assert.equal((await startScout(host, player, 1)).status, 200);
  pending = await readSession(host);
  assert.equal(pending.preparation.heroes[0].prepared.length, 4);
  const extra = pending.scout.revealed[0];
  assert.equal((await finishScout(host, player, pending.scout, extra)).status, 409);
  assert.deepEqual(await readSession(host), pending);
  assert.equal(
    (
      await finishScout(host, player, pending.scout, extra, {
        discardPreparedCopy: 'role-1-skill-1:1',
      })
    ).status,
    200,
  );
  const after = await readSession(host);
  assert.equal(after.preparation.heroes[0].prepared.length, 4);
  assert.ok(after.preparation.heroes[0].prepared.includes(weakness));
  assert.ok(after.preparation.heroes[0].prepared.includes(extra));
  assert.equal(after.preparation.heroes[0].prepared.includes('role-1-skill-1:1'), false);
  assert.deepEqual(
    after.skillTest,
    tested.skillTest && { ...tested.skillTest, status: 'resolved', outcome: 'fail' },
  );
  assert.equal((await startTest(host, player, { modifier: 20 })).status, 200);
  const all = await readSession(host);
  assert.equal(all.skillTest.availableCount, 11);
  assert.equal(all.skillTest.revealed.length, 11);
  assert.equal(new Set(all.preparation.heroes[0].composition).size, 15);
});

test('si può scartare la carta appena preparata quando sarebbe la quinta', async (t) => {
  const { host, player } = await readyCompany(t);
  for (let i = 0; i < 3; i++) {
    assert.equal((await startScout(host, player, 1)).status, 200);
    const pending = await readSession(host);
    assert.equal(
      (await finishScout(host, player, pending.scout, pending.scout.revealed[0])).status,
      200,
    );
  }
  const before = await readSession(host);
  assert.equal((await startScout(host, player, 1)).status, 200);
  const pending = await readSession(host);
  const copy = pending.scout.revealed[0];
  assert.equal(
    (await finishScout(host, player, pending.scout, copy, { discardPreparedCopy: copy })).status,
    200,
  );
  assert.deepEqual(
    (await readSession(host)).preparation.heroes[0].prepared,
    before.preparation.heroes[0].prepared,
  );
});

test('Scoperta ricompone a metà pesca senza toccare le preparate', async (t) => {
  const { host, player } = await readyCompany(t);
  for (let i = 0; i < 4; i++) {
    assert.equal((await startTest(host, player)).status, 200);
    const state = await readSession(host);
    assert.equal(
      (await command(host, player, { type: 'RESOLVE_SKILL_TEST', testId: state.skillTest.id }))
        .status,
      200,
    );
  }
  const oldHero = (await readBackup(host)).payload.state.preparation.heroes[0];
  assert.equal(oldHero.deck.length, 2);
  assert.equal((await startScout(host, player, 4)).status, 200);
  const pending = await readSession(host);
  assert.deepEqual(pending.scout.revealed.slice(0, 2), oldHero.deck);
  assert.ok(pending.scout.revealed.slice(2).every((copy) => oldHero.discard.includes(copy)));
  assert.equal(pending.preparation.heroes[0].discardCount, 0);
  assert.equal(
    (
      await finishScout(host, player, pending.scout, null, {
        top: [],
        bottom: pending.scout.revealed.slice().reverse(),
      })
    ).status,
    200,
  );
  const after = (await readBackup(host)).payload.state.preparation.heroes[0];
  assert.deepEqual(after.deck.slice(-4), pending.scout.revealed.slice().reverse());
  assert.deepEqual(after.prepared, oldHero.prepared);
});

test('proprietà, esclusione e reinvii impediscono di applicare due scelte', async (t) => {
  const { host, player, other } = await readyCompany(t, catalogFixture(), true);
  assert.equal((await startScout(host, other)).status, 403);
  assert.equal((await startTest(host, player)).status, 200);
  let pending = await readSession(host);
  assert.equal((await startScout(host, player)).status, 409);
  assert.equal(
    (await command(host, player, { type: 'RESOLVE_SKILL_TEST', testId: pending.skillTest.id }))
      .status,
    200,
  );
  const initial = await readSession(host);
  const starts = await Promise.all([
    startScout(host, player, 2, 'hero-1', initial),
    startScout(host, other, 2, 'hero-2', initial),
  ]);
  assert.deepEqual(starts.map((response) => response.status).sort(), [200, 409]);
  pending = await readSession(host);
  const owner = pending.scout.heroId === 'hero-1' ? player : other;
  const stranger = owner === player ? other : player;
  assert.equal((await finishScout(host, stranger, pending.scout)).status, 403);
  assert.equal((await startTest(host, owner, { heroId: pending.scout.heroId })).status, 409);
  assert.equal(
    (
      await command(host, owner, {
        type: 'DISCARD_PREPARED_SKILL',
        heroId: pending.scout.heroId,
        copy: `role-${owner === player ? 1 : 2}-skill-1:1`,
      })
    ).status,
    409,
  );
  const overrides = { requestId: randomUUID() };
  const result = await finishScout(host, owner, pending.scout, null, overrides, pending);
  assert.equal(result.status, 200);
  const receipt = (await result.json()).receipt;
  const replay = await finishScout(host, owner, pending.scout, null, overrides, pending);
  assert.equal(replay.status, 200);
  assert.deepEqual((await replay.json()).receipt, receipt);
  assert.equal((await readSession(host)).revision, pending.revision + 1);
});

test('partizioni, quantità e scarti non validi vengono rifiutati senza perdere carte', async (t) => {
  const { host, player } = await readyCompany(t);
  for (const count of [0, 16, 1.5])
    assert.equal((await startScout(host, player, count)).status, 422);
  assert.equal((await startScout(host, player, 2)).status, 200);
  const pending = await readSession(host);
  const [a, b] = pending.scout.revealed;
  for (const invalid of [
    { top: [a] },
    { top: [a, a] },
    { top: [a, 'role-2-skill-1:1'] },
    { top: [a], bottom: [b], prepareCopy: a },
    { discardPreparedCopy: 'role-1-skill-1:1' },
  ]) {
    assert.equal((await finishScout(host, player, pending.scout, null, invalid)).status, 409);
    assert.deepEqual(await readSession(host), pending);
  }
});

test('scartare la preparata per un effetto lascia quindici carte disponibili alla prova', async (t) => {
  const { host, player } = await readyCompany(t);
  const response = await command(host, player, {
    type: 'DISCARD_PREPARED_SKILL',
    heroId: 'hero-1',
    copy: 'role-1-skill-1:1',
  });
  assert.equal(response.status, 200);
  const state = await readSession(host);
  assert.deepEqual(state.preparation.heroes[0].prepared, []);
  assert.equal(state.preparation.heroes[0].discardCount, 1);
  assert.equal((await startTest(host, player, { modifier: 20 })).status, 200);
  const during = await readSession(host);
  assert.equal(during.skillTest.availableCount, 15);
  assert.equal(during.skillTest.revealed.length, 15);
  assert.equal(new Set(during.skillTest.revealed).size, 15);
});

test('la ricomposizione riunisce gli scarti prima di Scoperta 2', async (t) => {
  const { host, player } = await readyCompany(t);
  assert.equal((await startTest(host, player)).status, 200);
  const testState = await readSession(host);
  assert.equal(
    (
      await command(host, player, {
        type: 'RESOLVE_SKILL_TEST',
        testId: testState.skillTest.id,
      })
    ).status,
    200,
  );
  const before = await readBackup(host);
  const oldHero = before.payload.state.preparation.heroes[0];
  assert.equal(oldHero.discard.length, 3);
  const response = await command(host, player, { type: 'START_RALLY_SCOUT', heroId: 'hero-1' });
  assert.equal(response.status, 200);
  const during = await readBackup(host);
  const { scout, preparation } = during.payload.state;
  const hero = preparation.heroes[0];
  assert.equal(scout.count, 2);
  assert.equal(scout.resetBefore, true);
  assert.equal(hero.deck.length, 12);
  assert.deepEqual(hero.discard, []);
  assert.deepEqual(
    [...hero.deck, ...scout.revealed].sort(),
    [...oldHero.deck, ...oldHero.discard].sort(),
  );
  assert.deepEqual(hero.prepared, oldHero.prepared);
  assert.equal(
    (
      await command(host, player, {
        type: 'RESOLVE_SCOUT',
        scoutId: scout.id,
        prepareCopy: null,
        top: [...scout.revealed].reverse(),
        bottom: [],
        discardPreparedCopy: null,
      })
    ).status,
    200,
  );
  assert.deepEqual(
    (await readBackup(host)).payload.state.preparation.heroes[0].deck,
    [...scout.revealed].reverse().concat(hero.deck),
  );
});
