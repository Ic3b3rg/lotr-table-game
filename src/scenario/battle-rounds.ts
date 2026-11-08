import type { CampDepartureCapability } from '../shared/camp-departure';
import type { ScenarioPack } from '../shared/scenario';
import {
  ScenarioDefinitionSchema,
  ScenarioPackSchema,
  SourceTextSchema,
  AdventureFailureCapabilitySchema,
} from '../shared/scenario';
import { BattleRoundSourceSchema } from '../shared/source-rounds';
import { compileSourceDeployment } from '../combat/deployment-compiler';
import { verifyCombatClosure } from '../combat/compiler';
import { digest } from '../map-freeze/hash';
import { invariant } from '../map-freeze/validate';
import { validateBattleRoundCertificates } from './compiler';
import { battleCombatPack } from './battle-combat';
import { verifyBattleMapArtifact } from '../battle-map';

const phaseOps = new Set([
  'sourceInt',
  'battleThreat',
  'sumInt',
  'divideInt',
  'whenTrue',
  'battleSpawn',
  'battleReady',
  'battleExhaust',
  'battleVisible',
  'battleNode',
  'battleReserve',
]);
export function hasBattleInstructions(pack: ScenarioPack) {
  return pack.definitions.some((d) =>
    d.states.some((s) =>
      s.actions.some(
        (a) =>
          phaseOps.has(a.op) || (a.op === 'message' && (a.battleSuffering || a.battlePlacement)),
      ),
    ),
  );
}
const unique = (values: readonly string[], message: string) =>
  invariant(new Set(values).size === values.length, message);

