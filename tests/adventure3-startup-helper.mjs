// Complete invented histories, finite cards and figures. Never seeds a terminal or camp.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { readyBattleRounds, drainPhase, completeRally } from './battle-rounds-helper.mjs';
import {
  departBattle,
  attackIntent,
  readSession,
  readBackup,
  scenarioInput,
  command,
  ok,
  drainBattle,
} from './battle-combat-helper.mjs';
import { cycleCommand } from './physical-cycle-helper.mjs';
import { certificates } from './fixtures/exploration.mjs';
import { terrainPolicy } from './fixtures/battle-test-terrain.mjs';
import { attachAdventure3 } from './fixtures/adventure3-startup.mjs';

export async function readyAdventure3(
  t,
  { outcome = 'victory', edit = () => {}, ...options } = {},
) {
  const r = await readyBattleRounds(t, {
    ...options,
    outcome: outcome === 'failure' ? 'loss' : 'win',
    weaponBody: '1 Success: 12 hits\n2 Successes: 20 hits',
    catalogEdit: (catalog) => {
      if (outcome === 'failure') {
        catalog.heroes[2].stats.damage = 1;
        catalog.heroes[2].stats.might = 0;
      }
      options.catalogEdit?.(catalog);
    },
    sourceEdit: (departure, source, pack, frozen, catalog, fronts) => {
      departure.combat.testTerrain = terrainPolicy();
      const terminal = departure.combat.terminal;
      terminal.failure.next.id = 3;
      for (const s of terminal.definition.states)
        for (const a of s.actions)
          if (a.op === 'nextAdventure') {
            a.id = 3;
            a.source = 'example.assets:990';
          }
      terminal.failure.next.source = 'example.assets:990';
      terminal.certificate = certificates({ definitions: [terminal.definition] })[0];
      attachAdventure3(departure, source, pack, frozen, catalog, fronts);
      edit(departure, source, pack, frozen, catalog, fronts);
    },
  });
  t.after(() => t.diagnostic?.(r.host.diagnostics()));
  r.a2Outcome = outcome;
  r.exerciseDefeat = outcome === 'failure';
  await departBattle(r);
  await saveCheckpoint(r, `prospective-${outcome}-A2-origin`);
  return r;
}

export function route(s, from, to) {
  const queue = [[from]],
    seen = new Set([from]);
  while (queue.length) {
    const p = queue.shift(),
      at = p.at(-1);
    if (at === to) return p;
    for (const [a, b] of s.journey.definition.connections)
      for (const next of a === at ? [b] : b === at ? [a] : [])
        if (!seen.has(next)) {
          seen.add(next);
          queue.push([...p, next]);
        }
  }
  assert.fail('The actual generated graph must supply the required route');
}

async function endTurns(r) {
  for (const actor of r.actors) {
    const s = await readSession(r.host);
    if (s.scenario.conclusion) return;
    const hero = s.preparation.heroes.find((h) => h.playerId === actor.body.player.id);
    if (s.round.heroes.find((h) => h.heroId === hero.heroId).turnEnded) continue;
    if (s.physical.lastStand?.heroes.some((h) => h.heroId === hero.heroId && h.defeated)) continue;
    if (s.round.activeHeroId !== hero.heroId)
      await ok(cycleCommand(r, 'START_TURN', { heroId: hero.heroId }, actor));
    await ok(cycleCommand(r, 'END_TURN', { heroId: hero.heroId }, actor));
    await drainPhase(r);
  }
}

async function shadow(r) {
  await endTurns(r);
  if ((await readSession(r.host)).scenario.conclusion) return;
  await ok(cycleCommand(r, 'BEGIN_SHADOW'));
  await drainToBoundary(r);
  let s = await readSession(r.host);
  if (s.scenario.conclusion) return;
  await ok(cycleCommand(r, 'CONFIRM_SHADOW_STEP', { step: 'threat' }));
  await drainToBoundary(r);
  s = await readSession(r.host);
  if (!s.scenario.conclusion) await completeRally(r);
}

const drainToBoundary = (r) =>
  drainPhase(r, { pause: (s) => !!r.stopAtConclusion && !!s.scenario.conclusion });
