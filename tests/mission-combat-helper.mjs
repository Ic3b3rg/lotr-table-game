// Invented pre-startup source, supply, cards and company only.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readyRounds } from './original-round-helper.mjs';
import { attachFollowup } from './fixtures/shadow-followup.mjs';
import { attachFailure } from './fixtures/adventure-failure.mjs';
import { attachMissionCombat, sealMission } from './fixtures/mission-combat.mjs';
import { boonFixture } from './fixtures/boons.mjs';
import { compileCombatClosure } from '../dist/combat-library.mjs';
import { compileBoons } from '../dist/physical-resolution-library.mjs';
import { parseScenarioPack } from '../dist/scenario-library.mjs';
import { hash } from './fixtures/map-freeze.mjs';
import { attachActivationSource } from './fixtures/shadow-activations.mjs';
import { sourceCatalog } from './original-encounter-helper.mjs';
import { readSession } from './skill-test-helper.mjs';
import { command } from './preparation-helper.mjs';
import { cycleCommand } from './physical-cycle-helper.mjs';
import { scenarioInput } from './scenario-helper.mjs';
export async function readyMission(
  t,
  {
    verified = true,
    success = 1,
    fate = 0,
    might = 3,
    agility = 2,
    shadow = false,
    edit = () => {},
    catalogEdit: customizeCatalog = () => {},
    frontEdit = () => {},
  } = {},
) {
  const f = boonFixture(verified),
    boons = compileBoons(f.raw, f.boonInput);
  const catalogEdit = (c) => {
    sourceCatalog(c);
    for (const s of c.skills) {
      s.success = success;
      s.fate = fate;
    }
    for (const h of c.heroes) {
      h.maxHands = 2;
      h.stats.might = might;
      h.stats.agility = agility;
    }
    customizeCatalog(c);
  };
  return readyRounds(
    t,
    (pack, frozen) => {
      attachFollowup(pack, frozen);
      attachFailure(pack);
      attachMissionCombat(pack, frozen, undefined, catalogEdit, (src) => {
        if (shadow) {
          attachActivationSource(
            src,
            frozen.mapGeneration.projection.sections.flatMap((s) => s.tiles.map((t) => t.source)),
          );
          Object.assign(src.shadow.controller, pack.manifest.rounds.controller);
        }
      });
      pack.manifest.boons = { version: boons.version, fingerprint: boons.fingerprint };
      edit(pack, frozen);
      sealMission(pack);
      parseScenarioPack(pack);
    },
    catalogEdit,
    (_front, _catalog, raw, ready) => {
      raw.cards = structuredClone(f.raw.cards);
      writeFileSync(join(ready.host.dataDir, 'physical-boons.json'), JSON.stringify(boons));
      frontEdit(_front, _catalog, raw, ready);
    },
  );
}
export function missionNode(s) {
  const cap = s.scenario.pack?.manifest.firstCombat;
  // Public views expose prefab identity on each instance, not the private pack.
  return (
    s.scenario.instances.find((i) => i.prefab === cap?.prefab) ??
    s.scenario.instances.find(
      (i) => i.kind === 'encounter' && i.visible && i.interactionOptions?.length === 3,
    )
  );
}
export async function reachMission(r) {
  let s = await readSession(r.host);
  await ok(cycleCommand(r, 'START_TURN'));
  s = await readSession(r.host);
  const p = r.pack.manifest.firstCombat.prefab,
    node = s.scenario.instances.find((i) => i.prefab === p);
  const target = s.scenario.spaceBindings.find((b) => b.sourceId === node.spaceId).id;
  if (s.journey.heroes[0].spaceId !== target) {
    await ok(cycleCommand(r, 'START_TRAVEL'));
    await ok(
      cycleCommand(r, 'MOVE_HERO', {
        fromSpaceId: s.journey.heroes[0].spaceId,
        destinationSpaceId: target,
      }),
    );
  }
  return readSession(r.host);
}
export function missionIntent(r, s, choiceEvent) {
  const i = s.scenario.instances.find((i) => i.prefab === r.pack.manifest.firstCombat.prefab);
  return {
    type: 'INTERACT_SCENARIO',
    scenarioId: s.scenario.id,
    packFingerprint: s.scenario.packFingerprint,
    projectionFingerprint: s.scenario.projectionFingerprint,
    instanceId: i.id,
    sourceFingerprint: hash(i),
    heroId: s.preparation.heroes[0].heroId,
    roundId: s.round.id,
    turnId: s.round.turnId,
    choiceEvent,
  };
}
export async function ok(value) {
  const r = await value;
  assert.equal(r.status, 200, await r.clone().text());
  return r;
}
export async function commitMission(r, choiceEvent = 'TALK') {
  const s = await readSession(r.host);
  return command(r.host, r.player, missionIntent(r, s, choiceEvent), s);
}
export async function drainMission(r, { convert = 0, pause = () => false } = {}) {
  for (let n = 0; n < 180; n++) {
    const s = await readSession(r.host),
      q = s.scenario.pending;
    if (!q || pause(s)) return s;
    const actor = [r.player, r.other].find((a) => a.body.player.id === q.actorPlayerId) ?? r.player;
    const a = s.physical.active;
    const input =
      q.kind !== 'physical'
        ? { kind: 'ack' }
        : a.mode === 'select'
          ? { kind: 'physical-select', ids: a.options.slice(0, a.minimum).map((o) => o.id) }
          : a.mode === 'allocate'
            ? { kind: 'physical-allocate', ability: null, damage: 0, fear: 0 }
            : {
                kind: 'physical-choice',
                option:
                  convert && a.options.some((o) => o.id === 'inspiration')
                    ? (convert--, 'inspiration')
                    : (['resolve', 'close', 'reveal'].find((id) =>
                        a.options.some((o) => o.id === id),
                      ) ?? a.options[0].id),
              };
    await ok(scenarioInput(r.host, actor, input));
  }
  assert.fail('invented mission did not return');
}

export function strongInventedWeapons(pack) {
  const source = structuredClone(pack.manifest.combat.source);
  for (const item of source.items.filter((i) => i.stat)) {
    item.body = '1 Success: 20 hits';
    item.originalHash = hash(['invented strong weapon', item.id]);
  }
  pack.manifest.combat = compileCombatClosure(source);
}
