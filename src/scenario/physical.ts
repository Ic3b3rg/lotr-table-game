import { dirname, join } from 'node:path';
import { validatePhysicalCycle } from '../server/physical-cycle';
import { FrontArtifactSchema } from '../physical-resolution/front-program';
import { BoonArtifactSchema } from '../shared/boons';
import { validateBoonArtifact } from '../physical-resolution/boon-program';
import {
  LastStandArtifactSchema,
  validateLastStandArtifact,
} from '../physical-resolution/last-stand-program';
import { syncPhysicalDefeat, validatePhysicalDefeat } from '../server/physical-defeat';
import { preparationProblem } from '../shared/preparation';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import type { State } from '../server/state';
import type { Scenario, ScenarioAction, ScenarioPack, ScenarioRequest } from '../shared/scenario';
import type { PhysicalActive } from '../shared/physical';
import { PHYSICAL_CONTENT_LIMITS } from '../physical-content/model';
import {
  answerPhysical,
  freezePhysical,
  openPhysical,
  physicalFamilies,
  validatePhysical,
  validatePhysicalProgram,
} from '../physical-resolution/runtime';
import { digest } from '../map-freeze/hash';
import { invariant } from '../map-freeze/validate';
import { ApiError } from '../server/errors';
import { validateScenarioTitle } from '../physical-resolution/scenario-title';
import { linkedDefinition } from './linked-capability';
import { firstCombatDefinition } from './first-combat';
import { boonEnemyPositions } from '../server/physical-spatial';
import { sourceCursor, type SourceEffect } from './source-cursor';
import {
  validateStartupPreparationSource,
  validateStartupPreparation,
} from './startup-preparation';

