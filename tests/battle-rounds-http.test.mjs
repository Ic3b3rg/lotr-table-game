import { startHost } from './host-helper.mjs';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readyBattle,
  departBattle,
  readBackup,
  readSession,
  command,
  ok,
} from './battle-combat-helper.mjs';
import {
  endBattleTurns,
  drainPhase,
  completeRally,
  readyBattleRounds,
} from './battle-rounds-helper.mjs';

test('legacy combat-only A2 preserves the real three-owner phase gate and entire payload', async (t) => {
  const r = await readyBattle(t);
  await departBattle(r);
  const at = await endBattleTurns(r);
  assert.ok(at.round.heroes.every((h) => h.turnEnded));
  assert.equal(at.round.activeHeroId, null);
  const before = (await readBackup(r.host)).payload;
  const response = await command(r.host, r.other, {
    type: 'BEGIN_SHADOW',
    roundId: at.round.id,
    agreed: true,
  });
  const rejected = await response.json();
  assert.equal(response.status, 409);
  assert.equal(rejected.error.code, 'BATTLE_STARTUP_BOUNDARY');
  assert.deepEqual((await readBackup(r.host)).payload, before);
});

import { cycleCommand } from './physical-cycle-helper.mjs';

import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

for (const outcome of ['win', 'loss'])
  test(`${outcome}: certified three-owner Shadow, identical concurrency, all Scouts and legal next turn`, async (t) => {
    const r = await readyBattleRounds(t, { outcome });
    await departBattle(r);
    const at = await endBattleTurns(r);
    assert.ok(at.round.heroes.every((h) => h.turnEnded));
    assert.equal(at.scenario.battleRound.enabled, true);
    const before = (await readBackup(r.host)).payload;
    const intent = {
      type: 'BEGIN_SHADOW',
      roundId: at.round.id,
      agreed: true,
      requestId: randomUUID(),
    };
    const responses = await Promise.all([
      command(r.host, r.other, intent, at),
      command(r.host, r.other, intent, at),
      command(r.host, r.player, { ...intent, requestId: randomUUID() }, at),
    ]);
    assert.deepEqual(responses.map((r) => r.status).sort(), [200, 200, 409]);
    const receipts = await Promise.all(
      responses.filter((r) => r.status === 200).map((r) => r.json()),
    );
    assert.deepEqual(receipts[0].receipt, receipts[1].receipt);
    const after = await drainPhase(r);
    assert.equal(after.round.phase, 'shadow');
    assert.equal(after.round.shadowStep, 'threat');
    const source = (await readBackup(r.host)).payload.state;
    assert.equal(source.scenario.rounds.frames.at(-1).stage, 'threat');
    assert.equal(source.scenario.rounds.frames.at(-1).threat.delta, 7);
    assert.equal(source.scenario.rounds.frames.at(-1).threat.after, 7);
    assert.ok(source.combat.attempts.some((a) => a.kind === 'activation' && a.returned));
    assert.ok(source.scenario.enemies.groups.every((g) => g.exhausted));
    await ok(cycleCommand(r, 'CONFIRM_SHADOW_STEP', { step: 'threat', agreed: true }, r.player));
    assert.equal((await readSession(r.host)).round.phase, 'rally');
    const refreshed = (await readBackup(r.host)).payload.state;
    assert.ok(
      refreshed.scenario.enemies.groups.every((g) => !g.exhausted && g.attackReduction === 0),
    );
    const next = await completeRally(r);
    assert.equal(next.round.number, 2);
    assert.equal(next.round.phase, 'action');
    const hero = next.preparation.heroes.find((h) => h.playerId === r.other.body.player.id);
    await ok(cycleCommand(r, 'START_TURN', { heroId: hero.heroId }, r.other));
    const begun = await readSession(r.host);
    assert.equal(begun.round.activeHeroId, hero.heroId);
    assert.equal(begun.round.heroes.find((h) => h.heroId === hero.heroId).actionsUsed, 0);
    const final = await readBackup(r.host);
    assert.equal(final.payload.state.scenario.rounds.frames.length, 1);
    assert.equal(final.payload.state.scenario.rounds.frames[0].stage, 'complete');
    const text = JSON.stringify(begun.scenario);
    for (const word of [
      'battleRounds',
      'scriptedGroups',
      'battleRecipe',
      'callbacks',
      'source-battle-shadow-v1',
    ])
      assert.ok(!text.includes('"' + word + '"'));
    const stable = (await readBackup(r.host)).payload;
    const stale = await command(r.host, r.other, { ...intent, requestId: randomUUID() }, begun);
    assert.equal(stale.status, 409);
    assert.deepEqual((await readBackup(r.host)).payload, stable);
    await mkdir('.scratch/battle-rounds142/http', { recursive: true });
    await writeFile(
      `.scratch/battle-rounds142/http/${outcome}-${intent.requestId}.json`,
      JSON.stringify({ before, afterShadow: source, refreshed, final }, null, 2) + '\n',
      { flag: 'wx' },
    );
  });

import { attackIntent } from './battle-combat-helper.mjs';
import { terrainPolicy } from './fixtures/battle-test-terrain.mjs';

