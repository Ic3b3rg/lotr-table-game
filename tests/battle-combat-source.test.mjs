import test from 'node:test';
import assert from 'node:assert/strict';
import { departureFixture } from './fixtures/camp-departure.mjs';
import { attachBattleCombat } from './fixtures/battle-combat.mjs';
import { battleRuntime } from './battle-combat-runtime.mjs';
import { compileScenarioPack } from '../dist/scenario-library.mjs';
import { hash } from './fixtures/map-freeze.mjs';
import { randomUUID } from 'node:crypto';
import { compileCombatClosure } from '../dist/combat-library.mjs';

export async function battleSourceFixture() {
  const f = await departureFixture();
  attachBattleCombat(
    f.input.pack,
    { preparation: { heroes: f.catalog.heroes.slice(0, 3).map((h) => ({ heroId: h.id })) } },
    f.catalog,
  );
  return f;
}
test('archived A1 derives absent domains without inheriting active A2 combat', () => {
  const archive = { scenario: { id: 'archived-source' } };
  const restored = battleRuntime.archivedState({
    episodes: [archive],
    combat: { active: 'second-episode' },
    scout: { active: 'second-episode' },
    schemaVersion: 33,
  });
  assert.equal(restored.scenario.id, 'archived-source');
  assert.equal(restored.combat, undefined);
  assert.equal(restored.scout, undefined);
  assert.equal(restored.schemaVersion, 33);
});
test('prospective invented source compiles the actual terminal receiver through the scenario compiler', async () => {
  const f = await battleSourceFixture(),
    cap = f.cap.combat;
  const pack = battleRuntime.battleCombatPack(f.cap, {
    formatVersion: 1,
    algorithm: 'source-startup-ir-v1',
    sources: [],
    globals: [],
    definitions: [],
    manifest: { evidenceHash: hash('invented') },
  });
  const compiled = compileScenarioPack({
    pack,
    certificates: [cap.terminal.certificate],
    failureCertificate: { instructionHash: hash(cap.terminal.failure) },
  });
  assert.equal(compiled.pack.manifest.scope, 'battle-combat-v1');
  assert.equal(compiled.pack.definitions[0].handlers.EXAMPLE_BATTLE_FAILURE, 18);
  assert.equal(compiled.coverage.definitions, 1);
  const heroes = f.catalog.heroes.slice(0, 3).map((h, n) => ({
    heroId: h.id,
    roleId: f.catalog.roles[n].id,
    itemCopies: [],
    titleCopies: [],
    skillCopies: [],
  }));
  const archived = {
    globals: {},
    conclusion: { completedAdventureIds: [1], campaign: { heroes, sceneGlobals: {} } },
  };
  const created = battleRuntime.createBattleScenario(
    f.cap,
    randomUUID(),
    7,
    { balances: [] },
    archived,
    0,
  );
  assert.equal(created.scenario.play.lore, 7);
  assert.equal(created.scenario.globals.battleDarkness, false);
  const receiver = { scenario: created.scenario, mapGeneration: null, preparation: { heroes: [] } };
  assert.equal(
    battleRuntime.startPhaseEvent(receiver, 'principal', cap.terminal.failure.event, true),
    true,
  );
  assert.equal(
    receiver.scenario.pending.kind,
    'message',
    'The actual A2 receiver must run without a journey projection',
  );
});
test('missing mandatory terminal source is rejected by preflight before departure entropy', async () => {
  const f = await battleSourceFixture();
  f.cap.combat.terminal.definition.states.pop();
  assert.throws(
    () => battleRuntime.validateBattleCombatSource(f.cap),
    /terminale|Stato|fonte|conclusione/,
  );
});
test('absent mandatory physical or terminal context returns an exact pre-cost gate', async () => {
  const f = await battleSourceFixture(),
    heroId = f.catalog.heroes[0].id;
  const state = {
    scenario: { pack: { manifest: { battleStartup: f.cap } } },
    preparation: { heroes: [{ heroId }] },
    physical: null,
  };
  const before = structuredClone(state);
  assert.deepEqual(
    battleRuntime.battleCombatProblems(state, heroId, { attack: true, negation: false }),
    ['battle-mandatory-physical-terminal'],
  );
  assert.deepEqual(
    battleRuntime.preflightCombatOperation(
      state,
      f.cap.combat.combat,
      null,
      heroId,
      'counterattack',
    ),
    ['battle-mandatory-physical-terminal'],
  );
  assert.deepEqual(state, before);
});
test('a self-consistent reduced pool and mismatched source receivers cannot activate battle combat', async () => {
  const f = await battleSourceFixture(),
    source = structuredClone(f.cap.combat.combat.source),
    omitted = source.models.pop();
  source.assets = source.assets.filter((a) => a.source !== omitted);
  f.cap.combat.combat = compileCombatClosure(source);
  assert.throws(() => battleRuntime.validateBattleCombatSource(f.cap), /Pool iniziale/);
  const g = await battleSourceFixture();
  g.cap.combat.adventure.model = 'example.assets:12345';
  assert.throws(() => battleRuntime.validateBattleCombatSource(g.cap), /Contesto/);
  const h = await battleSourceFixture();
  h.cap.combat.principal.gameObject = 'example.assets:12345';
  assert.throws(() => battleRuntime.validateBattleCombatSource(h.cap), /Contesto/);
});
test('battle range and live threat destinations derive without an A1 projection', async () => {
  const f = await battleSourceFixture(),
    created = battleRuntime.createBattleScenario(
      f.cap,
      randomUUID(),
      0,
      { balances: [] },
      {
        globals: {},
        conclusion: {
          completedAdventureIds: [1],
          campaign: {
            heroes: [
              {
                heroId: f.catalog.heroes[0].id,
                roleId: f.catalog.roles[0].id,
                itemCopies: [],
                titleCopies: [],
                skillCopies: [],
              },
            ],
            sceneGlobals: {},
          },
        },
      },
      0,
    ),
    sc = created.scenario,
    layout = f.cap.board.compiled.layouts.find(
      (l) => l.id === f.cap.board.compiled.selectedAlternative,
    ),
    [a, b] = layout.walls[0].cells;
  sc.battle.placements = f.cap.instructions.flatMap((i) =>
    i.op === 'marker' ? [{ anchor: i.anchor, kind: i.kind }] : [],
  );
  const state = {
    scenario: sc,
    mapGeneration: null,
    preparation: { heroes: [] },
    journey: {
      heroes: [{ heroId: 'invented', spaceId: sc.spaceBindings.find((x) => x.sourceId === a).id }],
    },
  };
  const before = structuredClone(state);
  assert.equal(battleRuntime.groupInRange(state, 'invented', { spaceId: b }, true), false);
  assert.equal(battleRuntime.groupInRange(state, 'invented', { spaceId: a }, false), true);
  const moves = battleRuntime.nearestThreatSteps(state, a);
  assert.ok(moves.length);
  assert.ok(moves.every((m) => m.targetId === f.cap.combat.threats[0].source));
  assert.deepEqual(state, before, 'Context inspection must preserve the entire input');
  sc.battle.placements = [];
  assert.deepEqual(battleRuntime.nearestThreatSteps(state, a), []);
});
