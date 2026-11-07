// Invented technical states for focused controller/projection regressions.
// These are not native gameplay, accepted backups, or original game sources.
import { randomUUID } from 'node:crypto';
import { departureFixture } from './camp-departure.mjs';
import { attachBattleCombat } from './battle-combat.mjs';
import { frontFixture, evidence } from './physical-fronts.mjs';
import { inventedLastStand } from './last-stand.mjs';
import { groupFixture } from './combat-closure.mjs';
import {
  compileLastStand,
  freezePhysical,
  answerPhysical,
} from '../../dist/physical-resolution-library.mjs';
import { digest } from '../../dist/map-freeze-library.mjs';
import { battleRuntime as runtime } from '../battle-combat-runtime.mjs';

export async function reviewBattle({ grant = false, movement = false } = {}) {
  const f = await departureFixture();
  attachBattleCombat(
    f.input.pack,
    { preparation: { heroes: f.catalog.heroes.slice(0, 3).map((h) => ({ heroId: h.id })) } },
    f.catalog,
    (_departure, source) => {
      for (const a of source.assets.filter((a) => a.cls === 'EnemyActivationModel')) {
        for (const row of a.data.Damage) {
          row.Physical = movement ? 1 : 0;
          row.Fear = 0;
        }
        if (movement) a.data.KeyAttackAdditionalEffect = 'extra';
        a.dataHash = digest(a.data);
      }
      if (movement)
        Object.assign(source.additions[0], {
          predicate: 'damage-positive',
          effect: { op: 'move-pair-toward-threat', amount: 1 },
        });
      if (grant) {
        const d = source.definitions.find((d) => d.id === 'role-1-skill-1');
        d.clauses = 1;
        source.clauses = [
          {
            cardId: d.id,
            definitionHash: d.definitionHash,
            originalHash: d.originalHash,
            locator: d.locator,
            clause: 0,
            window: 'after-attack-after-counterattack',
            effect: { op: 'granted-attack', inspiration: 1 },
          },
        ];
      }
    },
  );
  const prep = frontFixture().context.preparation;
  prep.heroes.forEach((h, n) => {
    h.itemCopies = [`sword:${n + 1}`, `armor:${n + 1}`];
  });
  prep.episode = {
    version: 'camp-departure-v1',
    sourceFingerprint: digest(f.cap),
    skills: f.cap.campaignSkills,
    heroes: prep.heroes.map((h) => ({
      heroId: h.heroId,
      accessory: null,
      copies: [...h.prepared, ...h.deck].filter((c) => !c.startsWith('weak-')),
    })),
  };
  const created = runtime.createBattleScenario(
    f.cap,
    randomUUID(),
    0,
    { balances: [] },
    {
      globals: {},
      conclusion: {
        completedAdventureIds: [1],
        campaign: {
          heroes: prep.heroes.map((h) => ({ ...h, titleCopies: [], skillCopies: [] })),
          sceneGlobals: {},
        },
      },
    },
    0,
  );
  const sc = created.scenario;
  const layout = f.cap.board.compiled.layouts.find(
    (l) => l.id === f.cap.board.compiled.selectedAlternative,
  );
  const threat = layout.placements.find((p) => p.id === f.cap.combat.threats[0].anchor).cell;
  const forbidden = new Set(
    f.cap.combat.terrain
      .filter((t) => ['fire', 'rock'].includes(t.kind))
      .map((t) => layout.placements.find((p) => p.id === t.anchor).cell),
  );
  const sourceCell = movement
    ? created.geometry.definition.connections
        .flatMap(([a, b]) => {
          const from = sc.spaceBindings.find((v) => v.sourceId === threat).id;
          return a === from ? [b] : b === from ? [a] : [];
        })
        .map((id) => sc.spaceBindings.find((b) => b.id === id).sourceId)
        .find((s) => !forbidden.has(s))
    : 'west/veranda';
  const cell = sc.spaceBindings.find((b) => b.sourceId === sourceCell).id;
  sc.phase = 'action';
  sc.pending = null;
  sc.battle.placements = f.cap.instructions.flatMap((i) =>
    i.op === 'terrain'
      ? i.anchors.map((anchor, n) => ({ anchor, kind: i.kinds[n] }))
      : i.op === 'marker'
        ? [{ anchor: i.anchor, kind: i.kind }]
        : [],
  );
  const group = { ...groupFixture(), spaceId: sourceCell, tileSource: f.cap.target.model };
  sc.enemies.groups = [group];
  const heroes = prep.heroes.map((h) => ({
    heroId: h.heroId,
    playerId: h.playerId,
    spaceId: cell,
  }));
  const physical = freezePhysical(
    f.raw,
    {
      scenarioId: sc.id,
      packFingerprint: sc.packFingerprint,
      projectionFingerprint: sc.projectionFingerprint,
    },
    heroes,
    '1'.repeat(64),
    undefined,
    { artifact: f.cap.fronts, catalog: f.catalog, campaignSkills: f.cap.campaignSkills },
    compileLastStand(f.raw, inventedLastStand(f.raw)),
    undefined,
    { version: 'camp-departure-v1', titles: [] },
  );
  physical.version = 3;
  physical.cycle = { version: 3, seed: {}, records: [], pending: null };
  const state = {
    schemaVersion: 33,
    id: randomUUID(),
    generation: randomUUID(),
    revision: 7,
    scenario: sc,
    physical,
    content: f.catalog,
    preparation: prep,
    mapGeneration: null,
    skillTest: null,
    scout: null,
    players: prep.heroes.map((h) => ({ id: h.playerId, name: h.heroId })),
    journey: {
      id: sc.id,
      definition: created.geometry.definition,
      heroes: heroes.map(({ heroId, spaceId }) => ({ heroId, spaceId })),
      travel: null,
    },
    round: {
      id: randomUUID(),
      number: 1,
      phase: 'action',
      shadowStep: null,
      activeHeroId: prep.heroes[0].heroId,
      turnId: randomUUID(),
      heroes: prep.heroes.map((h) => ({
        heroId: h.heroId,
        actionsUsed: 0,
        turnEnded: false,
        rallyDone: false,
      })),
    },
  };
  physical.cycle.seed = {
    revision: state.revision,
    round: structuredClone(state.round),
    journey: structuredClone(state.journey),
    preparation: structuredClone(prep),
  };
  state.combat = runtime.initialCombat(state);
  return { state, cap: f.cap, group };
}

