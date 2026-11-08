import type { State } from '../server/state';
import type { CampDepartureCapability } from '../shared/camp-departure';
import type { ScenarioPack } from '../shared/scenario';
import {
  AdventureFailureCapabilitySchema,
  ScenarioDefinitionSchema,
  ScenarioPackSchema,
} from '../shared/scenario';
import { compileSourceDeployment, meetsEnemyFilter } from '../combat/deployment-compiler';
import { verifyCombatClosure } from '../combat/compiler';
import { verifyBattleMapArtifact } from '../battle-map';
import { definitionId } from '../shared/preparation';
import { digest } from '../map-freeze/hash';
import { invariant } from '../map-freeze/validate';
import { validateBattleTerminalSource } from './compiler';
import { validateFailureParty } from './conclusion';
import { BattleTestTerrainPolicySchema } from '../shared/battle-test-terrain';
import { defeatedHeroes } from '../server/physical-defeat';

let boardCache: { key: string; artifact: ReturnType<typeof verifyBattleMapArtifact> } | undefined;
/** Complete content key: replay may reuse a verified board, while same-object edits still revalidate. */
export function verifiedBattleBoard(cap: CampDepartureCapability) {
  const key = digest({ board: cap.board, fingerprint: cap.boardFingerprint });
  if (boardCache?.key !== key)
    boardCache = {
      key,
      artifact: verifyBattleMapArtifact(cap.board, { artifactFingerprint: cap.boardFingerprint }),
    };
  return boardCache.artifact;
}

/** Validate the complete initial population; never shrink a random pool to supported cases. */
export function validateBattleCombatSource(departure: CampDepartureCapability) {
  const cap = departure.combat;
  invariant(cap, 'Capacità fonte combattimento battaglia assente.');
  if (cap.testTerrain) BattleTestTerrainPolicySchema.parse(cap.testTerrain);
  const deployment = compileSourceDeployment(departure.deployment),
    combat = verifyCombatClosure(cap.combat),
    board = verifiedBattleBoard(departure),
    model = departure.deployment.assets.find((a) => a.source === departure.target.model)!;
  invariant(
    cap.boardFingerprint === departure.boardFingerprint &&
      cap.boardFingerprint === board.artifactFingerprint &&
      cap.deploymentFingerprint === deployment.fingerprint &&
      combat.source.projectionFingerprint === cap.boardFingerprint &&
      combat.source.deploymentFingerprint === deployment.fingerprint,
    'Combattimento di un’altra fonte, deployment o tabellone.',
  );
  invariant(
    cap.model.source === departure.target.model &&
      cap.model.objectHash === model.objectHash &&
      cap.principal.source === departure.target.principal &&
      cap.adventure.model === cap.model.source &&
      cap.adventure.gameObject === cap.principal.gameObject &&
      cap.darkness.disabled === !!model.data.DisableDarkness &&
      !combat.source.shadow,
    'Contesto battaglia non legato al modello/principal corrente o Ombra fuori perimetro.',
  );
  for (const ref of [cap.model, cap.adventure, cap.principal, ...cap.threats])
    invariant(
      combat.source.files.some((f) => f.file === ref.source.split(':')[0]),
      'Oggetto contesto fuori dalle fonti congelate.',
    );
  const points = departure.instructions.filter((i) => i.op === 'spawn'),
    reachable = deployment.compiled.models.filter((m) =>
      points.some((p) => meetsEnemyFilter(m.traits, p.filter)),
    );
  invariant(
    digest(combat.source.models) === digest(reachable.map((m) => m.source)),
    'Pool iniziale combattimento incompleto o filtrato.',
  );
  for (const asset of combat.source.assets.filter((a) => a.cls !== 'EnemyActivationModel')) {
    const d = departure.deployment.assets.find((d) => d.source === asset.source);
    invariant(
      d && d.objectHash === asset.objectHash && d.dataHash === asset.dataHash,
      'Modello/bonus combattimento diverso dal deployment corrente.',
    );
  }
  const definition = ScenarioDefinitionSchema.parse(cap.terminal.definition),
    failure = AdventureFailureCapabilitySchema.parse(cap.terminal.failure);
  invariant(
    Object.values(failure.methods).every(
      (m) => m.assemblyHash === departure.deployment.mechanics.assemblyHash,
    ),
    'Callback terminale di un’altra assembly fonte.',
  );
  invariant(
    definition.source === cap.principal.source &&
      definition.handlers[failure.event] !== undefined &&
      !definition.deferredHandlers[failure.event] &&
      failure.next.source !== departure.target.model,
    'Ricevitore terminale battaglia assente o destinazione non attestata.',
  );
  const cert = cap.terminal.certificate as {
    source?: unknown;
    objectHash?: unknown;
  };
  invariant(
    cert.source === cap.principal.source && cert.objectHash === cap.principal.objectHash,
    'Certificato terminale di un altro principal.',
  );
  validateBattleTerminalSource({
    pack: {
      formatVersion: 1,
      algorithm: 'source-startup-ir-v1',
      identity: {
        adventureId: departure.target.id,
        adventureSource: departure.target.model,
        language: 'Italian',
      },
      name: departure.target.name,
      sources: combat.source.files,
      globals: cap.terminal.globals,
      principal: cap.principal.source,
      timers: [],
      definitions: [definition],
      manifest: { scope: 'battle-combat-v1', prefabs: [], evidenceHash: cap.evidenceHash, failure },
    },
    certificates: [cap.terminal.certificate],
    failureCertificate: { instructionHash: digest(failure) },
  });
  const terrain = departure.instructions.flatMap((i) =>
    i.op === 'terrain' ? i.anchors.map((anchor, n) => ({ anchor, kind: i.kinds[n]! })) : [],
  );
  invariant(
    digest(terrain) === digest(cap.terrain.map(({ anchor, kind }) => ({ anchor, kind }))) &&
      cap.terrain.every(
        (t) =>
          t.window ===
          (
            {
              bush: 'end-turn-optional',
              wall: 'adjacency',
              fire: 'attack-gated',
              rock: 'negate-gated',
            } as const
          )[t.kind],
      ),
    'Finestre terreno omesse o reinterpretate.',
  );
  invariant(
    digest(cap.threats.map((t) => t.anchor)) ===
      digest(
        departure.instructions.flatMap((i) =>
          i.op === 'marker' && i.kind === 'threat' ? [i.anchor] : [],
        ),
      ),
    'Destinazioni minaccia diverse dai nodi fonte.',
  );
  return { cap, deployment, combat, board, definition, failure };
}

