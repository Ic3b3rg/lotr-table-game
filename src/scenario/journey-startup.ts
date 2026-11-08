import type { State } from '../server/state';
import type { ScenarioRequest, SourceText } from '../shared/scenario';
import type { PhysicalProgram } from '../shared/physical';
import { openPhysical } from '../physical-resolution/runtime';
import { cycleUUID } from '../physical-resolution/cycle-request';
import { digest } from '../map-freeze/hash';
import { invariant } from '../map-freeze/validate';

type Request = (data: Omit<ScenarioRequest, 'id' | 'fingerprint'>) => void;
/** Shared physical kernel, with the source controller retaining its initial/final caller. */
export function journeyBoundaryRequest(state: State, request: Request) {
  const sc = state.scenario!,
    j = sc.journeyStartup!,
    p = state.physical!,
    active = p.snapshot.active;
  if (!active) return false;
  const principal = sc.instances.find((i) => i.kind === 'principal')!;
  const text: SourceText = [
    {
      kind: 'text',
      style: 'plain',
      text:
        j.stage === 'initial'
          ? 'Completa la preparazione del tuo eroe.'
          : 'Completa gli effetti dopo l’allestimento.',
    },
  ];
  request({
    instanceId: principal.id,
    state: principal.state,
    entry: principal.entry,
    action: -1,
    kind: 'physical',
    text,
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
  });
  return true;
}
export function startJourneyEquipment(state: State) {
  const sc = state.scenario!,
    j = sc.journeyStartup!,
    p = state.physical!;
  invariant(j.stage === 'principal', 'Allestimento viaggio3 ripetuto.');
  const source = {
    effectId: 'journey:after-setup',
    instanceId: 'journey-startup',
    state: 0,
    entry: 0,
    action: 0,
    parameterHash: digest({ source: j.sourceFingerprint, window: 'after-setup' }),
  };
  const program: PhysicalProgram = {
    profile: 'source-fronts-v1',
    startupRules: 'source-startup-preparation-v1',
    immediateSkillReset: true,
    initialCredits: p.heroes.map(() => 0),
    limits: p.heroes.map(() => ({ kind: 'requires-capability', capability: 'source-derived' })),
    darknessHeroes: [],
    children: p.heroes.map((_, hero) => ({
      kind: 'battle-equipment',
      hero,
      window: 'after-setup',
    })),
  };
  j.stage = 'after-setup';
  j.runId = openPhysical(
    p,
    source,
    program,
    structuredClone(p.snapshot.resolution!.resources!),
    undefined,
    cycleUUID({ scenario: sc.id, source }),
  );
  state.preparation = structuredClone(p.snapshot.resolution!.resources!.preparation);
}