export function commandFor(pending, choice) {
  return {
    type: 'COMBAT_INPUT',
    combatId: pending.combatId,
    pendingId: pending.id,
    sourceFingerprint: pending.sourceFingerprint,
    choice,
  };
}

export function reviewAttack(state) {
  const offer = runtime.combatView(state).attacks.find((o) => !o.reason);
  if (!offer) throw Error('The invented source must provide a complete attack offer.');
  return {
    type: 'START_ATTACK',
    roundId: state.round.id,
    turnId: state.round.turnId,
    heroId: offer.heroId,
    groupId: offer.groupId,
    itemCopies: offer.itemCopies,
    stat: offer.stat,
    replaceCopy: null,
    grantId: null,
  };
}

export function advanceReview(state, stop) {
  for (let n = 0; n < 200; n++) {
    if (stop()) return;
    const q = state.physical.snapshot.active;
    if (q) {
      const input =
        q.mode === 'choose'
          ? {
              kind: 'physical-choice',
              option:
                ['reveal', 'resolve', 'apply', 'close', 'keep', 'close-rest'].find((id) =>
                  q.options.some((o) => o.id === id && !o.unavailable),
                ) ?? q.options.find((o) => !o.unavailable).id,
            }
          : q.mode === 'select'
            ? { kind: 'physical-select', ids: q.options.slice(0, q.minimum).map((o) => o.id) }
            : q.mode === 'scout'
              ? {
                  kind: 'physical-scout',
                  prepare: null,
                  discard: null,
                  top: q.options.map((o) => o.id),
                  bottom: [],
                }
              : { kind: 'physical-allocate', ability: null, damage: 0, fear: 0 };
      answerPhysical(state.physical, q.runId, input, evidence(state.revision++, q.actorPlayerId));
      state.preparation = structuredClone(state.physical.snapshot.resolution.resources.preparation);
    } else {
      const pending = runtime.combatPending(state);
      if (!pending) throw Error('The real controller lost its pending continuation.');
      const option =
        pending.options.find((o) => o.id === 'addition' && !o.unavailable) ??
        pending.options.find((o) => o.id === 'close' && !o.unavailable) ??
        pending.options.find((o) => !o.unavailable);
      runtime.answerCombat(
        state,
        pending.actorPlayerId,
        commandFor(pending, option.id),
        randomUUID(),
      );
    }
    runtime.advanceCombat(state);
  }
  throw Error('The real controller did not reach the required stage.');
}
