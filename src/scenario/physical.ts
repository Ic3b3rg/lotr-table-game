import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
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
import { sourceCursor, type SourceEffect } from './source-cursor';

export function needsPhysical(pack: ScenarioPack) {
  return pack.definitions.some((d) =>
    d.states.some((s) => s.actions.some((a) => a.op === 'physical')),
  );
}
export function loadPhysicalSource(path: string) {
  invariant(statSync(path).size <= PHYSICAL_CONTENT_LIMITS.bytes, 'Raw fisico troppo grande.');
  const bytes = readFileSync(path),
    raw: unknown = JSON.parse(bytes.toString('utf8'));
  physicalFamilies(raw);
  return { raw, rawSha256: createHash('sha256').update(bytes).digest('hex') };
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
      state.journey &&
      sc.completedSetup.length === state.preparation!.heroes.length * 2 &&
      !state.scout &&
      state.skillTest?.status !== 'converting',
    'La prova fisica richiede lo startup fonte completato.',
  );
  validatePhysicalProgram(action.program, state.preparation!.heroes.length);
  const parentId = openPhysical(state.physical, physicalOrigin(effect, action), action.program);
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
  const { action } = sourceCursor(state, effect);
  invariant(action.op === 'physical', 'Richiesta fisica senza programma.');
  return {
    instanceId: effect.instanceId,
    state: effect.state,
    entry: effect.entry,
    action: effect.action,
    kind: 'physical',
    text: action.text,
    heroId: active.actorHeroId,
    actorPlayerId: active.actorPlayerId,
    stage: 'ready',
    tileSource: null,
    physical: {
      parentId: active.runId,
      child: active.child,
      grant: active.kind === 'prevent' ? active.grant : null,
    },
  };
}
export function answerScenarioPhysical(
  state: State,
  playerId: string,
  command: Extract<import('../shared/protocol').ScenarioCommand, { type: 'SCENARIO_INPUT' }>,
) {
  const p = state.physical,
    q = state.scenario!.pending;
  if (
    !p ||
    !q?.physical ||
    (command.input.kind !== 'physical-prevent' && command.input.kind !== 'physical-discard')
  )
    throw new ApiError(
      409,
      'PHYSICAL_INPUT_REQUIRED',
      'Completa l’allocazione richiesta. Una conferma non risolve questa conseguenza.',
    );
  if (p.snapshot.active?.kind === 'gate')
    throw new ApiError(
      409,
      'PHYSICAL_CAPABILITY',
      'Questa conseguenza resta sospesa: la capacità richiesta non è ancora disponibile.',
    );
  try {
    answerPhysical(p, q.physical.parentId, command.input, {
      playerId,
      requestId: command.requestId,
      pendingId: q.id,
      sourceFingerprint: q.fingerprint,
      revision: state.revision + 1,
    });
  } catch {
    throw new ApiError(
      409,
      'PHYSICAL_ALLOCATION',
      'L’allocazione non rispetta quantità residue, budget o destinatario della richiesta. Nessuna carta o costo è cambiato.',
    );
  }
  state.scenario!.pending = null;
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
  invariant(
    digest(p.binding) ===
      digest({
        scenarioId: sc.id,
        packFingerprint: sc.packFingerprint,
        projectionFingerprint: sc.projectionFingerprint,
      }),
    'Binding fisico cambiato.',
  );
  const spaceId =
    state.journey?.definition.startSpaceId ??
    sc.spaceBindings.find((b) => b.id === p.heroes[0]?.spaceId)?.id;
  invariant(
    digest(p.heroes) ===
      digest(
        state.preparation!.heroes.map((h) => ({ heroId: h.heroId, playerId: h.playerId, spaceId })),
      ),
    'Proprietà/posizione iniziale fisica cambiata.',
  );
  const effects = sc.effects.filter((e) => e.op === 'physical');
  invariant(p.runs.length === effects.length, 'Padri fisici non riconciliati con le entry fonte.');
  effects.forEach((effect, n) => {
    const { action, completed } = sourceCursor(state, effect),
      run = p.runs[n]!,
      parent = p.snapshot.parents[n]!;
    invariant(
      action.op === 'physical' &&
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
  if (p.snapshot.active) {
    const q = sc.pending,
      active = p.snapshot.active;
    const effect = effects.find(
      (e) => p.runs.find((r) => r.source.effectId === e.id)?.id === active.runId,
    );
    invariant(q && effect, 'Figlio fisico senza richiesta corrente.');
    const { id, fingerprint, ...data } = q;
    invariant(
      digest(data) === digest(physicalRequestData(state, effect, active)),
      'Richiesta fisica non legata a figlio, actor e destinatario.',
    );
  } else invariant(sc.pending?.kind !== 'physical', 'Richiesta fisica dopo il ritorno.');
}

export function physicalHistory(state: State, effect: SourceEffect) {
  const p = state.physical!,
    run = p.runs.find((r) => r.source.effectId === effect.id)!;
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
    const effect = sc.effects.find((e) => e.id === run.source.effectId)!;
    for (const [n, history] of physicalHistory(state, effect).entries()) {
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