export async function reachSecondCamp(r, { stopAtConclusion = false } = {}) {
  r.stopAtConclusion = stopAtConclusion;
  if (r.exerciseDefeat) await defeatBattleHero(r);
  for (let n = 0; n < 4; n++) await shadow(r);
  if (r.a2Outcome === 'failure') {
    for (let n = 0; n < 4 && !(await readSession(r.host)).scenario.conclusion; n++) await shadow(r);
  } else {
    for (let turn = 0; turn < 3 && !(await readSession(r.host)).scenario.conclusion; turn++) {
      for (const actor of r.actors) {
        let s = await readSession(r.host);
        if (s.scenario.conclusion) break;
        const hero = s.preparation.heroes.find((h) => h.playerId === actor.body.player.id);
        await ok(cycleCommand(r, 'START_TURN', { heroId: hero.heroId }, actor));
        for (let n = 0; n < 12; n++) {
          s = await readSession(r.host);
          const full = (await readBackup(r.host)).payload.state;
          if (s.scenario.conclusion) break;
          const target = full.scenario.enemies.groups.find(
            (g) => g.battleRecipe && g.figures.some((f) => f.health > 0),
          );
          assert.ok(target, 'The named source victory must have a living target');
          const offer = s.combat.attacks.find((o) => o.groupId === target.id && !o.reason);
          if (offer) {
            await ok(command(r.host, actor, attackIntent(s, offer), s));
            await drainToBoundary(r);
          } else {
            if (!s.journey.travel?.remaining) {
              if (s.round.heroes.find((h) => h.heroId === hero.heroId).actionsUsed >= 2) break;
              await ok(cycleCommand(r, 'START_TRAVEL', { heroId: hero.heroId }, actor));
            }
            s = await readSession(r.host);
            const from = s.journey.heroes.find((h) => h.heroId === hero.heroId).spaceId;
            const to = s.scenario.spaceBindings.find((b) => b.sourceId === target.spaceId).id;
            const path = route(s, from, to);
            assert.ok(path[1]);
            await ok(
              cycleCommand(
                r,
                'MOVE_HERO',
                {
                  heroId: hero.heroId,
                  fromSpaceId: from,
                  destinationSpaceId: path[1],
                },
                actor,
              ),
            );
            await drainToBoundary(r);
          }
          s = await readSession(r.host);
          if (
            s.round.heroes.find((h) => h.heroId === hero.heroId).actionsUsed === 2 &&
            !s.journey.travel?.remaining
          )
            break;
        }
        if (!(await readSession(r.host)).scenario.conclusion)
          await ok(cycleCommand(r, 'END_TURN', { heroId: hero.heroId }, actor));
      }
      if (!(await readSession(r.host)).scenario.conclusion) await shadow(r);
    }
  }
  await drainToBoundary(r);
  const s = await readSession(r.host);
  assert.equal(s.scenario.conclusion?.outcome, r.a2Outcome);
  if (stopAtConclusion) return s;
  assert.equal(s.scenario.conclusion.stage, 'camp');
  assert.equal(s.scenario.conclusion.transitionCount, 1);
  assert.equal(s.scenario.conclusion.nextAdventureId, 3);
  return s;
}

async function defeatBattleHero(r) {
  const actor = r.actors[2];
  let s = await readSession(r.host);
  const hero = s.journey.heroes[2],
    from = hero.spaceId,
    adjacent = s.journey.definition.connections.flatMap(([a, b]) =>
      a === from ? [b] : b === from ? [a] : [],
    ),
    group = s.scenario.enemies.groups.find((g) =>
      adjacent.includes(s.scenario.spaceBindings.find((b) => b.sourceId === g.spaceId).id),
    );
  assert.ok(group, 'The actual A2 board must supply the adjacent source enemy.');
  const destination = s.scenario.spaceBindings.find((b) => b.sourceId === group.spaceId).id;
  await ok(cycleCommand(r, 'START_TURN', { heroId: hero.heroId }, actor));
  await ok(cycleCommand(r, 'START_TRAVEL', { heroId: hero.heroId }, actor));
  // A legal first Last Stand can succeed. Spend the second ordinary travel action
  // when needed, retaining its higher difficulty instead of assuming early defeat.
  for (const to of [destination, from, destination, from]) {
    s = await readSession(r.host);
    if (s.physical.lastStand.heroes.find((h) => h.heroId === hero.heroId).defeated) break;
    if (!s.journey.travel.remaining)
      await ok(cycleCommand(r, 'START_TRAVEL', { heroId: hero.heroId }, actor));
    await ok(
      cycleCommand(
        r,
        'MOVE_HERO',
        {
          heroId: hero.heroId,
          fromSpaceId: s.journey.heroes[2].spaceId,
          destinationSpaceId: to,
        },
        actor,
      ),
    );
    // Choose zero negation legally; the finite invented hero then fails the ordinary Last Stand.
    await drainBattle(r);
  }
  const full = (await readBackup(r.host)).payload.state;
  assert.equal(full.physical.snapshot.lastStand.heroes[2].defeated, true);
  assert.ok(full.physical.snapshot.lastStand.selections.some((s) => s.outcome === 'fail'));
  r.exerciseDefeat = false;
}

