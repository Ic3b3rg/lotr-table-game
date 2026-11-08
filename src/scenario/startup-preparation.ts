import type { State } from '../server/state';
import type { ScenarioPack } from '../shared/scenario';
import type { FrontArtifact } from '../physical-resolution/front-program';
import type { PhysicalProgram } from '../shared/physical';
import type { PhysicalState } from '../physical-resolution/model';
import type { Preparation } from '../shared/preparation';
import { definitionId } from '../shared/preparation';
import { cycleUUID } from '../physical-resolution/cycle-request';
import { openPhysical } from '../physical-resolution/runtime';
import { syncPhysicalDefeat } from '../server/physical-defeat';
import { sourceCursor, type SourceEffect } from './source-cursor';
import { digest } from '../map-freeze/hash';
import { invariant } from '../map-freeze/validate';

/** The attestation is prospective: a legacy policy alone never enables a trigger. */
export function validateStartupPreparationSource(
  pack: ScenarioPack,
  catalog: State['content'],
  artifact?: FrontArtifact,
) {
  if (!pack.manifest.startupPreparation) return;
  validateStartupPreparationMaterials(pack, catalog ? digest(catalog) : undefined, artifact);
}

/** Bind the same preparation policy before a future episode has a live State. */
export function validateStartupPreparationMaterials(
  pack: ScenarioPack,
  catalogHash: string | undefined,
  artifact?: FrontArtifact,
) {
  const cap = pack.manifest.startupPreparation;
  if (!cap) return;
  invariant(
    catalogHash &&
      artifact &&
      cap.catalogHash === catalogHash &&
      cap.frontsFingerprint === artifact.fingerprint,
    'Preparazione iniziale senza catalogo e artifact corrispondenti.',
  );
  for (const legacy of pack.preparedEffects ?? []) {
    const policy = artifact.policies.find((p) => p.kind === 'skill' && p.id === legacy.skillId);
    invariant(
      policy?.definitionHash === legacy.cardHash &&
        (legacy.effect === 'inspiration'
          ? policy.effects.some((e) => e.op === 'after-prepare-inspiration')
          : legacy.capability === 'faceup-fear-flip' &&
            policy.effects.some((e) => e.op === 'after-prepare-flip-fear')),
      'Policy di preparazione senza executor attestato.',
    );
  }
}

