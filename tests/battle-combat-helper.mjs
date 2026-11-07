import {
  readyDeparture,
  confirmedCamp,
  finishSetup,
  scenarioInput,
  readSession,
  readBackup,
  command,
  ok,
} from './camp-departure-helper.mjs';
import { attachBattleCombat } from './fixtures/battle-combat.mjs';
import assert from 'node:assert/strict';
import { answerCycle } from './original-round-helper.mjs';
export async function readyBattle(
  t,
  { edit = () => {}, catalogEdit = () => {}, singleFigureGroups = false, ...options } = {},
) {
  return readyDeparture(t, {
    ...options,
    catalogEdit: (catalog) => {
      for (const h of catalog.heroes) h.stats.might = 2;
      for (const s of catalog.skills) s.fate = 1;
      catalogEdit(catalog);
    },
    edit: (pack, frozen, catalog, fronts) =>
      attachBattleCombat(pack, frozen, catalog, (...args) => edit(...args, fronts), {
        singleFigureGroups,
      }),
  });
}
export async function enterAdjacentEnemy(r) {
  const { cycleCommand } = await import('./physical-cycle-helper.mjs');
  await ok(cycleCommand(r, 'START_TURN'));
  await ok(cycleCommand(r, 'START_TRAVEL'));
  const s = await readSession(r.host),
    from = s.journey.heroes[0].spaceId,
    adjacent = s.journey.definition.connections.flatMap(([a, b]) =>
      a === from ? [b] : b === from ? [a] : [],
    ),
    group = s.scenario.enemies.groups.find((g) =>
      adjacent.includes(s.scenario.spaceBindings.find((b) => b.sourceId === g.spaceId).id),
    );
  assert.ok(group, 'Source spawn must supply the adjacent group');
  const destination = s.scenario.spaceBindings.find((b) => b.sourceId === group.spaceId).id;
  await ok(cycleCommand(r, 'MOVE_HERO', { fromSpaceId: from, destinationSpaceId: destination }));
  return { from, destination, group };
}
export function attackIntent(s, offer = s.combat.attacks.find((o) => !o.reason)) {
  assert.ok(offer, 'A complete legal source offer is required');
  return {
    type: 'START_ATTACK',
    roundId: s.round.id,
    turnId: s.round.turnId,
    heroId: offer.heroId,
    groupId: offer.groupId,
    itemCopies: offer.itemCopies,
    stat: offer.stat,
    replaceCopy: null,
    grantId: null,
  };
}
export async function stepBattle(r, s, choose = () => null) {
  const q = s.physical.active;
  if (q) {
    assert.equal(q.kind, 'decision', 'Mandatory physical closure must be supported');
    const actor = r.actors.find((a) => a.body.player.id === q.actorPlayerId);
    const slot = s.physical.attackTest?.slots
      .filter((slot) => q.options.some((o) => o.id === `slot:${slot.id}` && !o.unavailable))
      .sort((a, b) => b.cost - a.cost)[0];
    const input =
      q.mode === 'allocate'
        ? { kind: 'physical-allocate', ability: null, damage: 0, fear: 0 }
        : q.mode === 'select'
          ? { kind: 'physical-select', ids: q.options.slice(0, q.minimum).map((o) => o.id) }
          : q.mode === 'scout'
            ? {
                kind: 'physical-scout',
                prepare: null,
                discard: null,
                top: q.options.map((o) => o.id),
                bottom: [],
              }
            : {
                kind: 'physical-choice',
                option:
                  choose(q, s) ??
                  (slot ? `slot:${slot.id}` : null) ??
                  ['reveal', 'resolve', 'apply', 'close', 'close-rest', 'keep'].find((id) =>
                    q.options.some((o) => o.id === id && !o.unavailable),
                  ) ??
                  q.options.find((o) => !o.unavailable).id,
              };
    return ok(answerCycle(r, input, s, actor));
  }
  const p = s.combat.pending;
  assert.ok(p, 'Combat must retain its source request');
  return ok(
    command(
      r.host,
      r.actors.find((a) => a.body.player.id === p.actorPlayerId),
      {
        type: 'COMBAT_INPUT',
        combatId: p.combatId,
        pendingId: p.id,
        sourceFingerprint: p.sourceFingerprint,
        choice:
          choose(p, s) ??
          p.options.find((o) => o.id === 'close' && !o.unavailable)?.id ??
          p.options.find((o) => !o.unavailable).id,
      },
      s,
    ),
  );
}
export async function drainBattle(r, { choose = () => null, pause = () => false } = {}) {
  for (let n = 0; n < 200; n++) {
    const s = await readSession(r.host);
    if (pause(s) || (!s.combat.current && !s.combat.pending && !s.physical.active)) return s;
    await stepBattle(r, s, choose);
  }
  assert.fail('Actual battle consumer did not return');
}
export async function departBattle(r) {
  const s = await confirmedCamp(r);
  await ok(
    scenarioInput(r.host, r.player, {
      kind: 'camp-depart',
      offerFingerprint: s.campDeparture.fingerprint,
      agreed: true,
    }),
  );
  await finishSetup(r);
  return readSession(r.host);
}
export { confirmedCamp, finishSetup, scenarioInput, readSession, readBackup, command, ok };
