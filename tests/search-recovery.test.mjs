import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readySearches, reachSearch, commitSearch, searchNode, ok } from './search-http-helper.mjs';
import { scenarioInput } from './scenario-helper.mjs';
import { readSession, readBackup, signBackup } from './skill-test-helper.mjs';
import { startHost } from './host-helper.mjs';
import { recoverSeat } from './last-stand-helper.mjs';

const administrative = (actual, expected) => {
  const copy = structuredClone(actual);
  for (const k of ['generation', 'revision', 'updatedAt']) copy[k] = expected[k];
  return copy;
};
async function evidence(label, value) {
  const dir = process.env.LOTR_SEARCH_EVIDENCE;
  if (!dir) return;
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, label + '.json'), JSON.stringify(value));
}
async function cut(t, r, label) {
  const backup = await readBackup(r.host),
    view = await readSession(r.host),
    origin = structuredClone(backup.payload.state.physical.cycle.seed);
  await r.host.stop('SIGKILL');
  const next = await startHost();
  t.after(() => next.dispose());
  for (const name of [
    'scenario-pack',
    'physical-content',
    'physical-fronts',
    'physical-last-stand',
  ])
    await assert.rejects(access(join(next.dataDir, name + '.json')));
  const empty = await readSession(next);
  assert.equal(empty.scenario, null);
  await ok(
    next.request('/api/restores', {
      backup,
      generation: empty.generation,
      expectedRevision: empty.revision,
      confirmed: true,
    }),
  );
  const after = (await readBackup(next)).payload,
    afterView = await readSession(next);
  assert.deepEqual(
    { ...after, state: administrative(after.state, backup.payload.state) },
    backup.payload,
  );
  assert.deepEqual(administrative(afterView, view), view);
  assert.deepEqual(after.state.physical.cycle.seed, origin);
  await recoverSeat(next, r.player);
  await recoverSeat(next, r.other);
  r.host = next;
  await evidence(label, {
    backup,
    view,
    restored: after,
    restoredView: afterView,
    packless: true,
    sigkill: true,
  });
  return backup;
}

test('accepted SIGKILL/empty packless restores retain the paid choice, Scout cards, preparation, acknowledgement and return', async (t) => {
  const r = await readySearches(t);
  await reachSearch(r);
  const origin = (await readBackup(r.host)).payload.state.physical.cycle.seed;
  await ok(commitSearch(r));
  await cut(t, r, 'choice-paid');
  await ok(scenarioInput(r.host, r.player, { kind: 'choice', event: 'STUDY' }));
  const cards = await cut(t, r, 'choice-scout-cards'),
    q = cards.payload.state.physical.snapshot.active;
  await ok(
    scenarioInput(r.host, r.player, {
      kind: 'physical-scout',
      prepare: q.options[0].id,
      discard: null,
      top: [q.options[1].id],
      bottom: [],
    }),
  );
  await cut(t, r, 'choice-effect-committed');
  await ok(scenarioInput(r.host, r.player, { kind: 'ack' }));
  const final = await cut(t, r, 'choice-cleanup-return');
  assert.equal(searchNode(final.payload.state).stopped, true);
  assert.deepEqual(final.payload.state.physical.cycle.seed, origin);
});

test('accepted SIGKILL/empty packless restores retain count reveal/conversion, a look, exact order and final return', async (t) => {
  const r = await readySearches(t);
  await reachSearch(r, 'challenge');
  await ok(commitSearch(r, 'challenge'));
  await cut(t, r, 'count-paid');
  await ok(scenarioInput(r.host, r.player, { kind: 'physical-choice', option: 'reveal' }));
  await cut(t, r, 'count-revealed');
  await ok(scenarioInput(r.host, r.player, { kind: 'physical-choice', option: 'inspiration' }));
  await cut(t, r, 'count-converted');
  await ok(scenarioInput(r.host, r.player, { kind: 'physical-choice', option: 'resolve' }));
  const look = await cut(t, r, 'count-one-look'),
    q = look.payload.state.physical.snapshot.active;
  assert.equal(q.scoutPrepareAllowed, false);
  await ok(
    scenarioInput(r.host, r.player, {
      kind: 'physical-scout',
      prepare: null,
      discard: null,
      top: [q.options[1].id],
      bottom: [q.options[0].id],
    }),
  );
  await cut(t, r, 'count-look-arranged');
  await ok(scenarioInput(r.host, r.player, { kind: 'ack' }));
  const final = await cut(t, r, 'count-one-return');
  assert.equal(searchNode(final.payload.state, 'challenge').variables.tally, 1);
  assert.equal(searchNode(final.payload.state, 'challenge').stopped, true);
});