export async function saveCheckpoint(r, name) {
  const backup = await readBackup(r.host);
  const folder = '.scratch/adventure3-startup-task1/http';
  await mkdir(folder, { recursive: true });
  await writeFile(`${folder}/${name}-${backup.payload.state.id}.json`, JSON.stringify(backup));
  await writeFile(
    `${folder}/${name}-${backup.payload.state.id}.actors.private.json`,
    JSON.stringify(r.actors.map((a) => ({ body: a.body, recoveryCode: a.recoveryCode }))),
  );
  return backup;
}

export { readSession, readBackup, scenarioInput, command, ok, drainPhase, cycleCommand };

export async function confirmSecondCamp(r) {
  await ok(scenarioInput(r.host, r.player, { kind: 'camp-prepare' }));
  for (const actor of r.actors) {
    const s = await readSession(r.host),
      hero = s.preparation.heroes.find((h) => h.playerId === actor.body.player.id),
      choice = s.scenario.conclusion.campaign.preparation.heroes.find(
        (h) => h.heroId === hero.heroId,
      );
    await ok(
      scenarioInput(r.host, actor, {
        kind: 'camp-confirm',
        heroId: hero.heroId,
        summaryHash: choice.summaryHash,
      }),
    );
  }
  const s = await readSession(r.host);
  assert.equal(s.campDeparture.available, true, s.campDeparture.reason);
  return s;
}

export async function firstJourneyMove(r) {
  const s = await readSession(r.host),
    full = (await readBackup(r.host)).payload.state,
    hero = s.journey.heroes[0],
    from = full.scenario.spaceBindings.find((b) => b.id === hero.spaceId).sourceId,
    tile = full.mapGeneration.projection.spaces.find((p) => p.id === from).tileSource,
    sameTile = new Set(
      full.mapGeneration.projection.spaces
        .filter((p) => p.tileSource === tile)
        .map((p) => full.scenario.spaceBindings.find((b) => b.sourceId === p.id).id),
    ),
    next = s.journey.definition.connections
      .flatMap(([a, b]) => (a === hero.spaceId ? [b] : b === hero.spaceId ? [a] : []))
      .find((id) => sameTile.has(id));
  assert.ok(next, 'The invented starting tile must retain its source interior movement edge.');
  let provokes = false;
  for (const destination of [next, hero.spaceId]) {
    const current = await readSession(r.host),
      before = (await readBackup(r.host)).payload.state,
      at = current.journey.heroes[0].spaceId,
      source = before.scenario.spaceBindings.find((b) => b.id === at).sourceId;
    provokes ||= before.scenario.enemies.groups.some(
      (g) =>
        g.placed && !g.exhausted && g.spaceId === source && g.figures.some((f) => f.health > 0),
    );
    await ok(cycleCommand(r, 'MOVE_HERO', { fromSpaceId: at, destinationSpaceId: destination }));
    await drainPhase(r);
  }
  const after = await readSession(r.host),
    state = (await readBackup(r.host)).payload.state;
  assert.equal(after.journey.heroes[0].spaceId, hero.spaceId);
  assert.equal(after.journey.travel.remaining, 0);
  assert.equal(after.round.heroes[0].actionsUsed, 1);
  if (provokes) assert.equal(state.combat.operations.at(-1).status, 'returned');
  assert.equal(state.combat.operation, null);
  return { from: hero.spaceId, via: next, remaining: 0, provokes };
}
