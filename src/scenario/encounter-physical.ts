import type { State } from '../server/state';
import type { ScenarioAction } from '../shared/scenario';
import type { PhysicalProgram } from '../shared/physical';
import type { SourceEffect } from './source-cursor';
import { openPhysical } from '../physical-resolution/runtime';
import { cycleUUID } from '../physical-resolution/cycle-request';
import { digest } from '../map-freeze/hash';
import { invariant } from '../map-freeze/validate';
import { syncPhysicalDefeat } from '../server/physical-defeat';

/** Resolve actor and parameters from the source frame, never from a physical input. */
export function encounterProgram(state: State, action: ScenarioAction): PhysicalProgram {
  const sc = state.scenario!,
    p = state.physical!,
    attempt = sc.play!.attempts.find((a) => a.id === sc.play!.active)!;
  invariant(attempt, 'Istruzione incontro senza attore del padre.');
  const hero = p.heroes.findIndex((h) => h.heroId === attempt.heroId);
  invariant(hero >= 0, 'Attore incontro fuori compagnia.');
  let children: Extract<PhysicalProgram, { profile: 'source-fronts-v1' }>['children'];
  if (action.op === 'confirm') {
    const node = sc.instances.find((i) => i.id === attempt.instanceId)!;
    const prefab = sc.pack.manifest.prefabs.find((m) => m.source === node.prefab)!;
    children = [
      {
        kind: 'event',
        hero,
        event: 'before-interact',
        threat: prefab.nodeType === 'threat',
        sufferedFear: 0,
      },
    ];
  } else if (action.op === 'sourceTest' || action.op === 'challenge')
    children = [
      {
        kind: 'test',
        hero,
        stat: action.stat,
        target: action.op === 'sourceTest' ? action.target : null,
      },
    ];
  else if (action.op === 'message' && action.inspiration)
    children = [{ kind: 'inspiration', hero, amount: action.inspiration }];
  else {
    invariant(action.op === 'message' && action.consequence, 'Conseguenza senza Message fonte.');
    const c = action.consequence;
    children = [
      {
        kind: 'suffer',
        hero,
        face: c.face,
        cards: [{ family: c.family, amount: c.amount }],
        prevention: [],
      },
    ];
  }
  invariant(state.mapGeneration?.status === 'frozen', 'Incontro senza realizzazione.');
  const projection = state.mapGeneration.projection;
  const darknessHeroes = p.heroes.flatMap((h, n) => {
    const position = state.journey!.heroes.find((j) => j.heroId === h.heroId)!;
    const source = sc.spaceBindings.find((b) => b.id === position.spaceId)!.sourceId;
    return projection.spaces.find((s) => s.id === source)!.hasDarkness ? [n] : [];
  });
  return {
    profile: 'source-fronts-v1',
    initialCredits: p.heroes.map(() => 0),
    limits: p.heroes.map(() => ({ kind: 'requires-capability', capability: 'source-derived' })),
    darknessHeroes,
    children,
  };
}
export function groupTrialProgram(
  state: State,
  a: Extract<ScenarioAction, { op: 'spawnRandom' }>,
): PhysicalProgram {
  invariant(a.trial, 'Spawn senza prova fonte.');
  return {
    profile: 'source-fronts-v1',
    initialCredits: state.physical!.heroes.map(() => 0),
    limits: state.physical!.heroes.map(() => ({
      kind: 'requires-capability',
      capability: 'source-derived',
    })),
    darknessHeroes: [],
    children: [
      { kind: 'group-test', hero: 0, heroes: state.physical!.heroes.map((_, n) => n), ...a.trial },
    ],
  };
}
export function openSourcePhysical(
  state: State,
  effect: SourceEffect,
  action: ScenarioAction,
  program: PhysicalProgram,
) {
  const p = state.physical!,
    sc = state.scenario!;
  invariant(
    p?.fronts && p.lastStand && p.version === 3,
    'Capacità fisiche originali non congelate.',
  );
  const resources = p.snapshot.resolution!.resources;
  if (resources)
    invariant(
      digest(resources.preparation) === digest(state.preparation),
      'Risorse incontro discontinue.',
    );
  const context = resources
    ? structuredClone(resources)
    : { preparation: structuredClone(state.preparation!), depletion: [], boons: [] };
  const spatial = {
    heroes: p.heroes.map((h) => ({
      ...h,
      spaceId: state.journey!.heroes.find((j) => j.heroId === h.heroId)!.spaceId,
    })),
    connections: structuredClone(state.journey!.definition.connections),
  };
  const ledger = p.cycle;
  delete p.cycle;
  let parentId: string;
  try {
    parentId = openPhysical(
      p,
      {
        effectId: effect.id,
        instanceId: effect.instanceId,
        state: effect.state,
        entry: effect.entry,
        action: effect.action,
        parameterHash: action.origin.parameterHash,
      },
      program,
      context,
      spatial,
      cycleUUID({ scenario: sc.id, effect: effect.id }),
    );
  } finally {
    if (ledger) p.cycle = ledger;
  }
  state.preparation = structuredClone(p.snapshot.resolution!.resources!.preparation);
  syncPhysicalDefeat(state);
  return parentId;
}
export function beginEncounterPhysical(state: State, effect: SourceEffect, action: ScenarioAction) {
  invariant(state.scenario!.play?.active, 'Incontro senza padre.');
  const parentId = openSourcePhysical(state, effect, action, encounterProgram(state, action));
  state.scenario!.tasks.push({
    kind: 'physical',
    instanceId: effect.instanceId,
    entry: effect.entry,
    action: effect.action,
    parentId,
  });
}