/** Bind the complete prospective closure before an episode or a phase can consume it. */
export function validateBattleRoundsSource(departure: CampDepartureCapability) {
  const cap = departure.battleRounds;
  invariant(cap && departure.combat, 'Fonte delle fasi battaglia assente.');
  const base = departure.combat,
    rounds = BattleRoundSourceSchema.parse(cap.rounds),
    deployment = compileSourceDeployment(cap.deployment),
    combat = verifyCombatClosure(cap.combat),
    definitions = cap.definitions.map((d) => ScenarioDefinitionSchema.parse(d)),
    shadow = combat.source.shadow;
  unique(cap.heroIds, 'Compagnia delle fasi duplicata.');
  unique(
    definitions.map((d) => d.source),
    'Definizioni delle fasi duplicate.',
  );
  unique(
    cap.instances.map((d) => d.source),
    'Owner delle fasi duplicati.',
  );
  unique(
    cap.thresholds.map((d) => d.source),
    'Soglie della battaglia duplicate.',
  );
  unique(
    cap.thresholds.map((d) => d.definition),
    'Receiver delle soglie duplicati.',
  );
  unique(
    cap.points.map((p) => p.source),
    'Punti della fase duplicati.',
  );
  unique(
    cap.points.map((p) => p.owner),
    'Owner dei punti duplicati.',
  );
  unique(
    [cap.playerCountBinding, cap.enemyPointsBinding, ...Object.values(rounds.bindings)],
    'Binding globali delle fasi ambigui.',
  );
  invariant(
    cap.baseCombatFingerprint === base.combat.fingerprint &&
      cap.boardFingerprint === departure.boardFingerprint &&
      rounds.projectionFingerprint === departure.boardFingerprint &&
      combat.source.projectionFingerprint === departure.boardFingerprint &&
      combat.source.deploymentFingerprint === deployment.fingerprint &&
      digest(cap.model) === digest(base.model) &&
      cap.adventure.source === base.adventure.source &&
      cap.adventure.objectHash === base.adventure.objectHash &&
      cap.adventure.gameObject === base.adventure.gameObject &&
      digest(cap.principal) === digest(base.principal),
    'Fasi di un altro modello, principal, tabellone, combattimento o deployment.',
  );
  invariant(
    shadow?.version === 'source-battle-shadow-v1' &&
      shadow.battle.boardFingerprint === departure.boardFingerprint &&
      shadow.battle.model === departure.target.model &&
      shadow.battle.principal === departure.target.principal &&
      !shadow.thresholds.length &&
      digest(shadow.terrain.tiles.map((t) => t.source)) === digest([departure.target.model]),
    'Attivazioni non legate al contesto battaglia corrente.',
  );
  const {
    normalDifficulty: _difficulty,
    enemyPointsPerHero: _points,
    difficultyEvidenceHash: _proof,
    ...controller
  } = shadow.controller;
  invariant(
    digest(controller) === digest(rounds.controller) &&
      digest(cap.methods.controller) === digest(rounds.controller) &&
      Object.values(cap.methods).every(
        (m) => m.assemblyHash === departure.deployment.mechanics.assemblyHash,
      ) &&
      cap.globals.reset.assemblyHash === departure.deployment.mechanics.assemblyHash,
    'Metodi delle fasi di un’altra assembly o controller.',
  );
  for (const name of [
    'controller',
    'activation',
    'refresh',
    'processEvent',
    'spawnPoints',
    'spawnFixed',
    'track',
    'applyBonus',
    'signal',
    'defeat',
    'banner',
    'returnBanner',
    'reserveBanner',
  ])
    invariant(cap.methods[name], 'Chiusura dei metodi della fase incompleta.');
  invariant(
    rounds.configuration.difficulty === 'normal' &&
      rounds.configuration.mapType === 'battle' &&
      rounds.configuration.disableDarkness === base.darkness.disabled &&
      !rounds.configuration.initialEnemyGroups.length &&
      !cap.timers.length &&
      rounds.bindings.darkness === base.darkness.global &&
      rounds.bindings.darknessOverride === base.darkness.override &&
      rounds.threat.perHero === 2 &&
      rounds.threat.perToken === 1 &&
      rounds.threat.perUnexploredTile === 0 &&
      rounds.threat.limit === 13 * cap.heroIds.length &&
      rounds.darkness.amount === 2 &&
      rounds.darkness.negate === 'spirit' &&
      rounds.darkness.face === 'faceup' &&
      !rounds.darkness.spaces.length &&
      !rounds.darkness.tokenPrefabs.length,
    'Ordine, timer, oscurità o aritmetica della battaglia non attestati.',
  );
  invariant(
    cap.globals.defaults[rounds.bindings.round] === 1 &&
      cap.globals.defaults[rounds.bindings.threat] === 0 &&
      cap.globals.defaults[cap.enemyPointsBinding] === 0 &&
      cap.globals.defaults[rounds.bindings.darkness] === false &&
      cap.globals.defaults[rounds.bindings.darknessOverride] === '',
    'Reset della scena diverso dai default fonte.',
  );
  invariant(
    digest(cap.thresholds.map((t) => t.perHero)) === digest([3, 6, 8, 11]) &&
      cap.instances.length === definitions.length &&
      cap.certificates.length === definitions.length &&
      cap.instances.filter((i) => i.role === 'principal').length === 1 &&
      cap.instances.filter((i) => i.role === 'threshold').length === 4 &&
      cap.instances.filter((i) => i.role === 'logic').length === 3,
    'Inventario completo dei receiver della fase assente.',
  );
  const principal = definitions.find((d) => d.source === departure.target.principal),
    terminal = ScenarioDefinitionSchema.parse(base.terminal.definition),
    failure = AdventureFailureCapabilitySchema.parse(base.terminal.failure);
  const globalTypes = new Map(
    ScenarioPackSchema.shape.globals.parse(base.terminal.globals).map((v) => [v.name, v.type]),
  );
  for (const [name, value] of Object.entries(cap.globals.defaults))
    globalTypes.set(
      name,
      typeof value === 'number' ? 'int' : typeof value === 'boolean' ? 'bool' : 'string',
    );
  globalTypes.set(cap.playerCountBinding, 'int');
  for (const d of definitions) {
    const locals = new Map(d.variables.map((v) => [v.name, v.type]));
    const ref = (r: { scope: 'local' | 'global'; name: string }, type: string) =>
      invariant(
        (r.scope === 'global' ? globalTypes : locals).get(r.name) === type,
        'Binding della fase assente o di tipo diverso.',
      );
    const int = (
      v:
        | { kind: 'literal'; value: number }
        | { kind: 'variable'; ref: { scope: 'local' | 'global'; name: string } },
    ) => {
      if (v.kind === 'variable') ref(v.ref, 'int');
    };
    for (const s of d.states)
      for (const a of s.actions) {
        if (a.op === 'set') {
          ref(a.target, typeof a.value === 'boolean' ? 'bool' : 'int');
          invariant(
            a.target.scope !== 'global' ||
              a.target.name !== rounds.bindings.darknessOverride ||
              a.value === '',
            'Override oscurità non eseguibile.',
          );
        } else if (a.op === 'branchBool' || a.op === 'whenTrue') ref(a.ref, 'bool');
        else if (a.op === 'sourceInt') {
          ref(a.target, 'int');
          invariant(
            definitions
              .find((d) => d.source === a.definition)
              ?.variables.some((v) => v.name === a.name && v.type === 'int'),
            'GetFsmInt privo del proprio owner fonte.',
          );
        } else if (a.op === 'battleReady') ref(a.target, 'bool');
        else if (a.op === 'addInt' || a.op === 'copyInt') {
          ref(a.target, 'int');
          int(a.value);
        } else if (
          a.op === 'sumInt' ||
          a.op === 'multiplyInt' ||
          a.op === 'subtractInt' ||
          a.op === 'divideInt'
        ) {
          ref(a.target, 'int');
          int(a.left);
          int(a.right);
          if (a.op === 'divideInt')
            invariant(
              a.right.kind === 'literal' && a.right.value === 2,
              'Divisione diversa dalla quantità fonte attestata.',
            );
        } else if (a.op === 'compareInt') {
          int(a.left);
          int(a.right);
        } else if (a.op === 'battleThreat') {
          int(a.value);
          invariant(
            cap.thresholds.some((t) => t.source === a.source),
            'Registrazione estranea alla fase.',
          );
        } else if (a.op === 'challenge')
          invariant(
            a.stat === 'agility' &&
              'kind' in a.sum &&
              a.sum.kind === 'literal' &&
              a.sum.value === 0,
            'Prova della logica diversa dalla fonte.',
          );
        else if (a.op === 'message' && a.battlePlacement)
          invariant(
            combat.source.scriptedGroups?.some(
              (r) => r.key === a.battlePlacement && r.sourceGroup !== null,
            ),
            'Piazzamento privo del proprio preset.',
          );
      }
  }
  invariant(
    principal &&
      principal.handlers[failure.event] === terminal.handlers[failure.event] &&
      principal.handlers[cap.victoryEvent] !== undefined &&
      principal.handlers[rounds.events.start] === undefined &&
      principal.handlers[rounds.events.end] === undefined &&
      principal.variables.some((v) => v.name === cap.principalThresholdBinding && v.type === 'int'),
    'Principal privo dei receiver o dei binding fonte.',
  );
  for (const state of terminal.states)
    invariant(
      digest(principal.states.find((s) => s.index === state.index)) === digest(state),
      'Ricevitore terminale storico alterato.',
    );
  for (const old of departure.deployment.assets) {
    const next = cap.deployment.assets.find((a) => a.source === old.source);
    invariant(next && digest(next) === digest(old), 'Asset deployment storico sostituito.');
  }
  for (const old of base.combat.source.assets) {
    const next = combat.source.assets.find((a) => a.source === old.source);
    invariant(next && digest(next) === digest(old), 'Asset combattimento storico sostituito.');
  }
  for (const asset of combat.source.assets.filter(
    (a) => a.cls === 'EnemyModel' || a.cls === 'EnemyBonusModel',
  )) {
    const raw = cap.deployment.assets.find((a) => a.source === asset.source);
    invariant(
      asset.cls !== 'EnemyModel' || raw?.cls === 'EnemyModel',
      'Modello della fase fuori dai prodotti congelati.',
    );
    invariant(
      !raw || (raw.objectHash === asset.objectHash && raw.dataHash === asset.dataHash),
      'Modello o bonus del seguito diverso dalla primaria deployment.',
    );
  }
  for (const key of ['items', 'definitions', 'clauses', 'heroes', 'additions'] as const) {
    const original = base.combat.source[key];
    invariant(
      key === 'additions' || digest(combat.source[key]) === digest(original),
      'Compagnia delle fasi diversa dalla partenza congelata.',
    );
    invariant(
      original.every((v) => combat.source[key].some((next) => digest(next) === digest(v))),
      'Clausola o conseguenza storica omessa o alterata.',
    );
  }
  invariant(
    cap.instances.some(
      (i) =>
        i.role === 'principal' &&
        i.source === cap.principal.source &&
        i.gameObject === cap.principal.gameObject &&
        i.objectHash === cap.principal.objectHash,
    ),
    'Owner del principal diverso dalla fonte congelata.',
  );
  for (const row of cap.instances) {
    const d = definitions.find((d) => d.source === row.source),
      certificate = cap.certificates.find(
        (c) => !!c && typeof c === 'object' && 'source' in c && c.source === row.source,
      );
    invariant(
      d && certificate && digest(certificate) === row.certificateHash,
      'Certificato del receiver assente o sostituito.',
    );
    invariant(
      typeof certificate === 'object' &&
        'objectHash' in certificate &&
        'lifecycleHash' in certificate &&
        certificate.objectHash === row.objectHash &&
        certificate.lifecycleHash === row.lifecycleHash,
      'Identità o lifecycle del receiver alterati.',
    );
    invariant(
      d.states.find((s) => s.index === d.initial)?.actions.every((a) => a.op === 'release') &&
        !d.deferredHandlers?.[rounds.events.start] &&
        !d.deferredHandlers?.[rounds.events.end] &&
        !d.deferredHandlers?.[cap.thresholdEvent],
      'Initialization o handler obbligatorio della fase non eseguibile.',
    );
    invariant(
      d.handlers[rounds.events.start] === undefined && d.handlers[rounds.events.end] === undefined,
      'Receiver ROUND_START/ROUND_END diverso dalla chiusura A2 attestata.',
    );
    if (row.role === 'logic')
      invariant(
        d.handlers.DEFEATED !== undefined &&
          !d.deferredHandlers?.DEFEATED &&
          d.handlers.TRY_DEFEAT === undefined &&
          !d.deferredHandlers?.TRY_DEFEAT &&
          d.handlers[shadow.beforeUnexhaust] === undefined &&
          !d.deferredHandlers?.[shadow.beforeUnexhaust],
        'Logica nemica priva della chiusura DEFEATED/BEFORE_UNEXHAUST.',
      );
    const pending = [
        d.initial,
        ...(row.role === 'principal'
          ? [d.handlers[failure.event]!, d.handlers[cap.victoryEvent]!]
          : [d.handlers[row.role === 'logic' ? 'DEFEATED' : cap.thresholdEvent]!]),
      ],
      seen = new Set<number>();
    while (pending.length) {
      const index = pending.pop()!;
      if (seen.has(index)) continue;
      seen.add(index);
      const state = d.states.find((s) => s.index === index);
      invariant(state, 'Stato obbligatorio della fase assente.');
      const product = state.actions.find((a) => a.op === 'ownsProducts');
      if (product?.op === 'ownsProducts') {
        const owned = product.products.every((source) => {
          const model = cap.productModels.find((p) => p.source === source);
          invariant(model, 'Identità del prodotto della fase assente.');
          return departure.ownedProductIds.some((id) => id === model.id);
        });
        const event = owned ? product.ownEvent : product.missingEvent;
        invariant(
          state.transitions[event] !== undefined &&
            !state.deferredTransitions?.[event] &&
            Object.keys(state.deferredTransitions ?? {}).every(
              (e) => e === (owned ? product.missingEvent : product.ownEvent),
            ),
          'Prodotto senza ramo fonte eseguibile.',
        );
        pending.push(state.transitions[event]!);
      } else {
        invariant(
          !Object.keys(state.deferredTransitions ?? {}).length,
          'Chiusura obbligatoria della fase incompleta.',
        );
        pending.push(...Object.values(state.transitions));
      }
    }
  }
  const recipes = combat.source.scriptedGroups ?? [],
    logic = cap.instances.filter((i) => i.role === 'logic');
  invariant(
    recipes.length === 3 &&
      recipes.every(
        (r, n) =>
          r.logic === logic[n]?.source && r.baseStats.length === 1 && r.bonuses.length === 2,
      ) &&
      base.combat.source.models.includes(recipes[0]!.model) &&
      recipes[1]!.model === recipes[2]!.model &&
      !base.combat.source.models.includes(recipes[1]!.model) &&
      digest(combat.source.models) === digest([...base.combat.source.models, recipes[1]!.model]),
    'Modelli o ricette del seguito nominato incompleti.',
  );
  const firstModel = combat.source.assets.find((a) => a.source === recipes[0]!.model)!.data,
    namedModel = combat.source.assets.find((a) => a.source === recipes[1]!.model)!.data;
  invariant(
    recipes.every((r) =>
      r.bonuses.every((ref) => {
        const d = combat.source.assets.find((a) => a.source === ref)!.data;
        return [d.Health, d.Armor, d.Sorcery].every(Number.isSafeInteger);
      }),
    ),
    'Statistiche dei bonus espliciti non attestate.',
  );
  invariant(
    recipes[0]!.sourceGroup === null &&
      recipes[1]!.sourceGroup &&
      recipes[2]!.sourceGroup &&
      namedModel.IsUnique &&
      digest(recipes[0]!.baseStats) ===
        digest([
          {
            health: Number(firstModel.Health),
            armor: Number(firstModel.Armor),
            sorcery: Number(firstModel.Sorcery),
          },
        ]),
    'Statistiche del gruppo generato o preset nominati non attestati.',
  );
  invariant(
    combat.source.models.every((source) => {
      const d = combat.source.assets.find((a) => a.source === source)!.data;
      const has = (key: unknown) =>
        typeof cap.deployment.texts[String(key)] === 'string' ||
        combat.source.texts.some((t) => t.key === key);
      return has(d.KeySingular) && (Number(d.MaxUnitCount) === 1 || has(d.KeyPlural));
    }),
    'Nomi della popolazione combattimento incompleti.',
  );
  for (const ref of new Set(recipes.flatMap((r) => r.bonuses))) {
    const data = combat.source.assets.find((a) => a.source === ref)!.data;
    invariant(
      [data.KeyName, data.KeyDescription].every(
        (key) =>
          typeof cap.deployment.texts[String(key)] === 'string' ||
          combat.source.texts.some((t) => t.key === key),
      ),
      'Presentazione dei bonus espliciti incompleta.',
    );
  }
  const board = verifyBattleMapArtifact(departure.board),
    layout = board.compiled.layouts.find((l) => l.id === board.compiled.selectedAlternative)!;
  invariant(
    cap.points.length === 5 &&
      cap.nodes.length === 2 &&
      cap.nodes.some((n) => n.kind === 'search') &&
      cap.nodes.some((n) => n.kind === 'threat') &&
      cap.points.every((q) =>
        layout.patches.some(
          (p) =>
            p.cell === q.cell &&
            q.position[0] >= p.bounds[0][0] - 0.00001 &&
            q.position[0] <= p.bounds[0][1] + 0.00001 &&
            q.position[1] >= p.bounds[1][0] - 0.00001 &&
            q.position[1] <= p.bounds[1][1] + 0.00001,
        ),
      ),
    'Punti o nodi della fase fuori dalla geometria fonte.',
  );
  for (const threshold of cap.thresholds)
    invariant(
      cap.instances.some(
        (i) =>
          i.role === 'threshold' &&
          i.source === threshold.definition &&
          i.gameObject === threshold.owner,
      ) &&
        definitions.find((d) => d.source === threshold.definition)?.handlers[cap.thresholdEvent] !==
          undefined,
      'Soglia senza il proprio receiver completo.',
    );
  for (const [plan, spawn] of cap.spawns.entries()) {
    const a = definitions
      .find((d) => d.source === spawn.origin.definition)
      ?.states.find((s) => s.index === spawn.origin.state)
      ?.actions.find((a) => a.index === spawn.origin.action);
    invariant(
      a?.op === 'battleSpawn' &&
        a.plan === plan &&
        a.origin.parameterHash === spawn.origin.parameterHash,
      'Piano spawn non legato alla propria azione fonte.',
    );
    if (spawn.kind === 'points')
      invariant(
        spawn.points.every((p) => cap.points.some((q) => q.source === p.source)),
        'Punto spawn fuori dalla fonte.',
      );
    else
      invariant(
        combat.source.scriptedGroups?.some((g) => g.key === spawn.recipe) &&
          (spawn.kind === 'fixed' ? spawn.pose === 'source-point' : spawn.pose !== 'source-point'),
        'Gruppo nominato privo della ricetta fonte.',
      );
  }
  invariant(
    digest(
      cap.spawns.filter((p) => p.kind === 'points').map((p) => p.points.map((q) => q.perHero)),
    ) ===
      digest([
        [0, 1],
        [0, 1],
        [8, 8],
      ]),
    'Budget dei punti diverso dalle tre onde fonte.',
  );
  invariant(
    cap.spawns.filter((p) => p.kind === 'points').length === 3 &&
      cap.spawns.filter((p) => p.kind === 'fixed').length === 1 &&
      cap.spawns.filter((p) => p.kind === 'tracker').length === 3,
    'Inventario spawn della fase incompleto.',
  );
  invariant(
    definitions
      .flatMap((d) => d.states.flatMap((s) => s.actions))
      .filter((a) => a.op === 'battleSpawn').length === cap.spawns.length,
    'Azioni spawn omesse dal contratto.',
  );
  SourceTextSchema.parse(cap.deploymentText);
  invariant(
    digest(cap.heroIds) === digest(combat.source.heroes.map((h) => h.heroId)),
    'Eroi delle fasi diversi dalla compagnia congelata.',
  );
  invariant(
    !cap.productModels.some(
      (p, n) => cap.productModels.findIndex((q) => q.source === p.source || q.id === p.id) !== n,
    ),
    'Prodotti delle fasi duplicati.',
  );
  return { cap, rounds, definitions, deployment, combat };
}

