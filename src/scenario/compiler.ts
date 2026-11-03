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
});
/** Compiles an audited source subset. Uncompiled edges are explicit capability boundaries. */
export function compileScenarioPack(raw: unknown) {
  const input = CompilationSchema.parse(raw),
    { pack, certificates } = input;
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
      invariant(
        digest(source.actions) ===
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
