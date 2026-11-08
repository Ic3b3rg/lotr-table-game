import type { State } from './state';
import { invariant } from '../map-freeze/validate';
import { battleCombat, battleSpatial } from '../scenario/battle-combat';
import { BattleTestTerrainContextSchema } from '../shared/battle-test-terrain';
import { digest } from '../map-freeze/hash';

/** Derived on each run, including children after movement; never accepted from a command. */
function testTerrain(state: State) {
  const cap = battleCombat(state);
  if (!cap?.testTerrain) return {};
  const { layout } = battleSpatial(state);
  const tokens = state.scenario!.battle!.placements.flatMap((p) => {
    if (p.kind !== 'fire' && p.kind !== 'rock') return [];
    const proof = cap.terrain.find((t) => t.anchor === p.anchor && t.kind === p.kind),
      cell = layout.placements.find((a) => a.id === p.anchor)?.cell,
      spaceId = state.scenario!.spaceBindings.find((b) => b.sourceId === cell)?.id;
    invariant(proof && spaceId, 'Terreno collocato senza identità o casella fonte.');
    return [{ anchor: p.anchor, kind: p.kind, spaceId }];
  });
  invariant(new Set(tokens.map((t) => t.anchor)).size === tokens.length, 'Terreno duplicato.');
  return {
    testTerrain: BattleTestTerrainContextSchema.parse({
      policy: cap.testTerrain,
      capabilityFingerprint: digest(cap),
      boardFingerprint: cap.boardFingerprint,
      tokens,
    }),
  };
}

/** Visible living enemies, including exhausted groups, for card timing windows. */
export function boonEnemyPositions(state: State) {
  const terrain = testTerrain(state);
  if (!state.physical?.boons) return terrain;
  return {
    ...terrain,
    enemies: (state.scenario?.enemies?.groups ?? [])
      .filter((g) => g.placed && g.figures.some((f) => f.health > 0))
      .map((g) => {
        const spaceId = state.scenario!.spaceBindings.find((b) => b.sourceId === g.spaceId)?.id;
        invariant(spaceId, 'Nemico senza posizione nella mappa fisica.');
        return { id: g.id, spaceId };
      }),
  };
}