test('real camp episode reaches the named source victory through actual phases, legal travel, attacks and callback test', async (t) => {
  const r = await readyBattleRounds(t, {
    weaponBody: '1 Success: 12 hits\n2 Successes: 20 hits',
    sourceEdit: (d) => {
      d.combat.testTerrain = terrainPolicy();
    },
  });
  await departBattle(r);
  for (let round = 1; round <= 4; round++) {
    await endBattleTurns(r);
    await ok(cycleCommand(r, 'BEGIN_SHADOW'));
    await drainPhase(r);
    await ok(cycleCommand(r, 'CONFIRM_SHADOW_STEP', { step: 'threat' }));
    await drainPhase(r);
    await completeRally(r);
  }
  let full = (await readBackup(r.host)).payload.state;
  assert.equal(full.scenario.globals.battlePressure, 28);
  const first = full.scenario.enemies.groups.find((g) => g.battleRecipe === 'invented-captain');
  assert.ok(first?.placed);
  for (const combatRound of [5, 6]) {
    for (const actor of r.actors) {
      let s = await readSession(r.host);
      if (s.scenario.conclusion) break;
      const hero = s.preparation.heroes.find((h) => h.playerId === actor.body.player.id);
      await ok(cycleCommand(r, 'START_TURN', {}, actor));
      for (let n = 0; n < 12; n++) {
        s = await readSession(r.host);
        full = (await readBackup(r.host)).payload.state;
        if (s.scenario.conclusion) break;
        const target = full.scenario.enemies.groups.find(
            (g) => g.battleRecipe && g.figures.some((f) => f.health > 0),
          ),
          offer = s.combat.attacks.find((o) => o.groupId === target?.id && !o.reason);
        if (offer) {
          await ok(command(r.host, actor, attackIntent(s, offer), s));
          await drainPhase(r);
        } else {
          const progress = s.round.heroes.find((h) => h.heroId === hero.heroId);
          if (!s.journey.travel?.remaining) {
            if (progress.actionsUsed >= 2) break;
            await ok(cycleCommand(r, 'START_TRAVEL', {}, actor));
          }
          s = await readSession(r.host);
          const from = s.journey.heroes.find((h) => h.heroId === hero.heroId).spaceId,
            to = s.scenario.spaceBindings.find((b) => b.sourceId === target.spaceId).id;
          const queue = [[from]],
            seen = new Set([from]);
          let path;
          while (queue.length) {
            const p = queue.shift(),
              at = p.at(-1);
            if (at === to) {
              path = p;
              break;
            }
            for (const [a, b] of s.journey.definition.connections)
              for (const next of a === at ? [b] : b === at ? [a] : [])
                if (!seen.has(next)) {
                  seen.add(next);
                  queue.push([...p, next]);
                }
          }
          assert.ok(path?.[1], 'The real wall-aware graph must supply the next legal step');
          await ok(
            cycleCommand(r, 'MOVE_HERO', { fromSpaceId: from, destinationSpaceId: path[1] }, actor),
          );
          await drainPhase(r);
        }
        s = await readSession(r.host);
        if (
          s.round.heroes.find((h) => h.heroId === hero.heroId).actionsUsed === 2 &&
          !s.journey.travel?.remaining
        )
          break;
      }
      if (!(await readSession(r.host)).scenario.conclusion) {
        await ok(cycleCommand(r, 'END_TURN', {}, actor));
        await drainPhase(r);
      }
    }
    if ((await readSession(r.host)).scenario.conclusion) break;
    if (combatRound === 5) {
      await ok(cycleCommand(r, 'BEGIN_SHADOW'));
      await drainPhase(r);
      await ok(cycleCommand(r, 'CONFIRM_SHADOW_STEP', { step: 'threat' }));
      await drainPhase(r);
      await completeRally(r);
    }
  }
  const accepted = await readBackup(r.host),
    final = accepted.payload.state;
  await mkdir('.scratch/battle-rounds142/http', { recursive: true });
  await writeFile(
    `.scratch/battle-rounds142/http/named-${final.id}.json`,
    JSON.stringify(accepted),
  );
  t.diagnostic(
    JSON.stringify({
      round: final.round.number,
      callbacks: final.scenario.rounds.battle.callbacks.length,
      attacks: final.combat.attempts
        .filter((a) => a.kind === 'hero-attack')
        .map((a) => ({ returned: a.returned, applied: a.applied })),
      named: final.scenario.enemies.groups
        .filter((g) => g.battleRecipe)
        .map((g) => ({ recipe: g.battleRecipe, figures: g.figures })),
    }),
  );
  assert.ok(
    Buffer.byteLength(JSON.stringify(accepted)) > 4_194_304,
    'The real multi-phase journal exceeds the former restore transport limit',
  );
  const empty = await startHost({ LOTR_DATA_DIR: join(r.directory, 'named-victory-empty') });
  t.after(() => empty.stop());
  const fresh = await readSession(empty);
  await ok(
    empty.request('/api/restores', {
      backup: accepted,
      generation: fresh.generation,
      expectedRevision: fresh.revision,
      confirmed: true,
    }),
  );
  const restored = (await readBackup(empty)).payload,
    expected = structuredClone(accepted.payload);
  for (const key of ['generation', 'revision', 'updatedAt'])
    expected.state[key] = restored.state[key];
  assert.deepEqual(
    restored,
    expected,
    'The entire late source victory domain and all receipts restore without external packs',
  );
  assert.equal(final.scenario.conclusion?.outcome, 'victory');
  assert.equal(final.scenario.conclusion.cause.kind, 'source-victory');
  assert.ok(final.scenario.conclusion.xp.every((x) => x.amount === 4));
  assert.equal(final.scenario.conclusion.transitionCount, 1);
  assert.equal(final.scenario.play.tests.at(-1).stat, 'agility');
  assert.equal(final.scenario.rounds.battle.callbacks.length, 2);
  assert.ok(final.scenario.rounds.battle.callbacks.every((c) => c.returned));
  assert.ok(
    final.scenario.enemies.groups.some(
      (g) => !g.battleRecipe && g.figures.some((f) => f.health > 0),
    ),
    'Ordinary groups remain alive at source victory',
  );
});
