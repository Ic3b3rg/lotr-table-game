import { z } from 'zod';
import { HashSchema, SourceSchema } from '../shared/generated-map';
import { ScenarioPackSchema } from '../shared/scenario';
import { parseScenarioPack } from './pack';
import { digest } from '../map-freeze/hash';
import { invariant } from '../map-freeze/validate';
const index = z.int().nonnegative().max(10000),
  event = z.string().min(1).max(100);
const certificate = z.strictObject({
  source: SourceSchema,
  objectHash: HashSchema,
  lifecycleHash: HashSchema,
  initial: index,
  handlers: z.record(event, index),
  states: z
    .array(
      z.strictObject({
        index,
        transitions: z.record(event, index),
        actions: z
          .array(
            z.strictObject({
              index,
              type: z.string().min(1).max(200),
              parameterHash: HashSchema,
              enabled: z.literal(true),
              instructionHash: HashSchema.optional(),
            }),
          )
          .max(100),
      }),
    )
    .min(1)
    .max(100),
  deferredEdges: z
    .array(
      z.strictObject({
        from: index.nullable(),
        event,
        to: index,
        capability: z.string().min(1).max(100),
      }),
    )
    .max(1000),
});
const CompilationSchema = z.strictObject({
  pack: ScenarioPackSchema,
  certificates: z.array(certificate).min(1).max(600),
  roundsCertificate: z.strictObject({ instructionHash: HashSchema }).optional(),
  followupCertificate: z.strictObject({ instructionHash: HashSchema }).optional(),
  shadowCertificate: z.strictObject({ instructionHash: HashSchema }).optional(),
  cluesCertificate: z.strictObject({ instructionHash: HashSchema }).optional(),
  failureCertificate: z.strictObject({ instructionHash: HashSchema }).optional(),
  lairCertificate: z.strictObject({ instructionHash: HashSchema }).optional(),
  linkedCertificate: z.strictObject({ instructionHash: HashSchema }).optional(),
  itemsCertificate: z.strictObject({ instructionHash: HashSchema }).optional(),
  baseProductsCertificate: z.strictObject({ instructionHash: HashSchema }).optional(),
  threatContinuationsCertificate: z.strictObject({ instructionHash: HashSchema }).optional(),
  liveGroupsCertificate: z.strictObject({ instructionHash: HashSchema }).optional(),
});
/** Compiles an audited source subset. Uncompiled edges are explicit capability boundaries. */
export function compileScenarioPack(raw: unknown) {
  const input = CompilationSchema.parse(raw),
    { pack, certificates } = input;
  const items = pack.manifest.items;
  invariant(
    items ? input.itemsCertificate?.instructionHash === digest(items) : !input.itemsCertificate,
    'Inventario assente o non attestato.',
  );
  if (items) {
    const p = pack.manifest.prefabs.find((p) => p.source === items.prefab),
      c = certificates.find((c) => c.source === p?.fsmSource);
    invariant(
      c &&
        c.objectHash === items.sourceObjectHash &&
        c.lifecycleHash === items.lifecycleHash &&
        digest(c) === items.sourceCertificateHash &&
        c.states.length === 9 &&
        c.states.reduce((n, s) => n + s.actions.length, 0) === 10 &&
        !c.deferredEdges.length,
      'Closure inventario completa non attestata.',
    );
  }
  const base = pack.manifest.baseProducts;
  invariant(
    base
      ? input.baseProductsCertificate?.instructionHash === digest(base)
      : !input.baseProductsCertificate,
    'Input prodotti base assente o non attestato.',
  );
  if (base) {
    const p = pack.manifest.prefabs.find((p) => p.source === base.prefab),
      c = certificates.find((c) => c.source === p?.fsmSource),
      d = pack.definitions.find((d) => d.source === p?.fsmSource);
    invariant(
      c &&
        d &&
        c.objectHash === base.sourceObjectHash &&
        c.lifecycleHash === base.lifecycleHash &&
        digest(c) === base.sourceCertificateHash &&
        c.states.length === 14 &&
        c.states.reduce((n, s) => n + s.actions.length, 0) === 14 &&
        c.states.every(
          (s) => d.states.some((v) => v.index === s.index) || base.excludedStates.includes(s.index),
        ) &&
        c.deferredEdges.length === 1 &&
        c.deferredEdges[0]?.from === base.gate.state &&
        c.deferredEdges[0]?.to === base.gate.excludedTarget &&
        c.deferredEdges[0]?.capability === base.gate.capability,
      'Closure completa e ramo escluso non attestati.',
    );
  }
  invariant(
    pack.manifest.linked
      ? input.linkedCertificate?.instructionHash === digest(pack.manifest.linked)
      : !input.linkedCertificate,
    'Incontri collegati assenti o non attestati.',
  );
  invariant(
    pack.manifest.lair
      ? input.lairCertificate?.instructionHash === digest(pack.manifest.lair)
      : !input.lairCertificate,
    'Covo assente o non attestato.',
  );
  invariant(
    pack.manifest.liveGroups
      ? input.liveGroupsCertificate?.instructionHash === digest(pack.manifest.liveGroups)
      : !input.liveGroupsCertificate,
    'Gruppi attivi assenti o non attestati.',
  );
  invariant(
    pack.manifest.threatContinuations
      ? input.threatContinuationsCertificate?.instructionHash ===
          digest(pack.manifest.threatContinuations)
      : !input.threatContinuationsCertificate,
    'Continuazioni di minaccia assenti o non attestate.',
  );
  invariant(
    pack.manifest.failure
      ? input.failureCertificate?.instructionHash === digest(pack.manifest.failure)
      : !input.failureCertificate,
    'Conclusione assente o non attestata.',
  );
  invariant(
    pack.manifest.clues
      ? input.cluesCertificate?.instructionHash === digest(pack.manifest.clues)
      : !input.cluesCertificate,
    'Progressione degli indizi assente o non attestata.',
  );
  invariant(
    pack.manifest.combat?.source.shadow
      ? input.shadowCertificate?.instructionHash === digest(pack.manifest.combat.source.shadow)
      : !input.shadowCertificate,
    'Attivazioni non attestate o introdotte fuori dal freeze.',
  );
  invariant(
    pack.manifest.followup
      ? input.followupCertificate?.instructionHash === digest(pack.manifest.followup)
      : !input.followupCertificate,
    'Seguito della fase assente o non attestato.',
  );
  for (const row of pack.manifest.followup?.instances ?? []) {
    const c = certificates.find((c) => c.source === row.definition),
      d = pack.definitions.find((d) => d.source === row.definition);
    invariant(
      c &&
        d &&
        row.lifecycleHash === c.lifecycleHash &&
        row.initializationHash ===
          digest({
            definition: d.source,
            initial: d.initial,
            variables: d.variables,
            actions: d.states.find((s) => s.index === d.initial)!.actions,
          }),
      'Lifecycle statico non attestato.',
    );
  }
  invariant(
    pack.manifest.rounds
      ? input.roundsCertificate?.instructionHash === digest(pack.manifest.rounds)
      : !input.roundsCertificate,
    'Fonte della fase assente o non attestata.',
  );
  invariant(
    new Set(certificates.map((c) => c.source)).size === certificates.length,
    'Certificati duplicati.',
  );
  invariant(certificates.length === pack.definitions.length, 'Closure certificata incompleta.');
  for (const d of pack.definitions) {
    const c = certificates.find((c) => c.source === d.source);
    invariant(c && c.initial === d.initial, 'Initialization non certificata.');
    const deferred = (from: number | null, event: string, to: number) =>
      c.deferredEdges.some((e) => e.from === from && e.event === event && e.to === to);
    d.deferredHandlers = Object.fromEntries(
      Object.entries(c.handlers)
        .filter(([event]) => d.handlers[event] === undefined)
        .map(([event, to]) => {
          const edge = c.deferredEdges.find(
            (e) => e.from === null && e.event === event && e.to === to,
          );
          invariant(edge, 'Handler non compilato senza gate.');
          return [event, edge.capability];
        }),
    );
    invariant(
      Object.entries(d.handlers).every(([event, to]) => c.handlers[event] === to),
      'Handler senza fonte.',
    );
    for (const [event, to] of Object.entries(c.handlers))
      invariant(
        d.handlers[event] === to || deferred(null, event, to),
        'Handler fonte omesso senza gate.',
      );
    for (const s of d.states) {
      const source = c.states.find((v) => v.index === s.index);
      invariant(source, 'Stato senza fonte.');
      const deferredTransitions = Object.fromEntries(
        Object.entries(source.transitions)
          .filter(([event]) => s.transitions[event] === undefined)
          .map(([event, to]) => {
            const edge = c.deferredEdges.find(
              (e) => e.from === s.index && e.event === event && e.to === to,
            );
            invariant(edge, 'Transizione omessa senza gate.');
            return [event, edge.capability];
          }),
      );
      if (Object.keys(s.deferredTransitions ?? {}).length || pack.manifest.rounds)
        invariant(
          digest(s.deferredTransitions ?? {}) === digest(deferredTransitions),
          'Confine condizionale non corrispondente alla fonte.',
        );
      invariant(
        digest(source.actions.map(({ instructionHash: _, ...a }) => a)) ===
          digest(
            s.actions.map((a) => ({
              index: a.index,
              type: a.origin.type,
              parameterHash: a.origin.parameterHash,
              enabled: true,
            })),
          ),
        'Azioni omesse/alterate rispetto alla fonte.',
      );
      if (pack.manifest.scope === 'original-encounter-v1')
        invariant(
          s.actions.every(
            (a) => source.actions.find((x) => x.index === a.index)?.instructionHash === digest(a),
          ),
          'Istruzione non attestata dai campi fonte.',
        );
      invariant(
        Object.entries(s.transitions).every(([e, to]) => source.transitions[e] === to),
        'Transizione non certificata.',
      );
      for (const [e, to] of Object.entries(source.transitions))
        invariant(
          s.transitions[e] === to || deferred(s.index, e, to),
          'Transizione omessa senza gate.',
        );
    }
    // Fresh prefab entry must settle before BeginAdventure without a popup or coroutine.
    const seen = new Set<number>();
    let s = d.states.find((s) => s.index === d.initial)!;
    while (true) {
      invariant(s && !seen.has(s.index), 'Initialization ciclica o incompleta.');
      seen.add(s.index);
      invariant(
        s.actions.every((a) =>
          [
            'getStart',
            'getTile',
            'getPosition',
            'set',
            'flip',
            'addInt',
            'release',
            'stop',
          ].includes(a.op),
        ),
        'Initialization richiede una capacità asincrona non certificata.',
      );
      const next = s.transitions.FINISHED;
      if (next === undefined || s.actions.some((a) => a.op === 'stop')) break;
      s = d.states.find((s) => s.index === next)!;
    }
  }
  const usedEvents = new Set(
    pack.definitions.flatMap((d) =>
      d.states.flatMap((s) => s.actions.flatMap((a) => (a.op === 'broadcast' ? [a.event] : []))),
    ),
  );
  for (const e of usedEvents)
    for (const c of certificates)
      if (c.handlers[e] !== undefined)
        invariant(
          pack.definitions.find((d) => d.source === c.source)!.handlers[e] === c.handlers[e],
          'Broadcast con ricevitore non compilato, anche se nascosto.',
        );
  const compiled = { ...pack, manifest: { ...pack.manifest, evidenceHash: digest(certificates) } };
  return {
    ...parseScenarioPack(compiled),
    coverage: {
      definitions: pack.definitions.length,
      states: pack.definitions.reduce((n, d) => n + d.states.length, 0),
      actions: pack.definitions.reduce(
        (n, d) => n + d.states.reduce((m, s) => m + s.actions.length, 0),
        0,
      ),
      deferredEdges: certificates.reduce((n, c) => n + c.deferredEdges.length, 0),
    },
  };
}
