import test from 'node:test';
import assert from 'node:assert/strict';
import { readyBattle, departBattle, readBackup, command } from './battle-combat-helper.mjs';
import { endBattleTurns } from './battle-rounds-helper.mjs';

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
