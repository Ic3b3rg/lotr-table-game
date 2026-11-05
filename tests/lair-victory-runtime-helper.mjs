import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { lastStandFixture } from './fixtures/last-stand.mjs';
import { binding, hash, evidence } from './fixtures/physical-fronts.mjs';
import {
  compilePhysicalFronts,
  compileLastStand,
  freezePhysical,
  openPhysical,
  answerPhysical,
} from '../dist/physical-resolution-library.mjs';
import { lairCompilation } from './fixtures/lair-victory.mjs';
const built = buildSync({
  stdin: {
    contents: `export { pumpPhaseEvent, interactScenario, resumeScenario } from './src/scenario/runtime'; export { advanceConclusion, answerCampaign, beginHeroFailure } from './src/scenario/conclusion';`,
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
});
export const driver = await import(
  'data:text/javascript;base64,' +
    Buffer.from(
      Buffer.from(built.outputFiles[0].contents).toString() +
        '\n//# sourceURL=lair-runtime-driver.mjs',
    ).toString('base64')
);
export function lairRuntime({ count = 3, successes = count + 2, edit = () => {} } = {}) {
  const f = lastStandFixture(),
    pack = lairCompilation().pack;
  const heroes = f.catalog.heroes.slice(0, count).map((h, n) => ({
    heroId: h.id,
    playerId: `00000000-0000-4000-8000-00000000001${n}`,
    spaceId: 'invented-space',
  }));
  f.context.preparation.heroes = heroes.map((h, n) => ({
    heroId: h.heroId,
    playerId: h.playerId,
    roleId: `role-${n + 1}`,
    itemCopies: [],
    inspiration: 2,
    prepared: [],
    deck: [
      ...f.catalog.basicSkills,
      ...f.catalog.heroes[n].skills,
      ...f.catalog.roles[n].skills,
      `weak-${n + 1}`,
    ].map((id) => `${id}:${id.startsWith('basic') ? n + 1 : 1}`),
    discard: [],
  }));
  f.context.preparation.weaknessDeck = f.catalog.weaknessCards.slice(count).map((id) => `${id}:1`);
  for (const h of f.catalog.heroes) h.stats.wit = successes;
  for (const def of f.ir.definitions) def.body = [{ op: 'keep-faceup' }];
  edit(f, pack);
  const physical = freezePhysical(
    f.raw,
    binding,
    heroes,
    '1'.repeat(64),
    undefined,
    { artifact: compilePhysicalFronts(f.raw, f.ir, f.catalog), catalog: f.catalog },
    compileLastStand(f.raw, f.lastStandInput),
  );
  physical.version = 3;
  const d = pack.definitions.find(
    (d) =>
      d.source ===
      pack.manifest.prefabs.find((p) => p.source === pack.manifest.lair.prefab).fsmSource,
  );
  const instance = (id, definition, kind) => ({
    id,
    definition: definition.source,
    kind,
    prefab: kind === 'encounter' ? pack.manifest.lair.prefab : null,
    spaceId: kind === 'encounter' ? 'source-space' : null,
    variables: Object.fromEntries(
      definition.variables.map((v) => [v.name, structuredClone(v.value)]),
    ),
    state: definition.initial,
    entry: 1,
    started: [],
    completed: [],
    stopped: false,
    settled: false,
    visible: kind === 'encounter',
    processing: 0,
  });
  const i = instance('invented-lair', d, 'encounter');
  i.state = d.handlers.PRE_REVEAL;
  const principal = instance(
    'principal',
    pack.definitions.find((d) => d.source === pack.principal),
    'principal',
  );
  principal.settled = true;
  const id = '00000000-0000-4000-8000-000000000099';
  const sc = {
    id,
    phase: 'action',
    pack,
    packFingerprint: hash(pack),
    projectionFingerprint: hash('projection'),
    globals: Object.fromEntries(pack.globals.map((v) => [v.name, structuredClone(v.value)])),
    instances: [principal, i],
    pending: null,
    tasks: [],
    effects: [],
    events: [],
    commands: [],
    messageLog: [],
    play: { active: null, attempts: [], tests: [], lore: 0 },
    tiles: [],
    spaceBindings: [{ id: 'invented-space', sourceId: 'source-space' }],
  };
  sc.globals.inventedPartySize = count;
  const state = {
    scenario: sc,
    content: f.catalog,
    preparation: structuredClone(f.context.preparation),
    physical,
    revision: 0,
    generation: id,
    players: heroes.map((h) => ({ id: h.playerId })),
    round: {
      id,
      turnId: id,
      activeHeroId: heroes[0].heroId,
      phase: 'action',
      heroes: heroes.map((h) => ({ heroId: h.heroId, actionsUsed: 0 })),
    },
    journey: { heroes, definition: { connections: [] } },
    mapGeneration: {
      status: 'frozen',
      projection: {
        sections: [{ id: 0, tiles: [{ source: 'example.assets:50000', hashId: 9 }] }],
        spaces: [
          {
            id: 'source-space',
            index: 0,
            tileSource: 'example.assets:50000',
            hasDarkness: false,
            nodePosition: [0, 0, 0],
          },
        ],
      },
    },
  };
  driver.pumpPhaseEvent(state);
  let commandIndex = 0;
  const intent = () => ({
    type: 'INTERACT_SCENARIO',
    requestId: `invented-lair-commit-request-${commandIndex++}`,
    scenarioId: sc.id,
    packFingerprint: sc.packFingerprint,
    projectionFingerprint: sc.projectionFingerprint,
    sourceFingerprint: hash(i),
    instanceId: i.id,
    heroId: heroes[0].heroId,
    roundId: id,
    turnId: id,
  });
  const answer = (input, actor) => {
    const q = sc.pending;
    const c = {
      type: 'SCENARIO_INPUT',
      requestId: `invented-lair-answer-request-${commandIndex++}`,
      generation: id,
      expectedRevision: state.revision++,
      scenarioId: sc.id,
      packFingerprint: sc.packFingerprint,
      projectionFingerprint: sc.projectionFingerprint,
      pendingId: q.id,
      sourceFingerprint: q.fingerprint,
      heroId: q.heroId,
      input,
    };
    if (sc.conclusion?.stage !== 'conclusion' && sc.conclusion)
      driver.answerCampaign(state, actor ?? heroes[0].playerId, c);
    else driver.resumeScenario(state, actor ?? q.actorPlayerId ?? heroes[0].playerId, c);
    driver.advanceConclusion(state);
  };
  const commit = () => driver.interactScenario(state, heroes[0].playerId, intent());
  const finishPhysical = () => {
    for (let n = 0; n < 150 && sc.pending?.kind === 'physical'; n++) {
      const a = physical.snapshot.active;
      assert.ok(a);
      answer({
        kind: 'physical-choice',
        option:
          ['resolve', 'close', 'reveal'].find((id) => a.options?.some((o) => o.id === id)) ??
          a.options[0].id,
      });
    }
    assert.notEqual(sc.pending?.kind, 'physical');
  };
  const defeat = (hero) => {
    // A real invented P2 antecedent, before the interaction under test.
    const program = {
      profile: 'source-fronts-v1',
      initialCredits: heroes.map(() => 0),
      limits: heroes.map(() => ({ kind: 'requires-capability', capability: 'source-derived' })),
      darknessHeroes: [],
      children: [
        {
          kind: 'suffer',
          hero,
          face: 'faceup',
          cards: [{ family: 'fear', amount: 1 }],
          prevention: [],
        },
      ],
    };
    openPhysical(
      physical,
      {
        effectId: 'invented-prior-defeat',
        instanceId: 'prior',
        state: 0,
        entry: 1,
        action: 0,
        parameterHash: hash('prior'),
      },
      program,
      f.context,
      { heroes, connections: [] },
    );
    for (let n = 0; physical.snapshot.active && n < 100; n++) {
      const a = physical.snapshot.active;
      answerPhysical(
        physical,
        a.runId,
        {
          kind: 'physical-choice',
          option:
            ['force-fail', 'resolve', 'close', 'reveal'].find((id) =>
              a.options.some((o) => o.id === id),
            ) ?? a.options[0].id,
        },
        evidence(n, a.actorPlayerId),
      );
    }
    state.preparation = structuredClone(physical.snapshot.resolution.resources.preparation);
    state.revision = 100;
    assert.equal(physical.snapshot.lastStand.heroes[hero].defeated, true);
  };
  return { state, sc, i, physical, heroes, commit, intent, answer, finishPhysical, defeat };
}