export function battleCombat(state: State) {
  return state.scenario?.pack?.manifest?.battleStartup?.combat;
}

export function battleSpatial(state: State) {
  const departure = state.scenario?.pack.manifest.battleStartup;
  invariant(departure?.combat && state.scenario?.battle, 'Contesto fonte battaglia assente.');
  const board = verifiedBattleBoard(departure),
    layout = board.compiled.layouts.find((l) => l.id === board.compiled.selectedAlternative)!;
  return { departure, layout };
}

export function battleDarknessHeroes(state: State) {
  const cap = battleCombat(state)!;
  invariant(
    typeof state.scenario!.globals[cap.darkness.global] === 'boolean' &&
      state.scenario!.globals[cap.darkness.override] === '',
    'Oscurità battaglia richiede un contesto fonte ulteriore.',
  );
  return cap.darkness.disabled || !state.scenario!.globals[cap.darkness.global]
    ? []
    : state.preparation!.heroes.flatMap((h, n) =>
        state.scenario!.rounds?.version === 'source-battle-rounds-v1' &&
        defeatedHeroes(state).includes(h.heroId)
          ? []
          : [n],
      );
}

/** Exact prospective pack, built from the archived departure authority on every replay. */
export function battleCombatPack(departure: CampDepartureCapability, base: ScenarioPack) {
  const { cap, definition, failure } = validateBattleCombatSource(departure);
  return ScenarioPackSchema.parse({
    ...base,
    identity: {
      adventureId: departure.target.id,
      adventureSource: departure.target.model,
      language: 'Italian',
    },
    name: departure.target.name,
    principal: departure.target.principal,
    timers: [],
    sources: structuredClone(cap.combat.source.files),
    globals: structuredClone(cap.terminal.globals),
    definitions: [definition],
    manifest: {
      battleStartup: departure,
      prefabs: [],
      evidenceHash: base.manifest.evidenceHash,
      scope: 'battle-combat-v1',
      combat: cap.combat,
      failure,
    },
  });
}

