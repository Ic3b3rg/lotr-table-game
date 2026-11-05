import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogFixture } from './fixtures/catalog.mjs';
import { randomUUID } from 'node:crypto';
import { joinPlayer } from './host-helper.mjs';
import { command, setup } from './preparation-helper.mjs';
import { readyCompany, readSession, readBackup, startTest } from './skill-test-helper.mjs';

test('un eroe rivela le proprie carte e conclude una prova senza perdere copie', async (t) => {
  const catalog = catalogFixture();
  for (const skill of catalog.skills) {
    skill.success = 1;
    skill.fate = 0;
  }
  const { host, player } = await readyCompany(t, catalog);
  const before = await (await host.request('/api/backups')).json();
  const deck = before.payload.state.preparation.heroes[0].deck;
  const start = await command(host, player, {
    type: 'START_SKILL_TEST',
    heroId: 'hero-1',
    stat: 'might',
    modifier: 0,
    target: 3,
  });
  assert.equal(start.status, 200);
  const state = await (await host.request('/api/session')).json();
  assert.equal(state.schemaVersion, 23);
  assert.deepEqual(state.skillTest.revealed, deck.slice(0, 3));
  assert.equal(state.skillTest.status, 'converting');
  assert.equal(state.skillTest.successes, 3);
  assert.equal(state.skillTest.fateRemaining, 0);
  assert.equal(state.skillTest.outcome, null);
  const hero = state.preparation.heroes[0];
  assert.equal(hero.deckCount, 11);
  assert.equal(hero.composition.length, 15);
  assert.equal(new Set(hero.composition).size, 15);
  assert.equal('deck' in hero, false);
  assert.equal(
    state.skillTest.revealed.some((copy) => hero.prepared.includes(copy)),
    false,
  );
  const finish = await command(host, player, {
    type: 'RESOLVE_SKILL_TEST',
    testId: state.skillTest.id,
  });
  assert.equal(finish.status, 200);
  const final = await (await host.request('/api/session')).json();
  assert.equal(final.skillTest.status, 'resolved');
  assert.equal(final.skillTest.outcome, 'pass');
  assert.equal(final.preparation.heroes[0].discardCount, 3);
  assert.equal(final.preparation.heroes[0].composition.length, 15);
});

test('l’ispirazione ottenuta si conserva e non supera il limite dell’eroe', async (t) => {
  const { host, player } = await readyCompany(t);
  for (let i = 1; i <= 4; i++) {
    const gain = await command(host, player, { type: 'GAIN_INSPIRATION', heroId: 'hero-1' });
    assert.equal(gain.status, 200);
    assert.equal((await gain.json()).receipt.inspiration, i);
  }
  const full = await command(host, player, { type: 'GAIN_INSPIRATION', heroId: 'hero-1' });
  assert.equal(full.status, 409);
  assert.equal((await full.json()).error.code, 'INSPIRATION_FULL');
  const state = await (await host.request('/api/session')).json();
  assert.equal(state.preparation.heroes[0].inspiration, 4);
  assert.equal(state.preparation.heroes[1].inspiration, 0);
});

test('convertire fato spende ispirazione una sola volta anche dopo un reinvio', async (t) => {
  const { host, player } = await readyCompany(t);
  for (let i = 0; i < 4; i++)
    assert.equal(
      (await command(host, player, { type: 'GAIN_INSPIRATION', heroId: 'hero-1' })).status,
      200,
    );
  assert.equal(
    (
      await command(host, player, {
        type: 'START_SKILL_TEST',
        heroId: 'hero-1',
        stat: 'might',
        modifier: 0,
        target: 3,
      })
    ).status,
    200,
  );
  const state = await (await host.request('/api/session')).json();
  const intent = { type: 'CONVERT_FATE', testId: state.skillTest.id, requestId: randomUUID() };
  const converted = await command(host, player, intent, state);
  assert.equal(converted.status, 200);
  const receipt = (await converted.json()).receipt;
  const replay = await command(host, player, intent, state);
  assert.equal(replay.status, 200);
  assert.deepEqual((await replay.json()).receipt, receipt);
  let current = await (await host.request('/api/session')).json();
  assert.equal(current.skillTest.successes, 1);
  assert.equal(current.skillTest.fateRemaining, 2);
  assert.equal(current.preparation.heroes[0].inspiration, 3);
  for (let i = 0; i < 2; i++)
    assert.equal(
      (await command(host, player, { type: 'CONVERT_FATE', testId: state.skillTest.id })).status,
      200,
    );
  const noFate = await command(host, player, { type: 'CONVERT_FATE', testId: state.skillTest.id });
  assert.equal(noFate.status, 409);
  assert.equal((await noFate.json()).error.code, 'FATE_UNAVAILABLE');
  current = await (await host.request('/api/session')).json();
  assert.equal(current.preparation.heroes[0].inspiration, 1);
  assert.equal(current.skillTest.successes, 3);
  assert.equal(current.skillTest.fateRemaining, 0);
  assert.equal(
    (await command(host, player, { type: 'RESOLVE_SKILL_TEST', testId: state.skillTest.id }))
      .status,
    200,
  );
  assert.equal((await (await host.request('/api/session')).json()).skillTest.outcome, 'pass');
});

