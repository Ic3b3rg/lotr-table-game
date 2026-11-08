import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readyTerrain, terrainTurn } from './battle-test-terrain-helper.mjs';
import {
  readBackup,
  readSession,
  command,
  attackIntent,
  drainBattle,
  stepBattle,
  ok,
} from './battle-combat-helper.mjs';
import { answerCycle } from './original-round-helper.mjs';

export function terrainIntent(s, input) {
  const { type: _, ...binding } = s.physical.cycle.pending;
  return { type: 'CYCLE_INPUT', ...binding, input };
}
let rejected = 0;
export async function deniedTerrain(r, actor, intent, s, status, code) {
  const before = (await readBackup(r.host)).payload;
  const response = await command(r.host, actor, intent, s),
    body = await response.json();
  const after = (await readBackup(r.host)).payload;
  if (process.env.TERRAIN_EVIDENCE_DIR) {
    await writeFile(
      join(process.env.TERRAIN_EVIDENCE_DIR, `rejected-${rejected++}-${intent.type}-${code}.json`),
      JSON.stringify({ intent, status: response.status, body, before, after }),
    );
  }
  assert.deepEqual(after, before, 'Full domain and every receipt stay unchanged');
  assert.equal(response.status, status, JSON.stringify(body));
  assert.equal(body.error.code, code, JSON.stringify(body));
}
for (const variant of ['pierce', 'smite', 'boulder'])
  test(`actual source-bound ${variant} payment, enemy reply and ordinary return`, async (t) => {
    const kind = variant === 'boulder' ? 'rock' : 'fire',
      r = await readyTerrain(t, { kind });
    t.after(() => t.diagnostic(r.host.diagnostics()));
    let s = await terrainTurn(r);
    const offer = s.combat.attacks.find((o) => o.heroId === s.round.activeHeroId && !o.reason),
      before = (await readBackup(r.host)).payload,
      intent = attackIntent(s, offer),
      response = await command(r.host, r.player, intent, s),
      body = await response.json();
    if (process.env.TERRAIN_EVIDENCE_DIR) {
      await mkdir(process.env.TERRAIN_EVIDENCE_DIR, { recursive: true });
      await writeFile(
        join(process.env.TERRAIN_EVIDENCE_DIR, `consumer-${variant}.json`),
        JSON.stringify({
          intent,
          status: response.status,
          body,
          before,
          after: (await readBackup(r.host)).payload,
        }),
      );
    }
    if (response.status !== 200) assert.deepEqual((await readBackup(r.host)).payload, before);
    assert.equal(response.status, 200, JSON.stringify({ body, reason: offer.reason }));
    s = await drainBattle(r, {
      pause: (s) =>
        s.physical.sourceTest?.terrain?.kind === (variant === 'boulder' ? 'negate' : 'attack'),
    });
    const q = s.physical.active,
      view = s.physical.sourceTest;
    assert.ok(q && view);
    assert.equal(s.combat.current.stage, variant === 'boulder' ? 'counterattack' : 'attack-test');
    assert.ok(view.cards.length);
    const prefix = variant === 'boulder' ? 'terrain:boulder:' : 'terrain:fire:',
      option = q.options.find(
        (o) => o.id.startsWith(prefix) && (variant === 'boulder' || o.id.endsWith(':' + variant)),
      );
    assert.ok(option, 'Actual source context must offer the real placed terrain');
    const payment = terrainIntent(s, { kind: 'physical-choice', option: option.id });
    await deniedTerrain(
      r,
      r.player,
      { ...payment, testTerrain: { tokens: ['client-fire'] } },
      s,
      422,
      'INVALID_INPUT',
    );
    await deniedTerrain(
      r,
      r.player,
      payment,
      { ...s, revision: s.revision - 1 },
      409,
      'TABLE_CHANGED',
    );
    await deniedTerrain(
      r,
      r.player,
      payment,
      { ...s, generation: randomUUID() },
      409,
      'SESSION_CHANGED',
    );
    await deniedTerrain(
      r,
      r.player,
      { type: 'END_TURN', roundId: s.round.id, turnId: s.round.turnId, heroId: view.heroId },
      s,
      409,
      'COMBAT_PENDING',
    );
    await deniedTerrain(r, r.other, payment, s, 403, 'PHYSICAL_ACTOR');
    await deniedTerrain(
      r,
      r.player,
      { ...payment, sourceFingerprint: '0'.repeat(64) },
      s,
      409,
      'CYCLE_REQUEST_CHANGED',
    );
    await deniedTerrain(
      r,
      r.player,
      { ...payment, pendingId: randomUUID() },
      s,
      409,
      'CYCLE_REQUEST_CHANGED',
    );
    await deniedTerrain(
      r,
      r.player,
      {
        ...payment,
        input: {
          kind: 'physical-choice',
          option:
            variant === 'boulder'
              ? 'terrain:boulder:foreign-token'
              : `terrain:fire:${'0'.repeat(64)}:${variant}`,
        },
      },
      s,
      409,
      'PHYSICAL_ALLOCATION',
    );
    await deniedTerrain(
      r,
      r.player,
      { ...payment, input: { kind: 'physical-choice', option: 'terrain:boulder:flame' } },
      s,
      409,
      'PHYSICAL_ALLOCATION',
    );
    const rawBefore = (await readBackup(r.host)).payload,
      requestId = randomUUID();
    const results = await Promise.all([
      command(r.host, r.player, { ...payment, requestId }, s),
      command(r.host, r.player, { ...payment, requestId }, s),
    ]);
    for (const result of results) assert.equal(result.status, 200, await result.clone().text());
    assert.deepEqual(await results[0].json(), await results[1].json());
    const paid = (await readBackup(r.host)).payload;
    assert.equal(paid.commands.length, rawBefore.commands.length + 1);
    assert.equal(
      paid.state.physical.runs.at(-1).answers.length,
      rawBefore.state.physical.runs.at(-1).answers.length + 1,
    );
    if (variant === 'boulder') {
      s = await readSession(r.host);
      if (s.physical.active.mode === 'select')
        await ok(
          answerCycle(
            r,
            { kind: 'physical-select', ids: [s.physical.active.options[0].id] },
            s,
            r.player,
          ),
        );
      s = await readSession(r.host);
      assert.equal(s.physical.sourceTest.terrain.bouldersUsed.length, 1);
      assert.equal(s.physical.sourceTest.successes, view.successes + 1);
      assert.equal(s.physical.sourceTest.fateRemaining, view.fateRemaining - 1);
      assert.equal(
        s.preparation.heroes[0].inspiration,
        rawBefore.state.preparation.heroes[0].inspiration,
      );
      await ok(answerCycle(r, { kind: 'physical-choice', option: 'resolve' }, s, r.player));
      s = await readSession(r.host);
      assert.equal(s.physical.active.mode, 'allocate');
      const a = s.physical.active,
        damage = Math.min(a.maximum, a.remaining.damage),
        fear = Math.min(a.maximum - damage, a.remaining.fear);
      await ok(
        answerCycle(r, { kind: 'physical-allocate', ability: null, damage, fear }, s, r.player),
      );
      assert.ok(damage + fear > 0, 'A performed negate must apply the converted success');
    } else {
      s = await readSession(r.host);
      assert.equal(s.physical.sourceTest.terrain.fire.modifier, variant);
      const token = option.id.split(':')[2],
        card = view.cards.find((c) => c.copy === token);
      assert.ok(card);
      assert.equal(s.physical.sourceTest.successes, view.successes - card.success);
      assert.equal(s.physical.sourceTest.fateRemaining, view.fateRemaining - card.fate);
      assert.equal(s.physical.sourceTest.cards.length, view.cards.length - 1);
      assert.equal(
        s.preparation.heroes[0].inspiration,
        rawBefore.state.preparation.heroes[0].inspiration,
      );
    }
    await deniedTerrain(
      r,
      r.player,
      payment,
      await readSession(r.host),
      409,
      'CYCLE_REQUEST_CHANGED',
    );
    await drainBattle(r);
    const final = (await readBackup(r.host)).payload.state,
      attempt = final.combat.attempts[0];
    assert.equal(attempt.returned, true);
    assert.equal(final.combat.active, null);
    assert.equal(attempt.packet.executed, true);
    assert.equal(final.round.heroes[0].actionsUsed, 2);
    assert.equal(final.journey.travel.remaining, 2);
    assert.equal(
      final.physical.snapshot.parents.filter((p) => p.id === attempt.attackRunId).length <= 1,
      true,
    );
    if (variant !== 'boulder') assert.ok(attempt.result.modifiers.includes(variant));
    else assert.ok(attempt.outcome.negated.damage + attempt.outcome.negated.fear > 0);
    assert.equal(
      final.physical.cycle.records.filter((r) => r.intent.type === 'START_ATTACK').length,
      1,
    );
    assert.deepEqual(final.episodes[0], before.state.episodes[0], 'A1 archive remains byte exact');
    if (process.env.TERRAIN_EVIDENCE_DIR)
      await writeFile(
        join(process.env.TERRAIN_EVIDENCE_DIR, `returned-${variant}.json`),
        JSON.stringify(await readBackup(r.host)),
      );
  });