export function needsPhysical(pack: ScenarioPack) {
  return (
    !!pack.manifest.startupPreparation ||
    !!pack.manifest.boons ||
    pack.manifest.scope === 'original-encounter-v1' ||
    pack.definitions.some((d) => d.states.some((s) => s.actions.some((a) => a.op === 'physical')))
  );
}
export function requireLinkedTitle(pack: ScenarioPack, raw: unknown) {
  if (!pack.manifest.linked) return;
  try {
    validateScenarioTitle(raw, pack.manifest.linked.title);
  } catch {
    throw new ApiError(
      409,
      'SCENARIO_TITLE_CAPABILITY',
      'Il titolo richiesto dalla fonte non ha carta, copia e binding verificati corrispondenti. Nessun costo è stato applicato.',
    );
  }
}
export function loadPhysicalSource(path: string) {
  invariant(statSync(path).size <= PHYSICAL_CONTENT_LIMITS.bytes, 'Raw fisico troppo grande.');
  const bytes = readFileSync(path),
    raw: unknown = JSON.parse(bytes.toString('utf8'));
  physicalFamilies(raw);
  const frontPath = join(dirname(path), 'physical-fronts.json');
  if (existsSync(frontPath))
    invariant(
      statSync(frontPath).size <= PHYSICAL_CONTENT_LIMITS.bytes,
      'Artifact fronti troppo grande.',
    );
  const fronts = existsSync(frontPath)
    ? FrontArtifactSchema.parse(JSON.parse(readFileSync(frontPath, 'utf8')))
    : undefined;
  const lastStandPath = join(dirname(path), 'physical-last-stand.json');
  const lastStand = existsSync(lastStandPath) ? loadLastStandSource(path, raw) : undefined;
  const boonPath = join(dirname(path), 'physical-boons.json');
  let boons;
  if (existsSync(boonPath)) {
    invariant(
      statSync(boonPath).size <= PHYSICAL_CONTENT_LIMITS.bytes,
      'Artifact benefici troppo grande.',
    );
    boons = BoonArtifactSchema.parse(JSON.parse(readFileSync(boonPath, 'utf8')));
    validateBoonArtifact(raw, boons);
  }
  return {
    raw,
    rawSha256: createHash('sha256').update(bytes).digest('hex'),
    fronts,
    lastStand,
    boons,
  };
}
export function loadLastStandSource(path: string, raw: unknown) {
  const artifactPath = join(dirname(path), 'physical-last-stand.json');
  try {
    invariant(
      statSync(artifactPath).size <= PHYSICAL_CONTENT_LIMITS.bytes,
      'Artifact Ultimo Sforzo troppo grande.',
    );
    const artifact = LastStandArtifactSchema.parse(JSON.parse(readFileSync(artifactPath, 'utf8')));
    validateLastStandArtifact(raw, artifact);
    return artifact;
  } catch {
    throw new ApiError(
      409,
      'LAST_STAND_SOURCE_REQUIRED',
      'Le istruzioni verificate di Ultimo Sforzo non sono disponibili o non corrispondono. La continuazione resta salvata.',
    );
  }
}
export function initializeScenarioPhysical(
  state: State,
  startSpaceId: string,
  source?: ReturnType<typeof loadPhysicalSource>,
) {
  if (!needsPhysical(state.scenario!.pack)) {
    invariant(!state.physical, 'Consumer fisico senza fonte.');
    return;
  }
  invariant(source && !state.physical, 'Materiale fisico assente o inizializzazione duplicata.');
  const sc = state.scenario!;
  validateStartupPreparationSource(sc.pack, state.content, source.fronts);
  requireLinkedTitle(sc.pack, source.raw);
  if (sc.pack.manifest.boons && source.boons?.fingerprint !== sc.pack.manifest.boons.fingerprint)
    throw new ApiError(
      409,
      'BOON_SOURCE_REQUIRED',
      'Le regole verificate dei benefici non sono disponibili per questo avvio. Occorrono i dati corrispondenti prima di iniziare.',
    );
  state.physical = freezePhysical(
    source.raw,
    {
      scenarioId: sc.id,
      packFingerprint: sc.packFingerprint,
      projectionFingerprint: sc.projectionFingerprint,
    },
    state.preparation!.heroes.map((h) => ({
      heroId: h.heroId,
      playerId: h.playerId,
      spaceId: startSpaceId,
    })),
    undefined,
    source.rawSha256,
    ['synthetic-physical-p1', 'original-encounter-v1'].includes(sc.pack.manifest.scope)
      ? { artifact: FrontArtifactSchema.parse(source.fronts), catalog: state.content! }
      : undefined,
    source.lastStand,
    sc.pack.manifest.boons ? source.boons : undefined,
  );
}
export function beginPhysicalAction(
  state: State,
  effect: SourceEffect,
  action: Extract<ScenarioAction, { op: 'physical' }>,
) {
  const sc = state.scenario!;
  invariant(
    state.physical &&
      ((state.journey && sc.completedSetup.length === state.preparation!.heroes.length * 2) ||
        (sc.phase === 'setup' && !!sc.pack.manifest.startupPreparation)) &&
      !state.scout &&
      state.skillTest?.status !== 'converting',
    'La prova fisica richiede lo startup fonte completato.',
  );
  validatePhysicalProgram(action.program, state.preparation!.heroes.length);
  if (state.physical.boons && (sc.phase !== 'setup' || state.physical.cycle))
    throw new ApiError(
      409,
      'BOON_SOURCE_CONTEXT',
      'Questa fonte richiede un contesto spaziale ulteriore. La continuazione resta salvata prima degli effetti.',
    );
  const context =
    action.program.profile === 'source-fronts-v1'
      ? {
          preparation: structuredClone(state.preparation!),
          depletion: structuredClone(
            state.physical.snapshot.resolution?.resources?.depletion ?? [],
          ),
          boons: structuredClone(state.physical.snapshot.resolution?.resources?.boons ?? []),
          ...(state.physical.boons
            ? {
                boonCustody: structuredClone(
                  state.physical.snapshot.resolution?.resources?.boonCustody ?? [],
                ),
                ...(state.physical.snapshot.resolution?.resources?.combatUses
                  ? {
                      combatUses: structuredClone(
                        state.physical.snapshot.resolution.resources.combatUses,
                      ),
                    }
                  : {}),
              }
            : {}),
        }
      : undefined;
  const parentId = openPhysical(
    state.physical,
    physicalOrigin(effect, action),
    action.program,
    context,
    state.physical.boons && action.program.children.some((c) => c.kind === 'end-turn')
      ? {
          heroes: state.physical.heroes.map((h) => ({
            ...h,
            spaceId: state.journey!.heroes.find((j) => j.heroId === h.heroId)!.spaceId,
          })),
          connections: structuredClone(state.journey!.definition.connections),
          ...boonEnemyPositions(state),
        }
      : undefined,
  );
  syncPhysicalResources(state);
  sc.tasks.push({
    kind: 'physical',
    instanceId: effect.instanceId,
    entry: effect.entry,
    action: effect.action,
    parentId,
  });
}
function physicalOrigin(e: SourceEffect, a: Extract<ScenarioAction, { op: 'physical' }>) {
  return {
    effectId: e.id,
    instanceId: e.instanceId,
    state: e.state,
    entry: e.entry,
    action: e.action,
    parameterHash: a.origin.parameterHash,
  };
}
export function physicalRequestData(
  state: State,
  effect: SourceEffect,
  active: PhysicalActive,
): Omit<ScenarioRequest, 'id' | 'fingerprint'> {
  const { action, instance } = sourceCursor(state, effect);
  invariant(
    action.op === 'physical' ||
      action.op === 'confirm' ||
      action.op === 'sourceTest' ||
      action.op === 'challenge' ||
      action.op === 'addItem' ||
      (action.op === 'awardTitle' && linkedDefinition(state.scenario!.pack, instance.definition)) ||
      (action.op === 'choice' &&
        (linkedDefinition(state.scenario!.pack, instance.definition) ||
          firstCombatDefinition(state.scenario!.pack, instance.definition))) ||
      (action.op === 'spawnRandom' && (action.trial || action.suffering)) ||
      (action.op === 'message' &&
        (action.consequence ||
          action.battleSuffering ||
          action.inspiration ||
          action.recovery ||
          (state.scenario!.pack.manifest.startupPreparation &&
            (action.mode === 'scout' || action.mode === 'spirit')))),
    'Richiesta fisica senza programma fonte.',
  );
  return {
    instanceId: effect.instanceId,
    state: effect.state,
    entry: effect.entry,
    action: effect.action,
    kind: 'physical',
    text:
      action.op === 'awardTitle'
        ? [
            {
              kind: 'text',
              style: 'plain',
              text: 'Titolo assegnato: completa l’istruzione qui sotto.',
            },
          ]
        : action.text,
    heroId: active.actorHeroId,
    actorPlayerId: active.actorPlayerId,
    stage: 'ready',
    tileSource: null,
    physical: {
      parentId: active.runId,
      ...(active.kind === 'decision' ? { cursor: active.cursor } : {}),
      child: active.child,
      grant: active.kind === 'prevent' ? active.grant : null,
    },
  };
}
export function answerScenarioPhysical(
  state: State,
  playerId: string,
  command: Extract<import('../shared/protocol').ScenarioCommand, { type: 'SCENARIO_INPUT' }>,
  physicalPath?: string,
) {
  const p = state.physical,
    q = state.scenario!.pending;
  if (!p || !q?.physical || !command.input.kind.startsWith('physical-'))
    throw new ApiError(
      409,
      'PHYSICAL_INPUT_REQUIRED',
      'Completa l’allocazione richiesta. Una conferma non risolve questa conseguenza.',
    );
  const continuing =
    command.input.kind === 'physical-continue-last-stand' &&
    p.version !== 1 &&
    p.snapshot.active?.kind === 'gate' &&
    p.snapshot.active.reason === 'last-stand-unavailable';
  if (p.snapshot.active?.kind === 'gate' && !continuing)
    throw new ApiError(
      409,
      'PHYSICAL_CAPABILITY',
      'Questa conseguenza resta sospesa: la capacità richiesta non è ancora disponibile.',
    );
  const lastStand =
    continuing && !p.lastStand ? loadLastStandSource(physicalPath!, p.raw) : undefined;
  try {
    answerPhysical(
      p,
      q.physical.parentId,
      command.input,
      {
        playerId,
        requestId: command.requestId,
        pendingId: q.id,
        sourceFingerprint: q.fingerprint,
        revision: state.revision + 1,
      },
      lastStand,
    );
  } catch {
    throw new ApiError(
      409,
      'PHYSICAL_ALLOCATION',
      'L’allocazione non rispetta quantità residue, budget o destinatario della richiesta. Nessuna carta o costo è cambiato.',
    );
  }
  syncPhysicalResources(state);
  state.scenario!.pending = null;
}

