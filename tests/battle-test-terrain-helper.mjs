import {
  readyBattle,
  departBattle,
  readSession,
  ok,
  attackIntent,
  command,
} from './battle-combat-helper.mjs';
import { terrainSource } from './fixtures/battle-test-terrain.mjs';
import { cycleCommand } from './physical-cycle-helper.mjs';
export async function readyTerrain(
  t,
  { kind = 'fire', tokens = 1, activate = true, fate = 1, edit = () => {}, ...options } = {},
) {
  return readyBattle(t, {
    ...options,
    catalogEdit: (c) => {
      for (const s of c.skills) {
        s.fate = fate;
        s.success = 1;
      }
      for (const h of c.heroes) {
        h.stats.might = 3;
        h.stats.agility = 3;
      }
    },
    edit: (d, source, ...rest) => {
      terrainSource(d, source, { kind, activate });
      edit(d, source, ...rest);
    },
  });
}
export async function terrainTurn(r) {
  await departBattle(r);
  await ok(cycleCommand(r, 'START_TURN'));
  await ok(cycleCommand(r, 'START_TRAVEL'));
  return readSession(r.host);
}
export async function startTerrainAttack(r) {
  const s = await terrainTurn(r),
    offer = s.combat.attacks.find((o) => o.heroId === s.round.activeHeroId);
  return {
    s,
    intent: attackIntent(s, offer),
    response: await command(r.host, r.player, attackIntent(s, offer), s),
  };
}
