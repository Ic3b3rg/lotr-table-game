import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  readyBattle,
  departBattle,
  readSession,
  readBackup,
  command,
  ok,
  attackIntent,
} from './battle-combat-helper.mjs';
import { cycleCommand } from './physical-cycle-helper.mjs';
import { hash } from './fixtures/map-freeze.mjs';
import { sha } from './fixtures/combat-closure.mjs';

test('actual battle walls and unknown mandatory benefit stock reject whole intents before cost, cards or entropy', async (t) => {
  const r = await readyBattle(t, {
    edit: (_departure, source) => {
      for (const a of source.assets.filter((a) => a.cls === 'EnemyActivationModel')) {
        a.data.KeyAttackAdditionalEffect = 'extra';
        a.dataHash = hash(a.data);
      }
      const text = source.texts.find((t) => t.key === 'extra');
      text.value = 'Conseguenza interamente inventata: ottieni un beneficio.';
      text.sha256 = sha(text.value);
      Object.assign(source.additions[0], {
        textHash: text.sha256,
        predicate: 'always',
        window: 'after-enemy-attack',
        effect: { op: 'gain-boon', boon: null },
      });
    },
  });
  t.after(() => t.diagnostic(r.host.diagnostics()));
  await departBattle(r);
  await ok(cycleCommand(r, 'START_TURN'));
  await ok(cycleCommand(r, 'START_TRAVEL'));
  let s = await readSession(r.host);
  const top = s.scenario.spaceBindings.find((b) => b.sourceId === 'west/veranda').id;
  await ok(
    cycleCommand(r, 'MOVE_HERO', {
      fromSpaceId: s.journey.heroes[0].spaceId,
      destinationSpaceId: top,
    }),
  );
  s = await readSession(r.host);
  const across = s.scenario.spaceBindings.find((b) => b.sourceId === 'east/atrium').id,
    beforeWall = await readBackup(r.host);
  const wall = await cycleCommand(r, 'MOVE_HERO', { fromSpaceId: top, destinationSpaceId: across });
  assert.equal(wall.status, 409, await wall.clone().text());
  assert.equal((await wall.json()).error.code, 'NOT_ADJACENT');
  assert.deepEqual((await readBackup(r.host)).payload, beforeWall.payload);
  await ok(cycleCommand(r, 'END_TURN'));
  await ok(cycleCommand(r, 'START_TURN', {}, r.other));
  await ok(cycleCommand(r, 'START_TRAVEL', {}, r.other));
  s = await readSession(r.host);
  const hero = s.preparation.heroes.find((h) => h.playerId === r.other.body.player.id),
    from = s.journey.heroes.find((h) => h.heroId === hero.heroId).spaceId,
    adjacent = s.journey.definition.connections.flatMap(([a, b]) =>
      a === from ? [b] : b === from ? [a] : [],
    ),
    g = s.scenario.enemies.groups.find((g) =>
      adjacent.includes(s.scenario.spaceBindings.find((b) => b.sourceId === g.spaceId).id),
    ),
    destination = s.scenario.spaceBindings.find((b) => b.sourceId === g.spaceId).id;
  await ok(
    cycleCommand(
      r,
      'MOVE_HERO',
      { fromSpaceId: from, destinationSpaceId: destination },
      { ...r.other },
    ),
  );
  s = await readSession(r.host);
  const offer = s.combat.attacks.find((o) => o.groupId === g.id),
    before = await readBackup(r.host);
  assert.match(offer.reason, /riserva.*verificata/);
  const denied = await command(r.host, r.other, attackIntent(s, offer));
  assert.equal(denied.status, 409, await denied.clone().text());
  assert.equal((await denied.json()).error.code, 'ATTACK_CLOSURE');
  assert.deepEqual((await readBackup(r.host)).payload, before.payload);
  const raw = {
      ...attackIntent(s, offer),
      requestId: randomUUID(),
      generation: randomUUID(),
      expectedRevision: s.revision,
    },
    wrongGeneration = await r.host.request('/api/commands', raw, r.other.cookie);
  assert.equal(wrongGeneration.status, 409, await wrongGeneration.text());
  assert.deepEqual((await readBackup(r.host)).payload, before.payload);
  const program = await command(r.host, r.other, {
    ...attackIntent(s, offer),
    program: { manualResult: true },
  });
  assert.equal(program.status, 422, await program.clone().text());
  assert.equal((await program.json()).error.code, 'INVALID_INPUT');
  assert.deepEqual((await readBackup(r.host)).payload, before.payload);
});
