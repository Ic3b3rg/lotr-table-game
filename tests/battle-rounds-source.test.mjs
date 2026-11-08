import test from 'node:test';
import assert from 'node:assert/strict';
import { departureFixture } from './fixtures/camp-departure.mjs';
import { attachBattleCombat } from './fixtures/battle-combat.mjs';
import { attachBattleRounds } from './fixtures/battle-rounds.mjs';
import { battleRuntime as runtime } from './battle-combat-runtime.mjs';

export async function phaseAuthority() {
  const f = await departureFixture();
  attachBattleCombat(
    f.input.pack,
    { preparation: { heroes: f.catalog.heroes.slice(0, 3).map((h) => ({ heroId: h.id })) } },
    f.catalog,
    attachBattleRounds,
  );
  return f.cap;
}

test('complete invented battle authority closes every phase owner, point, model, instruction and named recipe', async () => {
  const cap = await phaseAuthority(),
    checked = runtime.validateBattleRoundsSource(cap),
    pack = runtime.battleRoundsPack(cap);
  assert.equal(checked.cap.instances.length, 8);
  assert.deepEqual(
    checked.cap.instances.map((i) => i.role),
    ['principal', 'threshold', 'threshold', 'threshold', 'threshold', 'logic', 'logic', 'logic'],
  );
  assert.equal(checked.cap.points.length, 5);
  assert.equal(checked.combat.compiled.models.length, 3);
  assert.equal(checked.combat.source.shadow.instructions.length, 4);
  assert.equal(checked.combat.source.scriptedGroups.length, 3);
  assert.deepEqual(
    checked.cap.thresholds.map((t) => t.perHero * 3),
    [9, 18, 24, 33],
  );
  assert.equal(checked.rounds.threat.limit, 39);
  assert.deepEqual(pack.timers, []);
  assert.deepEqual(
    pack.definitions.flatMap((d) => Object.keys(d.handlers).filter((e) => e.includes('ROUND'))),
    [],
  );
  assert.equal(pack.manifest.rounds.configuration.mapType, 'battle');
  assert.equal(pack.manifest.rounds.threat.perUnexploredTile, 0);
});

test('prospective authority rejects missing mandatory owners, methods, bindings, geometry and cross-source substitutions', async () => {
  const cap = await phaseAuthority();
  for (const edit of [
    (c) => {
      c.battleRounds.boardFingerprint = '0'.repeat(64);
    },
    (c) => {
      c.battleRounds.baseCombatFingerprint = '0'.repeat(64);
    },
    (c) => {
      c.battleRounds.thresholds[1].perHero = 7;
    },
    (c) => {
      c.battleRounds.instances.pop();
    },
    (c) => {
      delete c.battleRounds.methods.refresh;
    },
    (c) => {
      c.battleRounds.globals.defaults.battleEnemyPoints = 1;
    },
    (c) => {
      c.battleRounds.rounds.threat.perUnexploredTile = 1;
    },
    (c) => {
      c.battleRounds.points[4].cell = 'another-board/cell';
    },
    (c) => {
      c.battleRounds.timers.push('example.assets:999');
    },
    (c) => {
      c.battleRounds.spawns.pop();
    },
    (c) => {
      c.battleRounds.definitions[6].states[1].deferredTransitions = {
        NEXT: 'unknown-mandatory-callback',
      };
    },
  ]) {
    const changed = structuredClone(cap);
    edit(changed);
    assert.throws(() => runtime.battleRoundsPack(changed));
  }
  const forged = structuredClone(cap);
  forged.combat.combat = structuredClone(forged.battleRounds.combat);
  assert.throws(() => runtime.battleRoundsPack(forged), /combattimento|fonte/i);
});
