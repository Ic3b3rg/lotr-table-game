import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { reviewBattle } from './fixtures/battle-combat-review.mjs';
import { attachBattleRounds } from './fixtures/battle-rounds.mjs';
import { battleRuntime as runtime } from './battle-combat-runtime.mjs';

export async function phaseState({ groups = false, sourceEdit = () => {}, heroCount = 3 } = {}) {
  const f = await reviewBattle({
    heroCount,
    sourceEdit: (...args) => {
      sourceEdit(...args);
      attachBattleRounds(...args);
    },
  });
  const s = f.state,
    sc = s.scenario,
    cap = f.cap.battleRounds;
  s.round.activeHeroId = s.round.turnId = null;
  s.round.heroes.forEach((h) => {
    h.turnEnded = true;
  });
  sc.instances[0].variables.nextThreshold = 3 * heroCount;
  sc.threats = [{ source: cap.thresholds[0].source, threshold: 3 * heroCount }];
  sc.enemies.entropy = '2'.repeat(64);
  if (!groups) sc.enemies.groups = [];
  return f;
}
export function answerSource(state, input = { kind: 'ack' }, playerId = state.players[0].id) {
  const sc = state.scenario,
    q = sc.pending;
  assert.ok(q);
  // The combat review driver deliberately offsets physical evidence by ten revisions.
  // Align its local counter before crossing into the actual source response handler.
  state.revision = Math.max(
    state.revision,
    ...state.physical.runs.flatMap((r) => r.answers.map((a) => a.evidence.revision)),
  );
  const command = {
    type: 'SCENARIO_INPUT',
    requestId: randomUUID(),
    generation: state.generation,
    expectedRevision: state.revision,
    scenarioId: sc.id,
    packFingerprint: sc.packFingerprint,
    projectionFingerprint: sc.projectionFingerprint,
    pendingId: q.id,
    sourceFingerprint: q.fingerprint,
    heroId: q.heroId,
    input,
  };
  runtime.resumeScenario(state, q.actorPlayerId ?? playerId, command);
  state.revision++;
}
export function drainSource(state) {
  for (let n = 0; n < 100; n++) {
    if (!state.scenario.pending) {
      runtime.advanceSourceShadow(state);
      if (!state.scenario.pending) return;
    }
    assert.notEqual(state.scenario.pending.kind, 'physical');
    answerSource(state);
  }
  assert.fail('Source closure failed to return');
}
