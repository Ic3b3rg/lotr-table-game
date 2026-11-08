// Entirely invented finite cards/figures/layout. All source pools remain complete.
import { compileBattleMapSource } from '../../dist/battle-map-library.mjs';
import { hash } from './map-freeze.mjs';

export const terrainPolicy = () => ({
  version: 'source-battle-test-terrain-v1',
  rulesReference: 'a31697b0dcce6cdc003d3b178b00a4d7bbc7d12efee527b8843bec8e5f38a0c4',
  errata: '6377e29b94c9714a446a43d0a840d142bd18374febb58536b048848897e453d3',
  italian: '0ebc7fb510bec738d333d5fdb1c4ae52f4ed8c577fa1be1083fb31f66fb2e962',
  fire: 'revealed-fate-discard-all-icons-pierce-or-smite-once-per-attack',
  boulder: 'one-fate-per-placed-token-per-negate-test',
});

export function terrainSource(departure, source, { kind = 'fire', activate = false } = {}) {
  const board = structuredClone(departure.board.source),
    position = board.transforms.find(
      (t) => t.record === board.anchors.find((a) => a.kind === 'hero').transform,
    ).position;
  const move = (anchor) => {
    board.transforms.find(
      (t) => t.record === board.anchors.find((a) => a.id === anchor).transform,
    ).position = structuredClone(position);
  };
  for (const a of board.anchors.filter((a) => a.kind === 'spawn')) move(a.id);
  move(kind === 'fire' ? 'flame' : 'stone');
  departure.board = compileBattleMapSource(board);
  departure.boardFingerprint = departure.board.artifactFingerprint;
  departure.combat.boardFingerprint = departure.boardFingerprint;
  source.projectionFingerprint = departure.boardFingerprint;
  departure.combat.terrain = departure.instructions.flatMap((i) =>
    i.op === 'terrain'
      ? i.anchors.map((anchor, n) => ({
          anchor,
          kind: i.kinds[n],
          sourceHash: hash('invented terrain rule'),
          locator: 'Invented!terrain',
          window: {
            bush: 'end-turn-optional',
            wall: 'adjacency',
            fire: 'attack-gated',
            rock: 'negate-gated',
          }[i.kinds[n]],
        }))
      : [],
  );
  if (activate) departure.combat.testTerrain = terrainPolicy();
}
