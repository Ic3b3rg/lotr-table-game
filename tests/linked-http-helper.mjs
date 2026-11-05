// Invented pre-startup program, catalog and map. Gameplay below uses real HTTP commands.
import assert from 'node:assert/strict';
import { attachEncounter, sourceCatalog, finishPhysical } from './original-encounter-helper.mjs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readyScenario, startScenario } from './scenario-helper.mjs';
import { diagnosticRaw, inventedFrontInput } from './fixtures/physical-fronts.mjs';
import { inventedLastStand } from './fixtures/last-stand.mjs';
import { compilePhysicalFronts, compileLastStand } from '../dist/physical-resolution-library.mjs';
import { attachFailure } from './fixtures/adventure-failure.mjs';
import { attachRounds } from './fixtures/source-rounds.mjs';
import { attachExploration } from './fixtures/exploration.mjs';
import { attachLinked, linkedTitle, sealLinked } from './fixtures/linked-encounters.mjs';
import { readSession } from './skill-test-helper.mjs';
import { scenarioInput } from './scenario-helper.mjs';
import { cycleCommand } from './physical-cycle-helper.mjs';
import { command } from './preparation-helper.mjs';
import { finishCycle } from './original-round-helper.mjs';
export { finishPhysical };
export async function ok(reply) {
  const r = await reply;
  assert.equal(r.status, 200, await r.clone().text());
  return r;
}
export function attachFrozenLinked(pack, frozen, { beforeExploration = false } = {}) {
  attachRounds(pack, frozen.mapGeneration.projection);
  attachExploration(
    pack,
    frozen.mapGeneration.projection.sections.flatMap((s) => s.tiles).map((t) => t.source),
  );
  attachFailure(pack);
  return transplantLinkedPair(pack, { beforeExploration });
}
export function transplantLinkedPair(pack, { beforeExploration = false } = {}) {
  const targets = pack.manifest.prefabs.slice(1, 3),
    priorCount = pack.manifest.prefabs.length;
  const cap = attachLinked(pack);
  const added = pack.manifest.prefabs.splice(priorCount);
  for (const [n, p] of added.entries()) {
    const target = targets[n],
      d = pack.definitions.find((d) => d.source === p.fsmSource);
    pack.definitions = pack.definitions.filter((d) => d.source !== target.fsmSource);
    d.source = target.fsmSource;
    cap.encounters[n].prefab = target.source;
    target.inspection = p.inspection;
    target.nodeType = 'search';
    target.sourceNodeType = 0;
    if (n === 0) {
      cap.threat.definition = d.source;
      cap.threat.binding.name = 'pressure';
      d.states.find((s) => s.index === 61).actions[0].target.name = 'pressure';
    }
  }
  if (beforeExploration)
    pack.definitions
      .find((d) => d.source === pack.principal)
      .states.find((s) => s.index === 7).actions = [];
  sealLinked(pack);
  return cap;
}
export async function prepareLinked(
  t,
  { beforeExploration = false, edit = () => {}, catalogEdit = () => {}, frontEdit = () => {} } = {},
) {
  const r = await readyScenario(
    t,
    (pack, frozen) => {
      attachEncounter(pack);
      attachFrozenLinked(pack, frozen, { beforeExploration });
      edit(pack, frozen);
      sealLinked(pack);
    },
    (c) => {
      sourceCatalog(c);
      for (const h of c.heroes) Object.assign(h.stats, { wisdom: 2, agility: 2, wit: 2 });
      catalogEdit(c);
    },
  );
  const raw = diagnosticRaw();
  linkedTitle(raw);
  const ir = inventedFrontInput(raw);
  for (const d of ir.definitions) d.body = [{ op: 'keep-faceup' }];
  frontEdit(ir, r.catalog, raw, r);
  for (const [file, value] of [
    ['physical-content.json', raw],
    ['physical-fronts.json', compilePhysicalFronts(raw, ir, r.catalog)],
    ['physical-last-stand.json', compileLastStand(raw, inventedLastStand(raw))],
  ])
    await writeFile(join(r.host.dataDir, file), JSON.stringify(value));
  return r;
}
export async function startLinked(r) {
  await ok(startScenario(r.host, r.player));
  for (let n = 0; n < 60; n++) {
    const s = await readSession(r.host),
      q = s.scenario.pending;
    if (!q) return r;
    const actor = q.actorPlayerId === r.other.body.player.id ? r.other : r.player;
    const input =
      q.kind === 'scout'
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
    await ok(scenarioInput(r.host, actor, input));
  }
  assert.fail('invented linked startup did not complete');
}
export async function readyLinked(t, options = {}) {
  return startLinked(await prepareLinked(t, options));
}
export function linkedNode(s, n = 0) {
  return s.scenario.instances.find(
    (i) => i.prefab === s.scenario.pack.manifest.linked.encounters[n].prefab,
  );
}
export function linkedIntent(s, n = 0, choiceEvent) {
  const i = linkedNode(s, n),
    sc = s.scenario;
  return {
    type: 'INTERACT_SCENARIO',
    scenarioId: sc.id,
    packFingerprint: sc.packFingerprint,
    projectionFingerprint: sc.projectionFingerprint,
    instanceId: i.id,
    sourceFingerprint: s.encounterFingerprints[i.id],
    heroId: s.round.activeHeroId,
    roundId: s.round.id,
    turnId: s.round.turnId,
    ...(choiceEvent ? { choiceEvent } : {}),
  };
}
export async function commitLinked(r, n = 0, actor = r.player, choiceEvent) {
  const s = await readSession(r.host);
  return command(r.host, actor, linkedIntent(s, n, choiceEvent), s);
}
export async function firstVisit(r) {
  await ok(cycleCommand(r, 'START_TURN'));
  await ok(commitLinked(r));
  await finishPhysical(r);
  await ok(scenarioInput(r.host, r.player, { kind: 'choice', event: 'LEAVE' }));
  const s = await readSession(r.host);
  if (s.scenario.pending) await ok(scenarioInput(r.host, r.other, { kind: 'ack' }));
  return readSession(r.host);
}
export async function reachLinked(r, n = 1, actor = r.other) {
  let s = await readSession(r.host);
  if (!s.round.activeHeroId) await ok(cycleCommand(r, 'START_TURN', {}, actor));
  s = await readSession(r.host);
  const h = s.preparation.heroes.find((h) => h.playerId === actor.body.player.id);
  let from = s.journey.heroes.find((p) => p.heroId === h.heroId).spaceId;
  const to = s.scenario.spaceBindings.find((b) => b.sourceId === linkedNode(s, n).spaceId).id;
  if (from === to) return s;
  await ok(cycleCommand(r, 'START_TRAVEL', {}, actor));
  const queue = [[from]],
    seen = new Set([from]);
  let path;
  while (queue.length) {
    const p = queue.shift();
    if (p.at(-1) === to) {
      path = p;
      break;
    }
    for (const [a, b] of s.journey.definition.connections) {
      const next = a === p.at(-1) ? b : b === p.at(-1) ? a : null;
      if (next && !seen.has(next)) {
        seen.add(next);
        queue.push([...p, next]);
      }
    }
  }
  assert.ok(path && path.length <= 3, 'invented placement reachable within one travel');
  for (const destination of path.slice(1)) {
    s = await readSession(r.host);
    const tile = s.scenario.tiles.find((t) =>
      s.scenario.spaceBindings.some(
        (b) =>
          b.id === destination &&
          s.mapGeneration.projection.spaces.some(
            (p) => p.id === b.sourceId && p.tileSource === t.source,
          ),
      ),
    );
    if (tile && !tile.explored) {
      await ok(
        command(
          r.host,
          actor,
          {
            type: 'EXPLORE_SCENARIO',
            mapId: s.journey.id,
            scenarioId: s.scenario.id,
            packFingerprint: s.scenario.packFingerprint,
            projectionFingerprint: s.scenario.projectionFingerprint,
            sourceFingerprint: s.explorationFingerprints[destination],
            heroId: h.heroId,
            roundId: s.round.id,
            turnId: s.round.turnId,
            fromSpaceId: from,
            destinationSpaceId: destination,
          },
          s,
        ),
      );
      for (let k = 0; k < 20; k++) {
        const q = (await readSession(r.host)).scenario.pending;
        if (!q) break;
        await ok(
          scenarioInput(r.host, q.actorPlayerId === r.other.body.player.id ? r.other : r.player, {
            kind: 'ack',
          }),
        );
      }
    } else
      await ok(
        cycleCommand(r, 'MOVE_HERO', { fromSpaceId: from, destinationSpaceId: destination }, actor),
      );
    from = destination;
  }
  return readSession(r.host);
}
export async function getResource(r, branch = 'SOLVE') {
  await ok(cycleCommand(r, 'END_TURN'));
  await reachLinked(r);
  await ok(commitLinked(r, 1, r.other));
  await finishPhysical(r);
  await ok(scenarioInput(r.host, r.other, { kind: 'choice', event: branch }));
  let s = await finishPhysical(r);
  if (s.scenario.pending?.kind === 'message')
    await ok(scenarioInput(r.host, r.player, { kind: 'ack' }));
  return readSession(r.host);
}
export async function nextLinkedRound(r) {
  await ok(cycleCommand(r, 'END_TURN', {}, r.other));
  await finishCycle(r);
  await ok(cycleCommand(r, 'BEGIN_SHADOW'));
  await finishCycle(r);
  await ok(cycleCommand(r, 'CONFIRM_SHADOW_STEP', { step: 'threat' }));
  await finishCycle(r);
  for (const actor of [r.player, r.other]) {
    await ok(cycleCommand(r, 'START_RALLY_SCOUT', {}, actor));
    await finishCycle(r);
  }
  await ok(cycleCommand(r, 'END_RALLY'));
  return readSession(r.host);
}