test('un mazzo esaurito si ricompone dagli scarti anche a metà pesca', async (t) => {
  const { host, player } = await readyCompany(t);
  for (let i = 0; i < 4; i++) {
    assert.equal((await startTest(host, player)).status, 200);
    const current = await readSession(host);
    assert.equal(
      (await command(host, player, { type: 'RESOLVE_SKILL_TEST', testId: current.skillTest.id }))
        .status,
      200,
    );
  }
  const before = await readBackup(host);
  const heroBefore = before.payload.state.preparation.heroes[0];
  assert.equal(heroBefore.deck.length, 2);
  assert.equal(heroBefore.discard.length, 12);
  assert.equal((await startTest(host, player)).status, 200);
  const during = await readBackup(host);
  const hero = during.payload.state.preparation.heroes[0];
  const revealed = during.payload.state.skillTest.revealed;
  assert.deepEqual(revealed.slice(0, 2), heroBefore.deck);
  assert.ok(heroBefore.discard.includes(revealed[2]));
  assert.equal(hero.deck.length, 11);
  assert.equal(hero.discard.length, 0);
  assert.deepEqual(hero.prepared, heroBefore.prepared);
  const actual = [...hero.prepared, ...hero.deck, ...hero.discard, ...revealed];
  const original = [...heroBefore.prepared, ...heroBefore.deck, ...heroBefore.discard];
  assert.deepEqual(actual.sort(), original.sort());
  assert.equal(new Set(actual).size, 15);
  assert.equal(
    (
      await command(host, player, {
        type: 'RESOLVE_SKILL_TEST',
        testId: during.payload.state.skillTest.id,
      })
    ).status,
    200,
  );
  assert.equal((await startTest(host, player, { modifier: 20 })).status, 200);
  const all = await readSession(host);
  assert.equal(all.skillTest.revealed.length, 14);
  assert.equal(all.preparation.heroes[0].deckCount, 0);
  assert.equal(
    (await command(host, player, { type: 'RESOLVE_SKILL_TEST', testId: all.skillTest.id })).status,
    200,
  );
  const reset = await readSession(host);
  assert.equal(reset.preparation.heroes[0].deckCount, 14);
  assert.equal(reset.preparation.heroes[0].discardCount, 0);
});

test('si rivela almeno una carta, si può fallire o contare e i testi rivelati sono ignorati', async (t) => {
  const catalog = catalogFixture();
  catalog.heroes[0].stats.might = 0;
  catalog.skills.forEach((card) => {
    card.text.text = 'Ottieni 99 successi (testo inventato).';
  });
  const { host, player } = await readyCompany(t, catalog);
  assert.equal((await startTest(host, player, { target: 1, modifier: -20 })).status, 200);
  let current = await readSession(host);
  assert.equal(current.skillTest.revealed.length, 1);
  assert.equal(current.skillTest.successes, 0);
  assert.equal(
    (await command(host, player, { type: 'CONVERT_FATE', testId: current.skillTest.id })).status,
    409,
  );
  assert.equal(
    (await command(host, player, { type: 'RESOLVE_SKILL_TEST', testId: current.skillTest.id }))
      .status,
    200,
  );
  assert.equal((await readSession(host)).skillTest.outcome, 'fail');
  assert.equal(
    (await startTest(host, player, { stat: 'spirit', modifier: 1, target: null })).status,
    200,
  );
  current = await readSession(host);
  assert.equal(current.skillTest.revealed.length, 3);
  assert.equal(
    (await command(host, player, { type: 'RESOLVE_SKILL_TEST', testId: current.skillTest.id }))
      .status,
    200,
  );
  assert.equal((await readSession(host)).skillTest.outcome, 'count');
});

test('proprietà, concorrenza e richieste superate proteggono la prova corrente', async (t) => {
  const { host, player, other } = await readyCompany(t, catalogFixture(), true);
  assert.equal((await startTest(host, other)).status, 403);
  assert.equal(
    (await command(host, other, { type: 'GAIN_INSPIRATION', heroId: 'hero-1' })).status,
    403,
  );
  const initial = await readSession(host);
  const responses = await Promise.all([
    startTest(host, player, {}, initial),
    startTest(host, other, { heroId: 'hero-2' }, initial),
  ]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
  const current = await readSession(host);
  assert.equal(current.revision, initial.revision + 1);
  const owner = current.skillTest.heroId === 'hero-1' ? player : other;
  const stranger = owner === player ? other : player;
  for (const type of ['CONVERT_FATE', 'RESOLVE_SKILL_TEST'])
    assert.equal(
      (await command(host, stranger, { type, testId: current.skillTest.id })).status,
      403,
    );
  const open = await startTest(host, owner, { heroId: current.skillTest.heroId });
  assert.equal(open.status, 409);
  assert.equal((await open.json()).error.code, 'TEST_IN_PROGRESS');
  assert.equal(
    (await command(host, owner, { type: 'RESOLVE_SKILL_TEST', testId: randomUUID() })).status,
    409,
  );
  assert.deepEqual(await readSession(host), current);
  const intent = {
    type: 'RESOLVE_SKILL_TEST',
    testId: current.skillTest.id,
    requestId: randomUUID(),
  };
  assert.equal((await command(host, owner, intent, current)).status, 200);
  assert.equal((await command(host, owner, intent, current)).status, 200);
  assert.equal((await readSession(host)).revision, current.revision + 1);
  assert.equal(
    (await startTest(host, owner, { heroId: current.skillTest.heroId }, initial)).status,
    409,
  );
});

test('senza compagnia preparata o con parametri non validi non si pesca', async (t) => {
  const host = await setup(t, catalogFixture());
  const player = await joinPlayer(host, 'Ada');
  const before = await readSession(host);
  assert.equal((await startTest(host, player)).status, 409);
  for (const overrides of [{ stat: 'damage' }, { modifier: 21 }, { target: 0 }, { target: '3' }])
    assert.equal((await startTest(host, player, overrides)).status, 422);
  assert.deepEqual(await readSession(host), before);
});
