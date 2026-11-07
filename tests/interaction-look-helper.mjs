// Entirely invented catalog, source, cards, policies and quantities. No original play.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readyScenario, startScenario, scenarioInput } from './scenario-helper.mjs';
import { attachEncounter, interact, playable } from './original-encounter-helper.mjs';
import { state, action, text } from './fixtures/scenario.mjs';
import { diagnosticRaw, inventedFrontInput, hash } from './fixtures/physical-fronts.mjs';
import { inventedLastStand } from './fixtures/last-stand.mjs';
import { compilePhysicalFronts, compileLastStand } from '../dist/physical-resolution-library.mjs';
import { readSession, readBackup } from './skill-test-helper.mjs';
import { cycleCommand } from './physical-cycle-helper.mjs';
export { interact, playable, readSession, readBackup, scenarioInput, hash, cycleCommand };
export async function ok(response) {
  const r = await response;
  assert.equal(r.status, 200, await r.clone().text());
  return r;
}
export function lookInput(raw, catalog) {
  const input = inventedFrontInput(raw);
  input.interactionLook = {
    version: 'source-interaction-look-v1',
    heroes: catalog.heroes.map((h, n) => ({
      heroId: h.id,
      definitionHash: hash(h),
      capability: n === 0 ? 'look' : 'none',
    })),
  };
  input.policies.push({
    id: catalog.heroes[0].id,
    kind: 'hero',
    definitionHash: hash(catalog.heroes[0]),
    source: { sourceId: 'invented-reviewed-look', locator: 'Invented!hero-1' },
    effects: [{ op: 'before-interact-look', reward: 1 }],
  });
  return input;
}
export async function readyLook(
  t,
  { fate = 1, costs = 0, guaranteed = false, edit = () => {}, frontEdit = () => {} } = {},
) {
  const r = await readyScenario(
    t,
    (pack, frozen) => {
      const prefab = attachEncounter(pack);
      pack.name = 'Tavolo inventato · guardare prima di interagire';
      const d = pack.definitions.find((d) => d.source === prefab.fsmSource);
      // A repeatable actual confirm followed by a message and exact return.
      d.states = d.states.filter((s) => s.index < 20);
      d.states.push(
        state(
          20,
          [
            {
              index: 0,
              op: 'confirm',
              origin: {
                type: 'FFG.JIME.Actions.DisplayMessageCancelConfirm',
                parameterHash: hash('invented-confirm'),
                load: 'hash-match-positional',
              },
              text: text('Interazione inventata'),
              label: text('Interagisci'),
              cancelLabel: text('Annulla'),
              confirmEvent: 'YES',
              cancelEvent: 'NO',
            },
          ],
          { YES: 21, NO: 0 },
        ),
        state(
          21,
          [
            action(0, 'message', {
              mode: 'ordinary',
              text: text('Il seguito inventato è tornato alla fonte.'),
              ignoreLog: false,
            }),
          ],
          { FINISHED: 0 },
        ),
      );
      edit(pack, frozen);
    },
    (c) => {
      for (const h of c.heroes) h.stats.inspiration = 6;
      for (const s of c.skills) {
        s.fate = fate;
        s.success = 1;
      }
    },
    () => {},
    3,
  );
  const raw = diagnosticRaw(),
    input = lookInput(raw, r.catalog);
  if (costs) {
    for (const d of input.definitions.filter((d) => d.cardId.includes('damage'))) {
      d.body = [{ op: 'keep-faceup' }];
      d.persistent = [
        {
          op: 'mandatory-spend',
          window: 'before-interact',
          token: 'threat',
          resource: 'inspiration',
          n: 1,
        },
      ];
    }
    // A real invented source physical instruction supplies active damage before action phase.
    const program = {
      profile: 'source-fronts-v1',
      initialCredits: [0, 0, 0],
      darknessHeroes: [],
      limits: [0, 1, 2].map(() => ({ kind: 'requires-capability', capability: 'source-derived' })),
      children: [
        {
          kind: 'suffer',
          hero: 0,
          face: 'faceup',
          cards: [{ family: 'damage', amount: costs }],
          prevention: [],
        },
      ],
    };
    const adventure = r.pack.definitions[0];
    adventure.states.find((s) => s.index === 3).transitions.FINISHED = 12;
    adventure.states.push(
      state(
        12,
        [
          {
            index: 0,
            op: 'physical',
            origin: {
              type: 'Invented.PhysicalProgram',
              parameterHash: hash(program),
              load: 'hash-match-positional',
            },
            text: text('Danno attivo inventato prima dell’avventura'),
            program,
          },
        ],
        { FINISHED: 4 },
      ),
    );
    await writeFile(r.scenarioPath, JSON.stringify(r.pack));
  }
  if (guaranteed) input.policies[0].effects.push({ op: 'before-interact-inspiration', amount: 1 });
  frontEdit(input, r.catalog, raw);
  await writeFile(join(r.host.dataDir, 'physical-content.json'), JSON.stringify(raw));
  await writeFile(
    join(r.host.dataDir, 'physical-fronts.json'),
    JSON.stringify(compilePhysicalFronts(raw, input, r.catalog)),
  );
  await writeFile(
    join(r.host.dataDir, 'physical-last-stand.json'),
    JSON.stringify(compileLastStand(raw, inventedLastStand(raw))),
  );
  await ok(startScenario(r.host, r.player));
  r.players = [r.player, r.other, r.third];
  for (let n = 0; n < 100; n++) {
    const s = await readSession(r.host),
      q = s.scenario.pending;
    if (!q) return r;
    const actor = r.players.find((p) => p.body.player.id === q.actorPlayerId) ?? r.player;
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
          : q.kind === 'physical'
            ? { kind: 'physical-choice', option: s.physical.active.options[0].id }
            : { kind: 'ack' };
    await ok(scenarioInput(r.host, actor, input));
  }
  assert.fail('Invented startup did not return');
}
export async function reachLook(r) {
  await ok(cycleCommand(r, 'START_TURN'));
  let s = await readSession(r.host),
    i = playable(s);
  const to = s.scenario.spaceBindings.find((b) => b.sourceId === i.spaceId).id;
  if (to !== s.journey.heroes[0].spaceId) {
    await ok(cycleCommand(r, 'START_TRAVEL'));
    s = await readSession(r.host);
    await ok(
      cycleCommand(r, 'MOVE_HERO', {
        fromSpaceId: s.journey.heroes[0].spaceId,
        destinationSpaceId: to,
      }),
    );
  }
  return readSession(r.host);
}