/** Source context problems are returned before a card, action or random cursor changes. */
export function battleCombatProblems(
  state: State,
  heroId: string,
  window: { attack: boolean; negation: boolean; spaces?: ReadonlySet<string> },
) {
  const cap = battleCombat(state);
  if (!cap) return [];
  const sc = state.scenario!,
    departure = sc.pack.manifest.battleStartup!,
    artifact = verifyCombatClosure(cap.combat),
    hero = state.preparation!.heroes.find((h) => h.heroId === heroId)!,
    problems: string[] = [];
  if (
    !state.physical?.fronts ||
    !state.physical.lastStand ||
    state.physical.version !== 3 ||
    state.physical.cycle?.version !== 3 ||
    !sc.pack.manifest.failure
  )
    return ['battle-mandatory-physical-terminal'];
  if (sc.pack.manifest.failure) {
    try {
      validateFailureParty(state);
    } catch {
      problems.push('battle-terminal-party-identity');
    }
  }
  const definitions = [...state.content!.skills, ...departure.campaignSkills];
  for (const id of new Set([...hero.deck, ...hero.discard, ...hero.prepared].map(definitionId))) {
    const d = definitions.find((d) => d.id === id);
    if (
      !d ||
      !artifact.source.definitions.some((b) => b.id === id && b.definitionHash === digest(d))
    )
      problems.push(`battle-owned-skill:${id}`);
    for (const c of artifact.compiled.clauses.filter((c) => c.cardId === id))
      if (c.effect.op === 'requires-capability')
        problems.push(`battle-card-window:${id}:${c.effect.capability}`);
    if (!sc.pack.manifest.failure!.partyBonus.skills.some((b) => b.cardId === id))
      problems.push(`battle-terminal-skill:${id}`);
  }
  for (const h of state.preparation!.heroes)
    for (const id of new Set([...h.deck, ...h.discard, ...h.prepared].map(definitionId)))
      if (!sc.pack.manifest.failure!.partyBonus.skills.some((b) => b.cardId === id))
        problems.push(`battle-terminal-skill:${id}`);
  for (const id of new Set(hero.itemCopies.map(definitionId))) {
    const d = state.content!.items.find((d) => d.id === id);
    if (!d || !artifact.compiled.items.some((b) => b.id === id && b.definitionHash === digest(d)))
      problems.push(`battle-owned-item:${id}`);
  }
  const h = state.content!.heroes.find((h) => h.id === heroId)!;
  if (!artifact.compiled.heroes.some((b) => b.heroId === heroId && b.definitionHash === digest(h)))
    problems.push(`battle-owned-hero:${heroId}`);
  const source = sc.spaceBindings.find(
    (b) => b.id === state.journey!.heroes.find((h) => h.heroId === heroId)!.spaceId,
  )!.sourceId;
  const at = window.spaces ?? new Set([source]);
  const { layout } = battleSpatial(state);
  const supported = BattleTestTerrainPolicySchema.safeParse(cap.testTerrain).success;
  if (supported) {
    const placed = sc.battle!.placements;
    for (const p of placed) {
      if (p.kind !== 'fire' && p.kind !== 'rock') continue;
      const t = cap.terrain.find((t) => t.anchor === p.anchor && t.kind === p.kind);
      if (
        !t ||
        !layout.placements.find((a) => a.id === p.anchor)?.cell ||
        placed.filter((other) => other.anchor === p.anchor).length !== 1
      )
        problems.push(`battle-terrain-context:${p.anchor}`);
    }
  }
  for (const t of cap.terrain) {
    const cell = layout.placements.find((p) => p.id === t.anchor)!.cell;
    if (cell && at.has(cell) && sc.battle!.placements.some((p) => p.anchor === t.anchor)) {
      if (window.attack && t.window === 'attack-gated' && !supported)
        problems.push(`battle-terrain-fire:${t.anchor}`);
      if (window.negation && t.window === 'negate-gated' && !supported)
        problems.push(`battle-terrain-boulder:${t.anchor}`);
    }
  }
  if (
    typeof sc.globals[cap.darkness.global] !== 'boolean' ||
    sc.globals[cap.darkness.override] !== ''
  )
    problems.push('battle-darkness-context');
  return problems;
}
