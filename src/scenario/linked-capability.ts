import type { ScenarioPack } from '../shared/scenario';
import { digest } from '../map-freeze/hash';
import { invariant } from '../map-freeze/validate';

export function linkedDefinition(pack: ScenarioPack, source: string) {
  return pack.manifest.linked?.encounters.some(
    (e) => pack.manifest.prefabs.find((p) => p.source === e.prefab)?.fsmSource === source,
  );
}

/** New permissions are local to two complete, attested definitions and their owners. */
export function validateLinkedCapability(pack: ScenarioPack) {
  const cap = pack.manifest.linked;
  const definitions = pack.definitions;
  const additions = definitions.flatMap((d) =>
    d.states.flatMap((s) =>
      s.actions
        .filter(
          (a) =>
            a.op === 'chooseHero' ||
            a.op === 'awardTitle' ||
            (a.op === 'choice' && a.options.some((o) => o.cost || o.requirement)),
        )
        .map((a) => ({ d, s, a })),
    ),
  );
  if (!cap) {
    invariant(!additions.length, 'Incontri collegati senza capacità congelata.');
    return;
  }
  invariant(
    pack.manifest.scope === 'original-encounter-v1' &&
      pack.manifest.failure &&
      cap.failureFingerprint === digest(pack.manifest.failure) &&
      cap.roundsFingerprint === digest(pack.manifest.rounds ?? null) &&
      Object.entries(cap.methods).every(
        ([name, m]) =>
          m.assemblyHash ===
          (name === 'sequence'
            ? pack.sources.find((s) => s.file === 'PlayMaker.dll')?.sha256
            : pack.manifest.failure!.methods.signal.assemblyHash),
      ),
    'Incontri collegati senza controller e owner corrispondenti.',
  );
  invariant(
    cap.encounters[0].prefab !== cap.encounters[1].prefab &&
      new Set(Object.values(cap.events)).size === 3 &&
      cap.title.titleModel.source !== cap.title.skillModel.source,
    'Identità degli incontri, eventi o modelli titolo ambigue.',
  );
  const pair = cap.encounters.map((e) => {
    const p = pack.manifest.prefabs.find((p) => p.source === e.prefab);
    const d = definitions.find((d) => d.source === p?.fsmSource);
    invariant(
      p &&
        d &&
        e.definitionHash === digest(d) &&
        !pack.manifest.playablePrefabs!.includes(p.source) &&
        !pack.manifest.clues?.encounters.includes(p.source) &&
        pack.manifest.clues?.fort.prefab !== p.source &&
        pack.manifest.lair?.prefab !== p.source &&
        !Object.keys(d.deferredHandlers).length &&
        d.states.every((s) => !Object.keys(s.deferredTransitions ?? {}).length),
      'Closure collegata incompleta o diversa dal freeze.',
    );
    return d;
  });
  const [visit, listener] = pair;
  invariant(
    visit !== listener &&
      visit!.handlers[cap.events.returned] !== undefined &&
      listener!.handlers[cap.events.reveal] !== undefined &&
      listener!.handlers.PRE_REVEAL !== undefined &&
      definitions.every((d) => Object.values(cap.events).every((e) => !d.deferredHandlers[e])),
    'Listener collegati o ritorni mancanti.',
  );
  const allowed = new Set([
    'confirm',
    'sourceTest',
    'choice',
    'message',
    'chooseHero',
    'awardTitle',
    'release',
    'stop',
    'set',
    'flip',
    'branchBool',
    'broadcast',
    'getTile',
    'getPosition',
    'isExplored',
    'focus',
    'revealNode',
    'hideNode',
    'addInt',
  ]);
  invariant(
    pair.every((d) => d!.states.every((s) => s.actions.every((a) => allowed.has(a.op)))),
    'Permesso di campagna estraneo alla closure collegata.',
  );
  for (const d of pair)
    for (const s of d!.states)
      for (const a of s.actions) {
        if (a.op === 'set' || a.op === 'flip')
          invariant(
            a.target.scope === 'local' &&
              d!.variables.some((v) => v.name === a.target.name && v.type === 'bool') &&
              (a.op !== 'set' || typeof a.value === 'boolean'),
            'Mutazione fuori dai binding locali collegati.',
          );
        if (a.op === 'broadcast')
          invariant(
            (d === visit
              ? [cap.events.searched, cap.events.reveal]
              : [cap.events.returned]
            ).includes(a.event),
            'Broadcast fuori dagli eventi collegati.',
          );
        if (a.op === 'addInt')
          invariant(
            d!.source === cap.threat.definition &&
              s.index === cap.threat.state &&
              a.index === cap.threat.action,
            'Mutazione intera fuori dal proprio owner collegato.',
          );
      }
  const choose = additions.filter(({ a }) => a.op === 'chooseHero');
  const awards = additions.filter(({ a }) => a.op === 'awardTitle');
  const commits = additions.filter(({ a }) => a.op === 'choice');
  invariant(
    choose.length === 1 &&
      awards.length === 1 &&
      commits.length === 1 &&
      additions.every(({ d }) => d === visit),
    'Premio o scelta fuori dal proprio owner collegato.',
  );
  const selected = choose[0]!,
    award = awards[0]!,
    commit = commits[0]!;
  invariant(selected.a.op === 'chooseHero' && award.a.op === 'awardTitle', 'Owner titolo errato.');
  const target = selected.a.target;
  invariant(
    selected.a.op === 'chooseHero' &&
      award.a.op === 'awardTitle' &&
      target.scope === 'local' &&
      visit!.variables.some((v) => v.name === target.name && v.type === 'int') &&
      digest(selected.a.target) === digest(award.a.recipient) &&
      award.a.titleModel === cap.title.titleModel.source &&
      selected.s.transitions.FINISHED === award.s.index,
    'Destinatario o titolo non legati alla scelta fonte.',
  );
  invariant(
    commit.a.op === 'choice' &&
      commit.a.options.length === 1 &&
      commit.a.cancel &&
      !commit.a.options.some(
        (o) =>
          !o.cost ||
          !o.requirement ||
          o.requirement.scope !== 'local' ||
          !visit!.variables.some((v) => v.name === o.requirement!.name && v.type === 'bool'),
      ),
    'Impegno condizionale senza costo e binding fonte.',
  );
  const t = cap.threat;
  const a = visit!.states
    .find((s) => s.index === t.state)
    ?.actions.find((a) => a.index === t.action);
  invariant(
    t.definition === visit!.source &&
      t.binding.scope === 'global' &&
      pack.globals.some((v) => v.name === t.binding.name && v.type === 'int') &&
      (!pack.manifest.rounds || pack.manifest.rounds.bindings.threat === t.binding.name) &&
      a?.op === 'addInt' &&
      digest(a.target) === digest(t.binding) &&
      a.value.kind === 'literal' &&
      a.value.value === t.delta,
    'Variazione minaccia fuori dal binding e owner attestati.',
  );
}
