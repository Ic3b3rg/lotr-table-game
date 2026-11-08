import { readSession, ok } from './battle-combat-helper.mjs';
import { cycleCommand } from './physical-cycle-helper.mjs';

export async function endBattleTurns(r) {
  for (const actor of r.actors) {
    const s = await readSession(r.host);
    const hero = s.preparation.heroes.find((h) => h.playerId === actor.body.player.id);
    await ok(cycleCommand(r, 'START_TURN', { heroId: hero.heroId }, actor));
    await ok(cycleCommand(r, 'END_TURN', { heroId: hero.heroId }, actor));
  }
  return readSession(r.host);
}

import { stepBattle, scenarioInput, readyBattle } from './battle-combat-helper.mjs';
import { attachBattleRounds } from './fixtures/battle-rounds.mjs';
import { answerCycle } from './original-round-helper.mjs';
export function readyBattleRounds(
  t,
  {
    outcome = 'win',
    sourceEdit = () => {},
    catalogEdit = () => {},
    weaponBody = '1 Success: 2 hits\n2 Successes: 4 hits',
    ...options
  } = {},
) {
  return readyBattle(t, {
    ...options,
    outcome,
    catalogEdit: (catalog) => {
      // Literal invented cards/stats are authored before the camp bootstrap; the whole population is retained.
      for (const h of catalog.heroes) {
        h.stats.damage = 20;
        h.stats.fear = 12;
        for (const stat of ['might', 'agility', 'spirit', 'wisdom', 'wit']) h.stats[stat] = 10;
      }
      if (outcome === 'loss') catalog.heroes[0].stats.wit = 0;
      for (const card of catalog.skills) {
        card.success = card.kind === 'weakness' ? 0 : 1;
        card.fate = card.kind === 'weakness' ? 0 : 1;
      }
      catalogEdit(catalog);
    },
    edit: (departure, source, pack, ...args) => {
      if (outcome === 'loss') {
        const prefab = pack.manifest.prefabs.find((p) => p.source === pack.manifest.lair.prefab);
        const lair = pack.definitions.find((d) => d.source === prefab.fsmSource);
        lair.states.find((s) => s.index === 103).actions[0].consequence.amount = 13;
      }
      for (const item of source.items) if (item.stat) item.body = weaponBody;
      sourceEdit(departure, source, pack, ...args);
      attachBattleRounds(departure, source, pack, ...args);
    },
  });
}
export function physicalInput(q) {
  if (q.kind !== 'decision') throw Error(`Mandatory physical closure is gated: ${q.reason}`);
  const budget = q.purpose === 'negation' ? q.maximum : 0;
  const damage = Math.min(budget, q.remaining?.damage ?? 0),
    fear = Math.min(budget - damage, q.remaining?.fear ?? 0);
  return q.mode === 'allocate'
    ? { kind: 'physical-allocate', ability: q.options[0]?.id ?? null, damage, fear }
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
              ['reveal', 'resolve', 'apply', 'close', 'close-rest', 'keep'].find((id) =>
                q.options.some((o) => o.id === id && !o.unavailable),
              ) ?? q.options.find((o) => !o.unavailable).id,
          };
}
export async function drainPhase(r, { pause = () => false } = {}) {
  for (let n = 0; n < 500; n++) {
    const s = await readSession(r.host);
    if (pause(s) || s.scenario?.conclusion?.stage === 'camp') return s;
    const source = s.scenario?.pending;
    if (source) {
      const input = source.kind === 'physical' ? physicalInput(s.physical.active) : { kind: 'ack' };
      const actor = r.actors.find((a) => a.body.player.id === source.actorPlayerId) ?? r.player;
      await ok(scenarioInput(r.host, actor, input));
    } else if (s.physical?.active) {
      const actor = r.actors.find((a) => a.body.player.id === s.physical.active.actorPlayerId);
      const q = s.physical.active,
        slot = s.physical.attackTest?.slots
          .filter((x) => q.options.some((o) => o.id === `slot:${x.id}` && !o.unavailable))
          .sort((a, b) => b.cost - a.cost)[0];
      await ok(
        answerCycle(
          r,
          slot ? { kind: 'physical-choice', option: `slot:${slot.id}` } : physicalInput(q),
          s,
          actor,
        ),
      );
    } else if (s.combat?.current || s.combat?.pending) await stepBattle(r, s);
    else return s;
  }
  throw Error('Certified source phase did not return');
}
export async function completeRally(r) {
  for (const actor of r.actors) {
    const s = await readSession(r.host),
      hero = s.preparation.heroes.find((h) => h.playerId === actor.body.player.id);
    if (s.round.heroes.find((h) => h.heroId === hero.heroId).rallyDone) continue;
    await ok(cycleCommand(r, 'START_RALLY_SCOUT', { heroId: hero.heroId }, actor));
    await drainPhase(r);
  }
  const s = await readSession(r.host);
  if (!s.round.heroes.every((h) => h.rallyDone))
    throw Error('All three actual owner Scouts are required');
  await ok(cycleCommand(r, 'END_RALLY', { agreed: true }, r.other));
  return readSession(r.host);
}