/** Exact prospective pack, reconstructed from the archived departure on every replay. */
export function battleRoundsPack(departure: CampDepartureCapability, base?: ScenarioPack) {
  const checked = validateBattleRoundsSource(departure),
    { cap, rounds, definitions, deployment, combat } = checked,
    legacy = battleCombatPack(
      departure,
      base ??
        ScenarioPackSchema.parse({
          formatVersion: 1,
          algorithm: 'source-startup-ir-v1',
          identity: {
            adventureId: 2,
            adventureSource: departure.target.model,
            language: 'Italian',
          },
          name: departure.target.name,
          principal: departure.target.principal,
          timers: [],
          sources: combat.source.files,
          globals: [],
          definitions: [departure.combat!.terminal.definition],
          manifest: { scope: 'battle-combat-v1', prefabs: [], evidenceHash: cap.evidenceHash },
        }),
    );
  const globals = new Map(legacy.globals.map((v) => [v.name, v]));
  for (const [name, value] of Object.entries(cap.globals.defaults))
    globals.set(name, {
      name,
      type: typeof value === 'boolean' ? 'bool' : typeof value === 'number' ? 'int' : 'string',
      value,
    });
  globals.set(cap.playerCountBinding, {
    name: cap.playerCountBinding,
    type: 'int',
    value: cap.heroIds.length,
  });
  const pack = ScenarioPackSchema.parse({
    ...legacy,
    sources: combat.source.files,
    globals: [...globals.values()],
    definitions,
    timers: cap.timers,
    manifest: {
      ...legacy.manifest,
      rounds,
      combat,
      followup: {
        version: 'source-battle-followup-v1',
        projectionFingerprint: departure.boardFingerprint,
        evidenceHash: cap.evidenceHash,
        playerCountBinding: cap.playerCountBinding,
        enemyPointsBinding: cap.enemyPointsBinding,
        thresholdEvent: cap.thresholdEvent,
        instances: cap.instances
          .filter((i) => i.role !== 'principal')
          .map((i) => ({
            gameObject: i.gameObject,
            definition: i.source,
            kind: i.role === 'logic' ? 'logic' : 'threat',
            hasNode: false,
            lifecycleHash: i.lifecycleHash,
            initializationHash: digest({
              definition: i.source,
              initial: definitions.find((d) => d.source === i.source)!.initial,
              variables: definitions.find((d) => d.source === i.source)!.variables,
              actions: definitions
                .find((d) => d.source === i.source)!
                .states.find(
                  (s) => s.index === definitions.find((d) => d.source === i.source)!.initial,
                )!.actions,
            }),
          })),
        thresholds: cap.thresholds.map((t) => ({ source: t.source, definition: t.definition })),
        deployment,
        deploymentText: cap.deploymentText,
        explorationNodes: [],
        explorationText: { single: [], plural: [] },
      },
    },
  });
  return validateBattleRoundCertificates({
    pack,
    certificates: cap.certificates,
    roundsCertificate: { instructionHash: digest(rounds) },
    followupCertificate: { instructionHash: digest(pack.manifest.followup) },
    shadowCertificate: { instructionHash: digest(combat.source.shadow) },
    failureCertificate: { instructionHash: digest(pack.manifest.failure) },
  }).pack;
}
