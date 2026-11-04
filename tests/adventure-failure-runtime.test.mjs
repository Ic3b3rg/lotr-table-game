import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime, pumpPhaseEvent } from './clue-progression-helper.mjs';
import { attachFailure } from './fixtures/adventure-failure.mjs';
import { state } from './fixtures/scenario.mjs';
import { buildSync } from 'esbuild';
const code = buildSync({
  stdin: {
    contents: `export { beginHeroFailure, advanceConclusion } from './src/scenario/conclusion'; export { beginSourceShadow } from './src/scenario/round-source';`,
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
});
const { beginHeroFailure, advanceConclusion } = await import(
  `data:text/javascript;base64,${Buffer.from(Buffer.from(code.outputFiles[0].contents).toString() + '\n//# sourceURL=adventure-failure-driver.mjs').toString('base64')}`
);
function fixture() {
  const f = runtime([state(0)]),
    s = f.state,
    sc = s.scenario;
  attachFailure(sc.pack);
  sc.globals.inventedWon = true;
  const d = sc.pack.definitions.find((d) => d.source === sc.pack.principal);
  Object.assign(f.i, {
    id: 'principal',
    kind: 'principal',
    definition: d.source,
    state: d.initial,
    settled: true,
  });
  sc.play.active = null;
  sc.play.attempts = [];
  sc.pack.manifest.failure.partyBonus.skills = s.preparation.heroes.flatMap((h) =>
    [...h.deck, ...h.prepared, ...h.discard].map((c) => ({
      cardId: c.slice(0, c.lastIndexOf(':')),
      modelId: 20,
    })),
  );
  s.physical.snapshot.lastStand = {
    heroes: s.preparation.heroes.map((h, n) => ({ heroId: h.heroId, defeated: n === 0 })),
    lossDue: {
      runId: s.generation,
      heroId: s.preparation.heroes[0].heroId,
      instructionHash: 'a'.repeat(64),
    },
    titles: [],
  };
  s.round = { number: 2, phase: 'action' };
  return f;
}
test('source failure preserves episode, waits for both messages and awards the selected roles on concurrent entry once', () => {
  const f = fixture(),
    s = f.state,
    sc = s.scenario,
    cards = structuredClone(s.preparation),
    before = s.physical.snapshot;
  assert.equal(beginHeroFailure(s, 'shadow-start', 'invented-trigger-request-000000001'), true);
  assert.equal(sc.pending.text[0].text, 'Conclusione inventata');
  assert.equal(sc.instances.find((i) => i.kind === 'principal').processing, 1);
  assert.deepEqual(sc.conclusion.xp, []);
  // Exercise the existing source consumer and its real hide callback.
  const q = sc.pending;
  f.answer = {
    type: 'SCENARIO_INPUT',
    generation: s.generation,
    requestId: 'invented-message-request-00000001',
    expectedRevision: 0,
    scenarioId: sc.id,
    packFingerprint: sc.packFingerprint,
    projectionFingerprint: sc.projectionFingerprint,
    pendingId: q.id,
    sourceFingerprint: q.fingerprint,
    heroId: null,
    input: { kind: 'ack' },
  };
  return import('./clue-progression-helper.mjs').then(({ resumeScenario }) => {
    resumeScenario(s, s.players[0].id, f.answer);
    assert.equal(sc.pending.text[0].text, 'Premi inventati');
    assert.deepEqual(
      sc.conclusion.xp.map((x) => [x.heroId, x.roleId, x.amount]),
      cards.heroes.map((h) => [h.heroId, h.roleId, 7]),
    );
    assert.equal(sc.play.lore, 5);
    pumpPhaseEvent(s);
    assert.equal(sc.play.lore, 5);
    const q2 = sc.pending;
    resumeScenario(s, s.players[1].id, {
      ...f.answer,
      requestId: 'invented-message-request-00000002',
      pendingId: q2.id,
      sourceFingerprint: q2.fingerprint,
    });
    advanceConclusion(s);
    assert.equal(sc.conclusion.stage, 'campaign-map');
    assert.deepEqual(sc.conclusion.completedAdventureIds, [sc.pack.identity.adventureId]);
    assert.equal(sc.conclusion.nextAdventureId, 42);
    assert.equal(sc.conclusion.campaign.next.status, 'requires-content');
    assert.deepEqual(s.preparation, cards);
    assert.deepEqual(s.physical.snapshot, before);
    assert.equal(sc.instances.find((i) => i.id === 'principal').stopped, true);
  });
});
test('a deferred hero loss never starts during an already running Shadow; the last hero uses its immediate boundary', () => {
  const f = fixture(),
    s = f.state;
  s.round.phase = 'shadow';
  assert.equal(beginHeroFailure(s, 'shadow-start', 'invented-trigger-request-000000002'), false);
  assert.equal(s.scenario.conclusion, undefined);
  s.physical.snapshot.lastStand.heroes.forEach((h) => (h.defeated = true));
  s.physical.snapshot.lastStand.terminal = { ...s.physical.snapshot.lastStand.lossDue };
  assert.equal(beginHeroFailure(s, 'no-active-heroes', 'invented-trigger-request-000000002'), true);
  assert.equal(s.scenario.conclusion.timing, 'no-active-heroes');
});

test('campaign-owned title cards remain separate from the controller equipped-skill check', () => {
  const f = fixture(),
    s = f.state,
    h = s.preparation.heroes[0];
  h.prepared.push('invented-title:1');
  s.physical.snapshot.lastStand.titles.push({
    heroId: h.heroId,
    cardId: 'invented-title',
    copy: 'invented-title:1',
    removed: false,
    pending: false,
  });
  assert.equal(beginHeroFailure(s, 'shadow-start', 'invented-trigger-request-000000003'), true);
});

test('the controller party bonus is applied on signal exactly once before principal message rewards', () => {
  const f = fixture(),
    s = f.state,
    sc = s.scenario;
  sc.pack.manifest.failure.partyBonus.skills[0].modelId = 888;
  assert.equal(beginHeroFailure(s, 'shadow-start', 'invented-trigger-request-000000004'), true);
  assert.equal(sc.play.lore, 2);
  assert.equal(sc.conclusion.bonusLore, 2);
  assert.equal(beginHeroFailure(s, 'shadow-start', 'invented-trigger-request-000000004'), false);
  assert.equal(sc.play.lore, 2);
});
