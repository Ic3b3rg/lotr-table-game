import type { State } from '../server/state';
import { boonEnemyPositions } from '../server/physical-spatial';
import type { ScenarioAction } from '../shared/scenario';
import type { PhysicalProgram } from '../shared/physical';
import type { SourceEffect } from './source-cursor';
import { openPhysical } from '../physical-resolution/runtime';
import { cycleUUID } from '../physical-resolution/cycle-request';
import { digest } from '../map-freeze/hash';
import { invariant } from '../map-freeze/validate';
import { sourceDarknessHeroes } from './darkness';
import { syncPhysicalDefeat } from '../server/physical-defeat';
import { liveGroupRules } from './live-groups';

/** Resolve actor and parameters from the source frame, never from a physical input. */
export function encounterProgram(state: State, action: ScenarioAction): PhysicalProgram {
  const sc = state.scenario!,
    p = state.physical!,
    attempt = sc.play!.attempts.find((a) => a.id === sc.play!.active)!;
  invariant(attempt, 'Istruzione incontro senza attore del padre.');
  const hero = p.heroes.findIndex((h) => h.heroId === attempt.heroId);
  invariant(hero >= 0, 'Attore incontro fuori compagnia.');
  let children: Extract<PhysicalProgram, { profile: 'source-fronts-v1' }>['children'];
  if (action.op === 'confirm' || action.op === 'choice') {
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
  } else if (action.op === 'addItem') {
    const cap = sc.pack.manifest.items;
    invariant(cap && cap.grant.model.source === action.itemModel, 'Oggetto senza capacità fonte.');
    children = [
      {
        kind: 'scenario-item',
        hero,
        grant: cap.grant,
        message: action.text.map((t) => (t.kind === 'text' ? t.text : 'accessorio')).join(''),
      },
    ];
  } else if (action.op === 'awardTitle') {
    const owner = sc.instances.find((i) => i.id === attempt.instanceId)!;
    const recipient = (action.recipient.scope === 'local' ? owner.variables : sc.globals)[
      action.recipient.name
    ];
    invariant(
      typeof recipient === 'number' &&
        Number.isInteger(recipient) &&
        recipient >= 0 &&
        recipient < p.heroes.length,
      'Destinatario titolo senza indice fonte valido.',
    );
    invariant(sc.pack.manifest.linked, 'Titolo senza capacità congelata.');
    children = [{ kind: 'scenario-title', hero: recipient, grant: sc.pack.manifest.linked.title }];
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
  else if (action.op === 'message' && action.boon)
    children = [{ kind: 'source-boon', hero, boon: action.boon }];
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
    ...liveGroupRules(state),
    initialCredits: p.heroes.map(() => 0),
    limits: p.heroes.map(() => ({ kind: 'requires-capability', capability: 'source-derived' })),
    darknessHeroes: sc.pack.manifest.threatContinuations
      ? sourceDarknessHeroes(state)
      : darknessHeroes,
    children,
  };
}
export function spawnPhysicalProgram(
  state: State,
  a: Extract<ScenarioAction, { op: 'spawnRandom' }>,
): PhysicalProgram {
  invariant(!!a.trial !== !!a.suffering, 'Spawn senza singola conseguenza fonte.');
  return {
    profile: 'source-fronts-v1',
    ...liveGroupRules(state),
    initialCredits: state.physical!.heroes.map(() => 0),
    limits: state.physical!.heroes.map(() => ({
      kind: 'requires-capability',
      capability: 'source-derived',
    })),
    darknessHeroes: a.suffering ? sourceDarknessHeroes(state) : [],
    children: [
      a.suffering
        ? {
            kind: 'group-suffer',
            hero: 0,
            heroes: state.physical!.heroes.map((_, n) => n),
            ...a.suffering,
          }
        : {
            kind: 'group-test',
            hero: 0,
            heroes: state.physical!.heroes.map((_, n) => n),
            ...a.trial!,
          },
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
    ...boonEnemyPositions(state),
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
