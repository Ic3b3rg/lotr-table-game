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