test('packless restore preserves both high alternatives and actual discard preparation; all resigned negatives reject422 with whole payload/view unchanged', async (t) => {
  const r = await readySearches(t);
  await reachSearch(r, 'challenge');
  await ok(commitSearch(r, 'challenge'));
  for (const option of ['reveal', 'inspiration', 'inspiration', 'resolve'])
    await ok(scenarioInput(r.host, r.player, { kind: 'physical-choice', option }));
  await cut(t, r, 'count-high-alternatives');
  await ok(scenarioInput(r.host, r.player, { kind: 'physical-choice', option: 'prepare-discard' }));
  const at = await cut(t, r, 'count-high-discard-candidates'),
    q = at.payload.state.physical.snapshot.active;
  await ok(scenarioInput(r.host, r.player, { kind: 'physical-select', ids: [q.options[0].id] }));
  await cut(t, r, 'count-high-prepared');
  await ok(scenarioInput(r.host, r.player, { kind: 'ack' }));
  const final = await cut(t, r, 'count-high-return'),
    view = await readSession(r.host),
    payload = (await readBackup(r.host)).payload;
  const edits = [
    (b) => searchNode(b.payload.state, 'challenge').variables.tally++,
    (b) => (b.payload.state.scenario.play.tests[0].successes = 0),
    (b) => (b.payload.state.scenario.play.tests[0].total = 99),
    (b) => (b.payload.state.scenario.play.attempts[0].cost = 0),
    (b) => (b.payload.state.scenario.play.attempts[0].returned = false),
    (b) => (b.payload.state.scenario.play.attempts[0].heroId = 'hero-2'),
    (b) => b.payload.state.scenario.pack.manifest.searches.ownedProductIds.push(5),
    (b) =>
      b.payload.state.physical.cycle.seed.scenario.pack.manifest.searches.ownedProductIds.push(9),
    (b) => (b.payload.state.physical.runs.at(-1).answers[0].cursor = 'f'.repeat(64)),
    (b) => b.payload.state.preparation.heroes[0].prepared.push('foreign-copy:1'),
    (b) =>
      (b.payload.state.physical.cycle.records.find(
        (r) => r.intent.input?.option === 'inspiration',
      ).playerId = r.other.body.player.id),
    (b) =>
      (b.payload.state.physical.cycle.records.find(
        (r) => r.intent.input?.option === 'inspiration',
      ).intent.sourceFingerprint = 'e'.repeat(64)),
    (b) => (b.payload.commands.at(-1).receipt.source = 'd'.repeat(64)),
    (b) => (b.payload.state.schemaVersion = 24),
    (b) => {
      delete b.payload.state.scenario.pack.manifest.searches;
      delete b.payload.state.physical.cycle.seed.scenario.pack.manifest.searches;
    },
  ];
  for (const [index, edit] of edits.entries()) {
    const bad = structuredClone(final);
    edit(bad);
    signBackup(bad);
    const response = await r.host.request('/api/restores', {
      backup: bad,
      generation: view.generation,
      expectedRevision: view.revision,
      confirmed: true,
    });
    assert.equal(response.status, 422, `negative ${index}: ${await response.text()}`);
    assert.deepEqual((await readBackup(r.host)).payload, payload);
    assert.deepEqual(await readSession(r.host), view);
    await evidence('negative-' + index, {
      backup: bad,
      status: 422,
      wholePayloadUnchanged: true,
      wholeViewUnchanged: true,
    });
  }
});
