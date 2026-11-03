import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readyFronts } from './physical-front-helper.mjs';
import { inventedFrontInput, diagnosticRaw } from './fixtures/physical-fronts.mjs';
import { compilePhysicalFronts } from '../dist/physical-resolution-library.mjs';
import { startScenario, scenarioInput } from './scenario-helper.mjs';
import { readSession } from './skill-test-helper.mjs';
import { command } from './preparation-helper.mjs';
import { catalogFixture } from './fixtures/catalog.mjs';
export async function readyCycle(t, edit = () => {}, sourceEdit = () => {}) {
  const ready = await readyFronts(t, (pack, pr) => {
    pr.children[0].cards[0].amount = 1;
    sourceEdit(pack, pr);
  });
  const raw = diagnosticRaw(),
    input = inventedFrontInput(raw);
  for (const d of input.definitions.filter((d) => d.cardId.includes('damage'))) {
    d.body = [{ op: 'keep-faceup' }];
    d.persistent = [{ op: 'self-flip-down', window: 'end-own-turn' }];
  }
  edit(input);
  await writeFile(
    join(ready.host.dataDir, 'physical-fronts.json'),
    JSON.stringify(compilePhysicalFronts(raw, input, catalogFixture())),
  );
  const r = await startScenario(ready.host, ready.player);
  assert.equal(r.status, 200, await r.text());
  for (let n = 0; n < 60; n++) {
    const s = await readSession(ready.host),
      q = s.scenario.pending;
    if (!q) return ready;
    const actor = q.actorPlayerId === ready.other.body.player.id ? ready.other : ready.player;
    const input =
      q.kind === 'physical'
        ? {
            kind: 'physical-choice',
            option: s.physical.active.options.some((o) => o.id === 'close')
              ? 'close'
              : s.physical.active.options[0].id,
          }
        : q.kind === 'scout'
          ? q.stage === 'ready'
            ? { kind: 'scout-reveal' }
            : {
                kind: 'scout-resolve',
                prepareCopy: null,
                top: s.scout.revealed,
                bottom: [],
                discardPreparedCopy: null,
              }
          : q.kind === 'test'
            ? { kind: q.stage === 'ready' ? 'test-reveal' : 'test-resolve' }
            : { kind: 'ack' };
    const result = await scenarioInput(ready.host, actor, input);
    assert.equal(result.status, 200, await result.text());
  }
  assert.fail('No ordinary cycle reached.');
}
export async function cycleCommand(ready, type, extra = {}, actor = ready.player, at) {
  const s = at ?? (await readSession(ready.host));
  const hero = s.preparation.heroes.find((h) => h.playerId === actor.body.player.id);
  return command(
    ready.host,
    actor,
    {
      type,
      roundId: s.round.id,
      ...(['START_TURN', 'END_TURN', 'START_TRAVEL', 'MOVE_HERO', 'START_RALLY_SCOUT'].includes(
        type,
      )
        ? { heroId: hero.heroId }
        : {}),
      ...(['END_TURN', 'START_TRAVEL', 'MOVE_HERO'].includes(type)
        ? { turnId: s.round.turnId }
        : {}),
      ...(['START_TRAVEL', 'MOVE_HERO'].includes(type) ? { mapId: s.journey.id } : {}),
      ...(['START_TURN', 'BEGIN_SHADOW', 'CONFIRM_SHADOW_STEP', 'END_RALLY'].includes(type)
        ? { agreed: true }
        : {}),
      ...extra,
    },
    s,
  );
}
