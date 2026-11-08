import { generateBattleDeployment } from './battle-deployment';
import type { State } from '../server/state';
import type { CampDepartureCapability, BattleInstruction } from '../shared/camp-departure';
import type { PhysicalProgram } from '../shared/physical';
import type { ScenarioCommand } from '../shared/protocol';
import {
  ScenarioSchema,
  ScenarioPackSchema,
  type ScenarioRequest,
  type SourceText,
} from '../shared/scenario';
import { JourneyDefinitionSchema } from '../shared/journey-map';
import { verifyBattleMapArtifact } from '../battle-map';
import { compileSourceDeployment } from '../combat/deployment-compiler';
import { digest } from '../map-freeze/hash';
import { invariant } from '../map-freeze/validate';
import { cycleUUID } from '../physical-resolution/cycle-request';
import { openPhysical, answerPhysical } from '../physical-resolution/runtime';
import { ApiError } from '../server/errors';
import { battleCombatPack, verifiedBattleBoard } from './battle-combat';
import { battleRoundsPack } from './battle-rounds';
import { compileScenarioPack } from './compiler';

const text = (value: string): SourceText => [{ kind: 'text', style: 'plain', text: value }];
export function battleGeometry(cap: CampDepartureCapability) {
  const board = verifiedBattleBoard(cap);
  const layout = board.compiled.layouts.find((l) => l.id === board.compiled.selectedAlternative)!;
  const all = layout.patches.flatMap((p) => p.vertices),
    minX = Math.min(...all.map((p) => p[0])),
    maxX = Math.max(...all.map((p) => p[0])),
    minY = Math.min(...all.map((p) => p[1])),
    maxY = Math.max(...all.map((p) => p[1]));
  const scale = 700 / Math.max(maxX - minX, maxY - minY),
    point = (x: number, y: number) => ({ x: 24 + (x - minX) * scale, y: 24 + (maxY - y) * scale });
  const bindings = layout.cells.map((c) => ({
    sourceId: c.id,
    id: `battle-${Buffer.from(c.id).toString('base64url')}`,
  }));
  const id = (cell: string) => bindings.find((b) => b.sourceId === cell)!.id;
  const start = cap.instructions.find((i) => i.op === 'heroes')!;
  invariant(start.op === 'heroes', 'Spawn eroi assente.');
  const definition = JourneyDefinitionSchema.parse({
    id: `battle-${cap.boardFingerprint.slice(0, 24)}`,
    label: cap.target.name,
    topology: 'battle',
    walls: layout.walls.map((w) => {
      const contacts = layout.geometricEdges.find((e) =>
        e.cells.every((c) => w.cells.includes(c)),
      )!.contacts;
      const contact = contacts[0]!,
        low = Math.min(...contacts.map((c) => c.span[0])),
        high = Math.max(...contacts.map((c) => c.span[1])),
        axis = contact.sides.reduce((a, b) => a + b, 0) / 2;
      return {
        id: w.id,
        a: contact.axis === 'x' ? point(axis, low) : point(low, axis),
        b: contact.axis === 'x' ? point(axis, high) : point(high, axis),
      };
    }),
    source: {
      name: 'Verified battle-map artifact',
      sha256: cap.boardFingerprint,
      reference: 'Bounded rectilinear battle cells; walkable edges excluding source walls',
    },
    width: Math.max(64, Math.ceil((maxX - minX) * scale + 48)),
    height: Math.max(64, Math.ceil((maxY - minY) * scale + 48)),
    startSpaceId: id(layout.placements.find((p) => p.id === start.anchor)!.cell!),
    spaces: layout.cells.map((c) => {
      const patches = layout.patches.filter((p) => p.cell === c.id),
        points = patches.flatMap((p) => p.vertices),
        x = points.reduce((n, p) => n + p[0], 0) / points.length,
        y = points.reduce((n, p) => n + p[1], 0) / points.length;
      return {
        id: id(c.id),
        label: c.id,
        ...point(x, y),
        hexes: patches.map((p) => {
          const [[left, right], [bottom, top]] = p.bounds;
          return {
            ...point((left + right) / 2, (bottom + top) / 2),
            polygon: [
              [left, bottom],
              [right, bottom],
              [right, top],
              [left, top],
            ].map(([x, y]) => point(x!, y!)),
          };
        }),
      };
    }),
    connections: layout.walkableEdges.map(([a, b]) => [id(a), id(b)]),
  });
  return { board, layout, bindings, definition };
}
export function createBattleScenario(
  cap: CampDepartureCapability,
  id: string,
  lore: number,
  balances: NonNullable<
    NonNullable<NonNullable<State['scenario']>['conclusion']>['campaign']
  >['training'],
  archived: NonNullable<State['scenario']>,
  lastStandsFailed: number,
) {
  const g = battleGeometry(cap),
    sourceFingerprint = digest(cap);
  let pack = ScenarioPackSchema.parse({
    formatVersion: 1,
    algorithm: 'source-startup-ir-v1',
    identity: { adventureId: 2, adventureSource: cap.target.model, language: 'Italian' },
    name: cap.target.name,
    sources: [{ file: 'frozen-departure-capability', sha256: sourceFingerprint }],
    globals: [],
    principal: cap.target.principal,
    timers: [],
    definitions: [
      {
        source: cap.target.principal,
        initial: 0,
        variables: [],
        handlers: {},
        states: [{ index: 0, actions: [], transitions: {} }],
      },
    ],
    manifest: {
      scope: 'battle-startup-v1',
      evidenceHash: cap.evidenceHash,
      prefabs: [],
      battleStartup: cap,
    },
  });
  if (cap.battleRounds) pack = battleRoundsPack(cap, pack);
  else if (cap.combat) {
    const prospective = battleCombatPack(cap, pack);
    pack = compileScenarioPack({
      pack: prospective,
      certificates: [cap.combat.terminal.certificate],
      failureCertificate: { instructionHash: digest(prospective.manifest.failure) },
    }).pack;
  }
  const campaign = archived.conclusion!.campaign!;
  const scenario = ScenarioSchema.parse({
    id,
    pack,
    packFingerprint: digest(pack),
    projectionFingerprint: cap.boardFingerprint,
    phase: 'setup',
    instances: [
      {
        id: 'principal',
        kind: 'principal',
        definition: cap.target.principal,
        prefab: null,
        spaceId: null,
        variables: Object.fromEntries(
          pack.definitions
            .find((d) => d.source === cap.target.principal)!
            .variables.map((v) => [v.name, structuredClone(v.value)]),
        ),
        state: pack.definitions.find((d) => d.source === cap.target.principal)!.initial,
        entry: 0,
        started: [],
        completed: [],
        visible: true,
        stopped: false,
        settled: true,
        processing: 0,
      },
      ...(pack.manifest.followup?.instances ?? []).map((row) => {
        const d = pack.definitions.find((d) => d.source === row.definition)!;
        return {
          id: `static:${row.gameObject}`,
          kind: row.kind,
          definition: row.definition,
          prefab: null,
          spaceId: null,
          variables: Object.fromEntries(d.variables.map((v) => [v.name, structuredClone(v.value)])),
          state: d.initial,
          entry: 0,
          started: [],
          completed: [],
          visible: false,
          stopped: false,
          settled: true,
          processing: 0,
        };
      }),
    ],
    globals: cap.combat
      ? {
          ...Object.fromEntries(pack.globals.map((v) => [v.name, structuredClone(v.value)])),
          ...structuredClone(campaign.sceneGlobals),
        }
      : structuredClone(campaign.sceneGlobals),
    tiles: [{ source: cap.target.model, visible: false, explored: false }],
    spaceBindings: g.bindings,
    tasks: [],
    pending: null,
    objective: null,
    threats: [],
    completedSetup: [],
    effects: [],
    events: [],
    commands: [],
    initialInspiration: campaign.heroes.map((h) => ({ heroId: h.heroId, value: 0 })),
    messageLog: [],
    handoffCount: 0,
    ...(cap.combat
      ? {
          play: { lore, active: null, attempts: [], tests: [] },
        }
      : {}),
    enemies: { entropy: null, cursor: 0, groups: [], attempts: [] },
    ...(cap.battleRounds
      ? {
          rounds: {
            version: 'source-battle-rounds-v1',
            active: null,
            frames: [],
            battle: {
              groups: [],
              callbacks: [],
              reserved: structuredClone(cap.reserved),
              reservedEliteBanners: cap.reservedEliteBanners,
              bannerPools: {
                normal: [...cap.deployment.mechanics.normalBanners],
                elite: cap.deployment.mechanics.eliteBanners.slice(0, 6 - cap.reservedEliteBanners),
                reservedElite: cap.deployment.mechanics.eliteBanners
                  .slice(6 - cap.reservedEliteBanners)
                  .reverse(),
                returnedGroups: [],
              },
            },
          },
        }
      : {}),
    battle: {
      version: 'source-battle-startup-v1',
      cursor: 0,
      runId: null,
      runKey: null,
      initialized: false,
      afterSetup: false,
      presentation: 0,
      heroIndex: 0,
      placements: [],
      sourceFingerprint,
      campaign: {
        lore,
        balances: balances!.balances,
        completedAdventureIds: archived.conclusion!.completedAdventureIds,
        lastStandsFailed,
        inventoryHash: digest(campaign),
        globals: structuredClone(archived.globals),
        ownership: {
          heroes: campaign.heroes.map((h) => ({
            heroId: h.heroId,
            roleId: h.roleId,
            itemCopies: [...h.itemCopies],
            titleCopies: [...h.titleCopies],
            purchasedCopies: (h.skillCopies ?? []).filter((copy) =>
              cap.deckCatalog.cards.some((c) => c.kind === 'purchased' && c.copies.includes(copy)),
            ),
          })),
          inventory: structuredClone(campaign.inventory ?? []),
        },
      },
    },
  });
  return { scenario, geometry: g };
}
type Children = Extract<PhysicalProgram, { profile: 'source-fronts-v1' }>['children'];
function sync(state: State) {
  state.preparation = structuredClone(state.physical!.snapshot.resolution!.resources!.preparation);
}
function run(state: State, key: 'initial' | 'scout' | 'loss' | 'after-setup', children: Children) {
  const sc = state.scenario!,
    b = sc.battle!,
    p = state.physical!,
    cap = sc.pack.manifest.battleStartup!,
    i = cap.instructions[b.cursor]!;
  const origin = {
    effectId: `battle:${b.cursor}:${key}:${b.heroIndex}`,
    instanceId: 'battle-startup',
    state: i.origin.state,
    entry: b.cursor,
    action: i.origin.action,
    parameterHash: digest({
      source: b.sourceFingerprint,
      instruction: i,
      key,
      heroIndex: b.heroIndex,
    }),
  };
  const context = p.snapshot.resolution!.resources ?? {
    preparation: structuredClone(state.preparation!),
    depletion: [],
    boons: [],
    ...(state.preparation!.episode!.heroes.some((h) => h.accessory)
      ? {
          itemCustody: state.preparation!.episode!.heroes.flatMap((h) =>
            h.accessory
              ? [
                  {
                    copy: h.accessory,
                    heroId: h.heroId,
                    cardId: h.accessory.slice(0, h.accessory.lastIndexOf(':')),
                    modelId: state.episodes![0]!.scenario!.conclusion!.campaign!.inventory!.find(
                      (i) => i.copy === h.accessory,
                    )!.modelId,
                    source: 'camp-departure',
                  },
                ]
              : [],
          ),
        }
      : {}),
  };
  const program: PhysicalProgram = {
    profile: 'source-fronts-v1',
    startupRules: 'source-startup-preparation-v1',
    immediateSkillReset: true,
    initialCredits: p.heroes.map(() => 0),
    limits: p.heroes.map(() => ({ kind: 'requires-capability', capability: 'source-derived' })),
    darknessHeroes: [],
    children,
  };
  b.runId = openPhysical(
    p,
    origin,
    program,
    structuredClone(context),
    {
      heroes: structuredClone(p.heroes),
      connections: structuredClone(state.journey!.definition.connections),
    },
    cycleUUID({ scenario: sc.id, origin }),
  );
  b.runKey = key;
  sync(state);
}
function request(state: State, kind: ScenarioRequest['kind'], value: string) {
  const sc = state.scenario!,
    b = sc.battle!,
    i = sc.pack.manifest.battleStartup!.instructions[b.cursor]!,
    active = state.physical!.snapshot.active;
  const data: Omit<ScenarioRequest, 'id' | 'fingerprint'> = {
    instanceId: 'principal',
    state: i.origin.state,
    entry: b.cursor,
    action: i.origin.action,
    kind,
    text: text(value),
    heroId: kind === 'physical' ? active!.heroId : null,
    actorPlayerId: kind === 'physical' ? active!.actorPlayerId : null,
    stage: 'ready',
    tileSource: null,
    ...(kind === 'physical'
      ? {
          physical: {
            parentId: b.runId!,
            child: active!.child,
            grant: active!.kind === 'prevent' ? active!.grant : null,
            ...(active!.kind === 'decision' ? { cursor: active!.cursor } : {}),
          },
        }
      : {}),
  };
  const id = cycleUUID({
    scenario: sc.id,
    cursor: b.cursor,
    hero: b.heroIndex,
    presentation: b.presentation,
    run: b.runId,
    active: active ? digest(active) : null,
    commands: sc.commands.length,
    kind,
  });
  sc.pending = { ...data, id, fingerprint: digest({ scenarioId: sc.id, ...data, id }) };
}
function entered(state: State, i: BattleInstruction) {
  const sc = state.scenario!,
    b = sc.battle!,
    cap = sc.pack.manifest.battleStartup!,
    g = battleGeometry(cap);
  sc.effects.push({
    id: `battle:${b.cursor}`,
    instanceId: 'principal',
    state: i.origin.state,
    entry: b.cursor,
    action: i.origin.action,
    op: i.op,
  });
  if (i.op === 'threshold') {
    sc.globals.battleThreat = 0;
    sc.globals.battleThreshold = i.perHero * state.preparation!.heroes.length;
    sc.globals.battleLimit = i.limitPerHero * state.preparation!.heroes.length;
    if (cap.battleRounds) {
      const source = cap.battleRounds;
      sc.instances[0]!.variables[source.principalThresholdBinding] = sc.globals.battleThreshold;
      sc.threats.push({
        source: source.thresholds[0]!.source,
        threshold: sc.globals.battleThreshold,
      });
    }
  }
  if (i.op === 'board') sc.tiles[0]!.visible = sc.tiles[0]!.explored = true;
  if (i.op === 'heroes') b.placements.push({ anchor: i.anchor, kind: 'hero' });
  if (i.op === 'terrain')
    i.anchors.forEach((anchor, n) => b.placements.push({ anchor, kind: i.kinds[n]! }));
  if (i.op === 'marker') {
    b.placements.push({ anchor: i.anchor, kind: i.kind });
    b.campaign.lore += i.lore;
    if (sc.play) sc.play.lore += i.lore;
  }
  if (i.op === 'objective') sc.objective = { id: i.id, text: text(i.objectiveText) };
  if (i.op === 'spawn' && !sc.enemies!.attempts.length) {
    sc.enemies!.entropy = digest({ stream: 'battle-spawn-v1', entropy: state.physical!.entropy });
    const result = generateBattleDeployment(
      cap,
      state.preparation!.heroes.length,
      sc.enemies!.entropy,
    );
    sc.enemies!.cursor = result.cursor;
    sc.enemies!.groups = result.groups;
    sc.enemies!.attempts = result.attempts;
    if (sc.rounds?.version === 'source-battle-rounds-v1') {
      const pools = sc.rounds.battle.bannerPools;
      pools.normal = pools.normal.filter(
        (id) => !result.groups.some((g) => !g.bonuses.length && g.tokenId === id),
      );
      pools.elite = pools.elite.filter(
        (id) => !result.groups.some((g) => g.bonuses.length && g.tokenId === id),
      );
    }
  }
}
/** Execute source-ordered setup. Every card mutation stays in the physical kernel. */
export function pumpBattleStartup(state: State) {
  const sc = state.scenario!,
    b = sc.battle!,
    cap = sc.pack.manifest.battleStartup!;
  for (let guard = 0; guard < 100; guard++) {
    if (state.physical!.snapshot.active) {
      request(state, 'physical', cap.instructions[b.cursor]!.text);
      return;
    }
    if (b.runId) {
      const parent = state.physical!.snapshot.parents.find((p) => p.id === b.runId)!;
      invariant(
        parent.status === 'completed' && parent.returnCount === 1,
        'Figlio startup non restituito.',
      );
      if (b.runKey === 'scout') {
        const result = parent.results[0]!,
          run = state.physical!.runs.find((r) => r.id === b.runId)!;
        sc.completedSetup.push({
          kind: 'scout',
          heroId: result.heroId,
          source: run.source.effectId,
          requestId: run.answers.at(-1)!.evidence.pendingId,
          serviceId: run.id,
          ...result.setup!,
        });
        b.heroIndex++;
      }
      b.runId = null;
      b.runKey = null;
    }
    if (!b.initialized) {
      b.initialized = true;
      run(
        state,
        'initial',
        state.preparation!.heroes.flatMap((h, hero) => [
          { kind: 'battle-equipment' as const, hero, window: 'initialize' as const },
          ...h.prepared.map((copy) => ({ kind: 'prepared' as const, hero, copy })),
        ]),
      );
      continue;
    }
    const i = cap.instructions[b.cursor];
    invariant(i, 'Startup oltre il confine.');
    if (!sc.effects.some((e) => e.id === `battle:${b.cursor}`)) entered(state, i);
    if (i.op === 'scout') {
      if (b.heroIndex < state.preparation!.heroes.length) {
        run(state, 'scout', [{ kind: 'startup-scout', hero: b.heroIndex, count: 3 }]);
        continue;
      }
      b.heroIndex = 0;
      b.cursor++;
      continue;
    }
    if (i.op === 'loss-weakness') {
      if (state.episodes![0]!.scenario!.conclusion!.outcome === 'victory') {
        b.cursor++;
        continue;
      }
      if (!state.physical!.runs.some((r) => r.source.effectId === `battle:${b.cursor}:loss:0`)) {
        run(
          state,
          'loss',
          state.preparation!.heroes.map((_, hero) => ({
            kind: 'battle-loss-weakness' as const,
            hero,
          })),
        );
        continue;
      }
    }
    if (i.op === 'threshold') {
      b.cursor++;
      continue;
    }
    if (i.op === 'handoff' && !b.afterSetup) {
      b.afterSetup = true;
      run(
        state,
        'after-setup',
        state.preparation!.heroes.map((_, hero) => ({
          kind: 'battle-equipment' as const,
          hero,
          window: 'after-setup' as const,
        })),
      );
      continue;
    }
    if (i.op === 'spawn') {
      const groups = sc.enemies!.attempts.find((a) => a.effectId === `battle:${b.cursor}`)!.groups;
      const group = sc.enemies!.groups.find((g) => g.id === groups[b.presentation]);
      if (group) {
        const d = compileSourceDeployment(cap.deployment),
          model = d.compiled.models.find((m) => m.source === group.source)!;
        request(
          state,
          'deployment',
          `${i.text} ${group.figures.length} ${model.name} · ${state.journey!.definition.spaces.find((s) => s.id === sc.spaceBindings.find((b) => b.sourceId === group.spaceId)!.id)!.label}.`,
        );
        return;
      }
      b.presentation = 0;
      b.cursor++;
      continue;
    }
    request(
      state,
      i.op === 'handoff'
        ? 'handoff'
        : i.op === 'objective'
          ? 'objective'
          : ['board', 'heroes', 'terrain', 'marker'].includes(i.op)
            ? 'placement'
            : 'message',
      i.text,
    );
    return;
  }
  throw new Error('Budget startup battaglia superato.');
}
export function answerBattleStartup(
  state: State,
  playerId: string,
  command: Extract<ScenarioCommand, { type: 'SCENARIO_INPUT' }>,
) {
  const sc = state.scenario!,
    q = sc.pending,
    b = sc.battle!;
  if (
    !q ||
    command.scenarioId !== sc.id ||
    command.packFingerprint !== sc.packFingerprint ||
    command.projectionFingerprint !== sc.projectionFingerprint ||
    command.pendingId !== q.id ||
    command.sourceFingerprint !== q.fingerprint ||
    command.heroId !== q.heroId
  )
    throw new ApiError(409, 'SCENARIO_REQUEST_CHANGED', 'La richiesta dell’avventura è cambiata.');
  if (q.actorPlayerId && q.actorPlayerId !== playerId)
    throw new ApiError(403, 'SCENARIO_ACTOR', 'Questa scelta spetta al proprietario indicato.');
  if (q.kind === 'physical') {
    if (!command.input.kind.startsWith('physical-'))
      throw new ApiError(409, 'PHYSICAL_INPUT_REQUIRED', 'Completa le carte qui sotto.');
    answerPhysical(state.physical!, b.runId!, command.input, {
      playerId,
      requestId: command.requestId,
      pendingId: q.id,
      sourceFingerprint: q.fingerprint,
      revision: state.revision + 1,
    });
    sync(state);
  } else {
    if (command.input.kind !== 'ack')
      throw new ApiError(409, 'SCENARIO_INPUT_REQUIRED', 'Conferma il passaggio corrente.');
    if (q.kind === 'handoff') {
      sc.phase = 'action';
      sc.handoffCount = 1;
      state.round = structuredClone(state.physical!.cycle!.seed.round);
      sc.pending = null;
      b.cursor++;
      return;
    }
    if (q.kind === 'deployment') {
      const group = sc.enemies!.groups.find(
        (g) =>
          g.id ===
          sc.enemies!.attempts.find((a) => a.effectId === `battle:${b.cursor}`)!.groups[
            b.presentation
          ],
      )!;
      group.placed = true;
      b.presentation++;
    } else b.cursor++;
    sc.messageLog.push({ id: `battle-message:${q.id}`, text: structuredClone(q.text) });
  }
  sc.pending = null;
  pumpBattleStartup(state);
}