function syncPhysicalResources(state: State) {
  const resources = state.physical?.snapshot.resolution?.resources;
  if (resources) state.preparation = structuredClone(resources.preparation);
  syncPhysicalDefeat(state);
}

/** Reconstruct physical effects before accepting state, task flags or paired receipts. */
export function validateScenarioPhysical(state: State) {
  const sc = state.scenario!,
    p = state.physical;
  invariant(
    needsPhysical(sc.pack) === !!p,
    'Consumer fisico non corrispondente al programma congelato.',
  );
  if (!p) {
    invariant(
      !sc.pending?.physical &&
        sc.pending?.kind !== 'physical' &&
        !sc.tasks.some((t) => t.kind === 'physical'),
      'Richiesta fisica senza consumer.',
    );
    return;
  }
  validatePhysical(p);
  validateStartupPreparation(state);
  invariant(
    p.boons?.fingerprint === sc.pack.manifest.boons?.fingerprint,
    'Benefici non legati alla capacità congelata prima dello startup.',
  );
  if (p.lastStandActivation?.kind === 'legacy-continuation') {
    const id = p.lastStandActivation.runId;
    invariant(
      p.runs
        .find((r) => r.id === id)
        ?.answers.some((a) => a.input.kind === 'physical-continue-last-stand'),
      'Attivazione P2 senza risposta alla richiesta storica.',
    );
  }
  validatePhysicalDefeat(state);
  validatePhysicalCycle(state);
  invariant(
    (p.version !== 1) ===
      ['synthetic-physical-p1', 'original-encounter-v1'].includes(sc.pack.manifest.scope),
    'Profilo fronti diverso dalla fonte.',
  );
  if (p.version !== 1) {
    invariant(
      digest(p.fronts!.catalog) === digest(state.content),
      'Catalogo delle policy modificato.',
    );
    const initial = p.runs[0]?.context;
    if (initial)
      invariant(
        !preparationProblem(
          state.content!,
          state.players.map((p) => p.id),
          initial.preparation,
        ),
        'Risorse iniziali fisiche non valide.',
      );
    const resources = p.snapshot.resolution!.resources;
    if (resources)
      invariant(
        digest(resources.preparation) === digest(state.preparation),
        'Risorse non riconciliate con la risoluzione fisica.',
      );
  }
  invariant(
    digest(p.binding) ===
      digest({
        scenarioId: sc.id,
        packFingerprint: sc.packFingerprint,
        projectionFingerprint: sc.projectionFingerprint,
      }),
    'Binding fisico cambiato.',
  );
  invariant(state.mapGeneration?.status === 'frozen', 'Partecipanti fisici senza realizzazione.');
  const projection = state.mapGeneration.projection;
  const startTile = projection.sections.find((s) => s.id === 0)!.tiles[0]!.source;
  const startSource = projection.spaces.find((s) => s.tileSource === startTile && s.index === 1);
  const spaceId = sc.spaceBindings.find((b) => b.sourceId === startSource?.id)?.id;
  invariant(spaceId, 'Posizione iniziale fisica senza binding fonte.');
  invariant(
    digest(p.heroes) ===
      digest(
        state.preparation!.heroes.map((h) => ({ heroId: h.heroId, playerId: h.playerId, spaceId })),
      ),
    'Proprietà/posizione iniziale fisica cambiata.',
  );
  const effects = sc.effects.filter((e) => e.op === 'physical');
  const sourceRuns = p.runs.filter(
    (r) =>
      r.source.instanceId !== 'ordinary-cycle' &&
      !(r.program.profile === 'source-fronts-v1' && r.program.startupRules),
  );
  invariant(
    sourceRuns.length === effects.length,
    'Padri fisici non riconciliati con le entry fonte.',
  );
  effects.forEach((effect, n) => {
    const { action, completed } = sourceCursor(state, effect),
      run = sourceRuns[n]!,
      parent = p.snapshot.parents.find((p) => p.id === run.id)!;
    invariant(
      action.op === 'physical' &&
        (p.boons && action.program.children.some((c) => c.kind === 'end-turn')
          ? digest(run.spatial) ===
            digest({
              heroes: p.heroes,
              connections: state.journey!.definition.connections,
              enemies: [],
            })
          : !run.spatial) &&
        digest(run.source) === digest(physicalOrigin(effect, action)) &&
        digest(run.program) === digest(action.program),
      'Origine/programma fisico estranei alla fonte.',
    );
    invariant(
      completed === (parent.status === 'completed') && parent.returnCount === (completed ? 1 : 0),
      'Ritorno fisico saltato o duplicato.',
    );
    const task = sc.tasks.find(
      (t) =>
        t.instanceId === effect.instanceId &&
        t.entry === effect.entry &&
        t.action === effect.action,
    );
    invariant(
      completed ? !task : task?.kind === 'physical' && task.parentId === run.id,
      'Padre fisico senza continuazione fonte.',
    );
    for (const answer of run.answers) {
      const e = answer.evidence,
        c = sc.commands.find((c) => c.playerId === e.playerId && c.requestId === e.requestId);
      invariant(
        c &&
          c.pendingId === e.pendingId &&
          c.source === e.sourceFingerprint &&
          c.revision === e.revision &&
          c.kind === answer.input.kind,
        'Costo/scelta fisica senza ricevuta fonte.',
      );
    }
  });
  if (p.snapshot.active && !p.cycle?.pending) {
    const q = sc.pending,
      active = p.snapshot.active;
    const run = p.runs.find((r) => r.id === active.runId)!;
    const effect = sc.effects.find(
      (e) =>
        e.instanceId === run.source.instanceId &&
        e.entry === run.source.entry &&
        e.action === run.source.action,
    );
    invariant(q && effect, 'Figlio fisico senza richiesta corrente.');
    const { id, fingerprint, ...data } = q;
    invariant(
      digest(data) === digest(physicalRequestData(state, effect, active)),
      'Richiesta fisica non legata a figlio, actor e destinatario.',
    );
  } else invariant(sc.pending?.kind !== 'physical', 'Richiesta fisica dopo il ritorno.');
}

