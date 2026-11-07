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
import { parseScenarioPack } from '../dist/scenario-library.mjs';
import { attachRounds } from './fixtures/source-rounds.mjs';
import { command } from './preparation-helper.mjs';
export { interact, playable, readSession, readBackup, scenarioInput, hash, cycleCommand };
export async function ok(response) {
  const r = await response;
  assert.equal(r.status, 200, await r.clone().text());
  return r;
}
export function lookInput(raw, catalog) {
  for (const hero of catalog.heroes) hero.maxHands ??= 2;
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
  {
    fate = 1,
    costs = 0,
    guaranteed = false,
    initialInspiration,
    colocated = false,
    edit = () => {},
    frontEdit = () => {},
  } = {},
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
      if (colocated || costs) attachRounds(pack, frozen.mapGeneration.projection);
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
  t.after(() => {
    if (r.host.diagnostics().includes('Richiesta non completata'))
      t.diagnostic(r.host.diagnostics());
  });
  if (costs) {
    for (const d of input.definitions.filter((d) => costs && d.cardId.includes('damage'))) {
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
    // A genuine prior source interaction supplies damage and known resources. The
    // ordinary ledger derives every effect; no pack or replay guard is bypassed.
    const d = r.pack.definitions.find((d) => d.source === r.pack.manifest.prefabs[0].fsmSource);
    d.states[0].transitions['NODE CLICKED'] = 30;
    d.states.push(
      state(30, [structuredClone(d.states.find((st) => st.index === 20).actions[0])], {
        YES: 31,
        NO: 0,
      }),
    );
    const messages = [
      ...(costs
        ? [
            {
              consequence: { family: 'damage', amount: costs, face: 'faceup' },
              text: text('Danno antecedente inventato'),
            },
          ]
        : []),
    ];
    for (let n = 0; n < messages.length; n++)
      d.states.push(
        state(
          31 + n,
          [action(0, 'message', { mode: 'ordinary', ignoreLog: false, ...messages[n] })],
          { FINISHED: n === messages.length - 1 ? 40 : 32 + n },
        ),
      );
    if (!messages.length) d.states.find((st) => st.index === 30).transitions.YES = 40;
    d.states.push(state(40, [action(0, 'release')], { FINISHED: 41 }), state(41));
    d.states.find((st) => st.index === 41).transitions['NODE CLICKED'] = 20;
    for (const definition of input.definitions.filter((d) => costs && d.cardId.includes('damage')))
      definition.body = [
        ...(initialInspiration === 0
          ? [{ op: 'discard-inspiration', hero: 'self', n: 'all' }]
          : []),
        { op: 'keep-faceup' },
      ];
    await writeFile(r.scenarioPath, JSON.stringify(r.pack));
  }
  if (guaranteed) input.policies[0].effects.push({ op: 'before-interact-inspiration', amount: 1 });
  if (initialInspiration > 0) {
    const skill = r.catalog.skills.find((c) => c.id === r.catalog.roles[0].skills[0]);
    input.policies.push({
      id: skill.id,
      kind: 'skill',
      definitionHash: hash(skill),
      source: { sourceId: 'invented-startup', locator: 'Invented!known-resources' },
      effects: Array.from({ length: initialInspiration }, () => ({
        op: 'after-prepare-inspiration',
      })),
    });
  }
  frontEdit(input, r.catalog, raw);
  const artifact = compilePhysicalFronts(raw, input, r.catalog);
  if (initialInspiration > 0)
    r.pack.manifest.startupPreparation = {
      version: 'source-startup-preparation-v1',
      frontsFingerprint: artifact.fingerprint,
      catalogHash: hash(r.catalog),
      evidenceHash: hash('Invented known startup resources'),
    };
  parseScenarioPack(r.pack);
  await writeFile(r.scenarioPath, JSON.stringify(r.pack));
  await writeFile(join(r.host.dataDir, 'physical-content.json'), JSON.stringify(raw));
  await writeFile(join(r.host.dataDir, 'physical-fronts.json'), JSON.stringify(artifact));
  await writeFile(
    join(r.host.dataDir, 'physical-last-stand.json'),
    JSON.stringify(compileLastStand(raw, inventedLastStand(raw))),
  );
  await ok(startScenario(r.host, r.player));
  r.players = [r.player, r.other, r.third];
  for (let n = 0; n < 100; n++) {
    const s = await readSession(r.host),
      q = s.scenario.pending;
    if (!q) break;
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
            ? s.physical.active.mode === 'scout'
              ? {
                  kind: 'physical-scout',
                  prepare: null,
                  top: s.physical.active.options.map((o) => o.id),
                  bottom: [],
                  discard: null,
                }
              : {
                  kind: 'physical-choice',
                  option:
                    ['resolve', 'close', 'reveal'].find((id) =>
                      s.physical.active.options.some((o) => o.id === id),
                    ) ?? s.physical.active.options[0].id,
                }
            : { kind: 'ack' };
    await ok(scenarioInput(r.host, actor, input));
  }
  assert.equal(
    (await readSession(r.host)).scenario.pending,
    null,
    'Invented startup did not return',
  );
  if (costs) {
    await reachLook(r);
    await ok(interact(r));
    for (let n = 0; n < 100; n++) {
      const s = await readSession(r.host),
        q = s.scenario.pending;
      if (!q) {
        r.bootstrapAntecedent = true;
        break;
      }
      const a = s.physical.active;
      const input =
        q.kind === 'physical'
          ? { kind: 'physical-choice', option: a.options.find((o) => !o.unavailable).id }
          : { kind: 'ack' };
      await ok(scenarioInput(r.host, r.player, input));
    }
    assert.equal(
      (await readSession(r.host)).scenario.pending,
      null,
      'Invented source antecedent did not return',
    );
  }
  if (colocated || costs) {
    await reachLook(r);
    await nextOwnedRound(r);
  }
  return r;
}
export async function reachLook(r) {
  if (!(await readSession(r.host)).round.activeHeroId) await ok(cycleCommand(r, 'START_TURN'));
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
export function interactionIntent(s, r, extra = {}) {
  const i = playable(s);
  return {
    type: 'INTERACT_SCENARIO',
    generation: s.generation,
    expectedRevision: s.revision,
    scenarioId: s.scenario.id,
    packFingerprint: s.scenario.packFingerprint,
    projectionFingerprint: s.scenario.projectionFingerprint,
    instanceId: i.id,
    heroId: 'hero-1',
    roundId: s.round.id,
    turnId: s.round.turnId,
    sourceFingerprint: hash(i),
    ...extra,
  };
}
export async function chooseBefore(r, kind) {
  const state = (await readBackup(r.host)).payload.state;
  const window = state.physical.snapshot.resolution.interactionWindow;
  const effect = window.remaining.find((e) => e.kind === kind);
  assert.ok(effect, kind);
  await ok(scenarioInput(r.host, r.player, { kind: 'physical-choice', option: effect.id }));
}

export async function drainOwned(r) {
  for (let n = 0; n < 150; n++) {
    const s = await readSession(r.host),
      a = s.physical.active,
      q = s.scenario.pending;
    if (!a && !q) return s;
    const actor =
      r.players.find((p) => p.body.player.id === (a?.actorPlayerId ?? q?.actorPlayerId)) ??
      r.player;
    const input = a
      ? a.mode === 'scout'
        ? {
            kind: 'physical-scout',
            prepare: null,
            top: a.options.map((o) => o.id),
            bottom: [],
            discard: null,
          }
        : a.mode === 'allocate'
          ? { kind: 'physical-allocate', ability: null, damage: 0, fear: 0 }
          : a.mode === 'select'
            ? { kind: 'physical-select', ids: a.options.slice(0, a.minimum).map((o) => o.id) }
            : {
                kind: 'physical-choice',
                option:
                  ['continue', 'close-rest', 'resolve', 'close', 'reveal'].find((id) =>
                    a.options.some((o) => o.id === id && !o.unavailable),
                  ) ?? a.options.find((o) => !o.unavailable).id,
              }
      : { kind: 'ack' };
    if (s.physical.cycle?.pending) {
      const { type: _, ...binding } = s.physical.cycle.pending;
      await ok(command(r.host, actor, { type: 'CYCLE_INPUT', ...binding, input }));
    } else await ok(scenarioInput(r.host, actor, input));
  }
  assert.fail('Invented continuation did not return');
}
export async function nextOwnedRound(r) {
  for (const actor of r.players) {
    const s = await readSession(r.host),
      hero = s.preparation.heroes.find((h) => h.playerId === actor.body.player.id);
    if (!s.round.activeHeroId) await ok(cycleCommand(r, 'START_TURN', {}, actor));
    await ok(cycleCommand(r, 'END_TURN', {}, actor));
    await drainOwned(r);
  }
  await ok(cycleCommand(r, 'BEGIN_SHADOW'));
  await drainOwned(r);
  await ok(cycleCommand(r, 'CONFIRM_SHADOW_STEP', { step: 'threat' }));
  await drainOwned(r);
  for (const actor of r.players) {
    await ok(cycleCommand(r, 'START_RALLY_SCOUT', {}, actor));
    await drainOwned(r);
  }
  await ok(cycleCommand(r, 'END_RALLY'));
}