type Run = PhysicalState['runs'][number];
type Children = Extract<PhysicalProgram, { profile: 'source-fronts-v1' }>['children'];
const initialSource = (pack: ScenarioPack) => ({
  effectId: 'startup:initial',
  instanceId: 'startup-preparation',
  state: 0,
  entry: 0,
  action: 0,
  parameterHash: digest(pack.manifest.startupPreparation),
});
function program(state: State, children: Children): PhysicalProgram {
  return {
    profile: 'source-fronts-v1',
    startupRules: 'source-startup-preparation-v1',
    immediateSkillReset: true,
    initialCredits: state.preparation!.heroes.map(() => 0),
    limits: state.preparation!.heroes.map(() => ({
      kind: 'requires-capability',
      capability: 'source-derived',
    })),
    darknessHeroes: [],
    children,
  };
}
function initialProgram(state: State, preparation: Preparation) {
  return program(
    state,
    preparation.heroes.flatMap((h, hero) => [
      ...(state.scenario!.journeyStartup
        ? [{ kind: 'battle-equipment' as const, hero, window: 'initialize' as const }]
        : []),
      ...h.prepared.map((copy) => ({ kind: 'prepared' as const, hero, copy })),
    ]),
  );
}
function sync(state: State) {
  state.preparation = structuredClone(state.physical!.snapshot.resolution!.resources!.preparation);
  syncPhysicalDefeat(state);
}
export function initializeStartupPreparation(state: State) {
  const sc = state.scenario!,
    p = state.physical;
  if (!sc.pack.manifest.startupPreparation) return false;
  invariant(p?.fronts && !p.runs.length, 'Preparazione iniziale senza origine fisica.');
  openPhysical(
    p,
    initialSource(sc.pack),
    initialProgram(state, state.preparation!),
    {
      preparation: structuredClone(state.preparation!),
      depletion: [],
      boons: [],
      ...(sc.journeyStartup
        ? {
            itemCustody: state.preparation!.episode!.heroes.flatMap((h) =>
              h.accessory
                ? [
                    {
                      ...sc.journeyStartup!.campaign.ownership.inventory.find(
                        (i) => i.copy === h.accessory,
                      )!,
                      heroId: h.heroId,
                      source: 'camp-departure' as const,
                    },
                  ]
                : [],
            ),
          }
        : {}),
    },
    undefined,
    sc.journeyStartup ? cycleUUID({ scenario: sc.id, initial: true }) : undefined,
  );
  // A fresh company has no physical fear to select. This never acknowledges an effect.
  invariant(
    sc.journeyStartup || (!p.snapshot.active && p.snapshot.parents[0]!.returnCount === 1),
    'Preparazione iniziale non conclusa.',
  );
  sync(state);
  return true;
}
export function startupService(state: State, effect: SourceEffect, heroId: string) {
  const { action } = sourceCursor(state, effect);
  invariant(
    state.scenario!.pack.manifest.startupPreparation &&
      action.op === 'message' &&
      (action.mode === 'scout' || action.mode === 'spirit'),
    'Servizio iniziale senza fonte.',
  );
  const hero = state.preparation!.heroes.findIndex((h) => h.heroId === heroId);
  invariant(hero >= 0, 'Servizio iniziale senza eroe.');
  return {
    source: {
      effectId: `${effect.id}:startup:${heroId}`,
      instanceId: effect.instanceId,
      state: effect.state,
      entry: effect.entry,
      action: effect.action,
      parameterHash: digest({
        capability: state.scenario!.pack.manifest.startupPreparation,
        parameters: action.origin.parameterHash,
        mode: action.mode,
        heroId,
      }),
    },
    program: program(state, [
      action.mode === 'scout'
        ? {
            kind: 'startup-scout',
            hero,
            ...(action.scoutCount ? { count: action.scoutCount } : {}),
          }
        : { kind: 'startup-test', hero },
    ]),
  };
}
export function beginStartupService(state: State, effect: SourceEffect) {
  const sc = state.scenario!,
    p = state.physical!,
    { action } = sourceCursor(state, effect);
  invariant(action.op === 'message', 'Setup senza messaggio.');
  const kind = action.mode === 'scout' ? 'scout' : 'test';
  const hero = state.preparation!.heroes.find(
    (h) =>
      !sc.completedSetup.some(
        (c) => c.source === effect.id && c.heroId === h.heroId && c.kind === kind,
      ),
  );
  invariant(
    hero && !state.scout && state.skillTest?.status !== 'converting',
    'Setup senza prossimo eroe.',
  );
  const service = startupService(state, effect, hero.heroId);
  const context = p.snapshot.resolution!.resources!;
  invariant(
    digest(context.preparation) === digest(state.preparation),
    'Risorse startup discontinue.',
  );
  const parentId = openPhysical(
    p,
    service.source,
    service.program,
    structuredClone(context),
    undefined,
    sc.journeyStartup ? cycleUUID({ scenario: sc.id, source: service.source }) : undefined,
  );
  sync(state);
  sc.tasks.push({
    kind: 'startup',
    instanceId: effect.instanceId,
    entry: effect.entry,
    action: effect.action,
    parentId,
    heroId: hero.heroId,
  });
}
export function startupRuns(state: State, effect: SourceEffect) {
  return state.physical!.runs.filter(
    (r) =>
      r.program.profile === 'source-fronts-v1' &&
      r.program.startupRules &&
      r.source.instanceId === effect.instanceId &&
      r.source.entry === effect.entry &&
      r.source.action === effect.action,
  );
}
export function startupCompletion(state: State, effect: SourceEffect, run: Run) {
  const parent = state.physical!.snapshot.parents.find((p) => p.id === run.id)!;
  const result = parent.results[0],
    setup = result?.setup;
  invariant(
    parent.status === 'completed' && parent.returnCount === 1 && setup && run.answers.length,
    'Completamento setup prima del ritorno fisico.',
  );
  return {
    kind: result.kind === 'startup-scout' ? ('scout' as const) : ('test' as const),
    heroId: result.heroId,
    source: effect.id,
    requestId: run.answers.at(-1)!.evidence.pendingId,
    serviceId: run.id,
    ...structuredClone(setup),
  };
}