export function physicalHistory(
  state: State,
  effect: SourceEffect,
  selectedRun?: NonNullable<State['physical']>['runs'][number],
) {
  const p = state.physical!,
    run = selectedRun ?? p.runs.find((r) => r.source.effectId === effect.id)!;
  if (p.version !== 1)
    return p.snapshot
      .resolution!.history.filter((h) => h.runId === run.id)
      .map((h) => ({
        request: physicalRequestData(state, effect, h.active),
        kind: run.answers[h.answer]!.input.kind,
        evidence: run.answers[h.answer]!.evidence,
      }));
  return run.answers.map((answer) => {
    const child = run.program.children[answer.child]!,
      actorSlot = child.kind === 'suffer' ? child.prevention[answer.grant!]!.actor : child.hero;
    const actor = p.heroes[actorSlot]!;
    const active = {
      runId: run.id,
      child: answer.child,
      actorHeroId: actor.heroId,
      actorPlayerId: actor.playerId,
      heroId: p.heroes[child.hero]!.heroId,
      ...(answer.input.kind === 'physical-prevent'
        ? {
            kind: 'prevent' as const,
            grant: answer.grant!,
            authorizationId: '',
            budget: 0,
            creditCost: 0,
            remaining: { damage: 0, fear: 0 },
          }
        : {
            kind: 'discard' as const,
            count: 0,
            minimum: 0,
            available: { damage: 0, fear: 0 },
            families: ['damage' as const],
          }),
    };
    return {
      request: physicalRequestData(state, effect, active),
      kind: answer.input.kind,
      evidence: answer.evidence,
    };
  });
}
export function validatePhysicalReceipts(
  state: State,
  commands: { playerId: string; requestId: string; fingerprint?: string }[],
) {
  const sc = state.scenario!;
  for (const run of state.physical?.runs ?? []) {
    if (
      run.source.instanceId === 'ordinary-cycle' ||
      run.source.instanceId === 'startup-preparation'
    )
      continue;
    const effect = sc.effects.find(
      (e) =>
        e.instanceId === run.source.instanceId &&
        e.entry === run.source.entry &&
        e.action === run.source.action,
    )!;
    for (const [n, history] of physicalHistory(state, effect, run).entries()) {
      const answer = run.answers[n]!,
        e = answer.evidence;
      const command = commands.find(
        (c) => c.playerId === e.playerId && c.requestId === e.requestId,
      );
      const intent = {
        type: 'SCENARIO_INPUT',
        expectedRevision: e.revision - 1,
        scenarioId: sc.id,
        packFingerprint: sc.packFingerprint,
        projectionFingerprint: sc.projectionFingerprint,
        pendingId: e.pendingId,
        sourceFingerprint: e.sourceFingerprint,
        heroId: history.request.heroId,
        input: answer.input,
      };
      invariant(
        command?.fingerprint === createHash('sha256').update(JSON.stringify(intent)).digest('hex'),
        'Intento della ricevuta fisica diverso dalla scelta fonte.',
      );
    }
  }
}