/** Derive every startup parent, completion and continuation from the frozen source. */
export function validateStartupPreparation(state: State) {
  const sc = state.scenario!,
    p = state.physical;
  if (!sc.pack.manifest.startupPreparation) {
    invariant(
      !sc.tasks.some((t) => t.kind === 'startup') &&
        !(p?.runs ?? []).some(
          (r) =>
            r.source.instanceId === 'startup-preparation' ||
            (r.program.profile === 'source-fronts-v1' && r.program.startupRules),
        ),
      'Preparazione iniziale in un pack storico.',
    );
    return;
  }
  validateStartupPreparationSource(sc.pack, state.content, p?.fronts?.artifact);
  const initial = p?.runs[0],
    origin = initial?.context?.preparation;
  invariant(
    initial &&
      origin &&
      digest(initial.source) === digest(initialSource(sc.pack)) &&
      digest(initial.program) === digest(initialProgram(state, origin)) &&
      !initial.answers.length &&
      p!.snapshot.parents[0]?.returnCount === 1 &&
      !sc.cardEffects?.length,
    'Origine dei trigger iniziali modificata.',
  );
  invariant(
    origin.heroes.every(
      (h) =>
        h.prepared.length === 1 &&
        definitionId(h.prepared[0]!) ===
          state.content!.roles.find((r) => r.id === h.roleId)!.skills[0],
    ) &&
      digest(origin.heroes.map((h) => ({ heroId: h.heroId, value: h.inspiration }))) ===
        digest(sc.initialInspiration),
    'Preparazione iniziale non derivata dalla Compagnia pronta.',
  );
  const ordered = [initial.id];
  for (const effect of sc.effects) {
    const { action, completed } = sourceCursor(state, effect);
    if (action.op === 'physical') {
      const run = p!.runs.find((r) => r.source.effectId === effect.id);
      invariant(run, 'Fonte fisica senza padre.');
      ordered.push(run.id);
    }
    if (action.op !== 'message' || !['scout', 'spirit'].includes(action.mode)) continue;
    const runs = startupRuns(state, effect),
      completions = sc.completedSetup.filter((c) => c.source === effect.id);
    invariant(
      runs.length === completions.length + (completed ? 0 : 1) &&
        (completed
          ? completions.length === origin.heroes.length
          : completions.length < origin.heroes.length),
      'Padri iniziali mancanti o duplicati.',
    );
    for (const [n, run] of runs.entries()) {
      const hero = origin.heroes[n];
      invariant(hero, 'Padre iniziale fuori ordine.');
      const expected = startupService(state, effect, hero.heroId),
        parent = p!.snapshot.parents.find((p) => p.id === run.id)!;
      invariant(
        digest(run.source) === digest(expected.source) &&
          digest(run.program) === digest(expected.program) &&
          !run.spatial &&
          n < completions.length === (parent.status === 'completed') &&
          parent.returnCount === (n < completions.length ? 1 : 0),
        'Programma o ritorno setup diverso dalla fonte.',
      );
      if (n < completions.length)
        invariant(
          digest(completions[n]) === digest(startupCompletion(state, effect, run)),
          'Esito setup non ricostruito dal padre.',
        );
      else
        invariant(
          sc.tasks.some(
            (t) =>
              t.kind === 'startup' &&
              t.parentId === run.id &&
              t.heroId === hero.heroId &&
              t.instanceId === effect.instanceId &&
              t.entry === effect.entry &&
              t.action === effect.action,
          ),
          'Padre setup senza continuazione.',
        );
      ordered.push(run.id);
    }
  }
  invariant(
    digest(ordered) ===
      digest(p!.runs.filter((r) => r.source.instanceId !== 'ordinary-cycle').map((r) => r.id)),
    'Ordine dei padri fisici diverso dalla fonte startup.',
  );
}
