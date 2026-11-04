import { BoonArtifactSchema, BoonInputSchema, type BoonArtifact } from '../shared/boons';
import { BoonKindSchema } from '../shared/combat';
import { parsePhysicalPack, cardFacts } from '../physical-content/model';
import { boundPhysicalInput, validatePhysicalPack } from '../physical-content/validation';
import { requirePhysicalFamily } from '../physical-content/catalog';
import { digest } from '../map-freeze/hash';
import { invariant } from '../map-freeze/validate';

function freeze<T>(v: T): T {
  if (v && typeof v === 'object') {
    for (const child of Object.values(v)) freeze(child);
    Object.freeze(v);
  }
  return v;
}

/** Structural compiler. Source authenticity is checked by the separate private oracle. */
export function compileBoons(raw: unknown, input: unknown): BoonArtifact {
  boundPhysicalInput(raw);
  boundPhysicalInput(input);
  const pack = parsePhysicalPack(raw);
  validatePhysicalPack(pack);
  const ir = BoonInputSchema.parse(input);
  const cards = pack.cards.filter((c) => c.family === 'boon');
  invariant(cards.length === 3, 'Definizioni beneficio incomplete.');
  invariant(
    new Set(ir.definitions.map((d) => d.kind)).size === 3 &&
      new Set(ir.definitions.map((d) => d.cardId)).size === 3,
    'Tipi o definizioni beneficio duplicati.',
  );
  invariant(
    ir.rules.every((r) => pack.sources.some((s) => s.id === r.sourceId)) &&
      new Set(ir.rules.map(digest)).size === ir.rules.length,
    'Regole senza fonte o duplicate.',
  );
  const definitions = ir.definitions.map((d) => {
    const c = cards.find((c) => c.id === d.cardId);
    invariant(
      c && cardFacts(c).every(([field, f]) => field === 'quantity' || f.status === 'verified'),
      'Regole beneficio non interamente verificate.',
    );
    invariant(
      d.cardHash === digest(c) &&
        d.originalHash === digest(c.text.original) &&
        d.mechanicsHash === digest(c.mechanics) &&
        d.usageHash === digest(c.usage) &&
        digest(d.source) === digest(c.text.original?.reference ?? c.text.evidence[0]),
      'Programma beneficio non legato ai campi originali.',
    );
    invariant(
      c.usage.value.acquire === 'supply' &&
        c.usage.value.initialFace === 'faceup' &&
        !c.usage.value.requiresPrepared &&
        c.usage.value.prepareOnGain === 'not-applicable' &&
        c.usage.value.ownership === 'adventure',
      'Custodia beneficio incompatibile.',
    );
    invariant(
      new Set(d.effects.map((e) => e.op)).size === d.effects.length,
      'Finestre beneficio duplicate.',
    );
    invariant(
      d.effects.length === c.mechanics.timing.value.length,
      'Finestre beneficio non interamente coperte dal programma.',
    );
    const effects = d.effects.map((e) => {
      if (e.op === 'add-hits' || e.op === 'add-success') {
        const n = c.mechanics.values.value[e.valueIndex]?.value;
        invariant(
          typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 56,
          'Valore beneficio senza campo numerico attestato.',
        );
        return { op: e.op, n };
      }
      if (e.op === 'discard-on-suffer')
        invariant(
          new Set(e.families).size === e.families.length &&
            e.families.every((f) => c.mechanics.symbols.value.includes(f)),
          'Famiglie senza simboli attestati.',
        );
      if (e.op === 'prevent-all-before-test')
        invariant(
          c.mechanics.symbols.value.includes(e.family),
          'Prevenzione senza famiglia attestata.',
        );
      return e;
    });
    return { cardId: d.cardId, kind: d.kind, effects };
  });
  const verified = cards.every(
    (c) => c.quantity.status === 'verified' && c.quantity.value !== null,
  );
  if (verified) requirePhysicalFamily(raw, 'boon');
  const quantities = verified
    ? (Object.fromEntries(
        BoonKindSchema.options.map((kind) => {
          const d = ir.definitions.find((d) => d.kind === kind)!;
          return [kind, cards.find((c) => c.id === d.cardId)!.quantity.value!];
        }),
      ) as Record<zBoonKind, number>)
    : null;
  const compiled = {
    version: ir.version,
    input: ir,
    rawFingerprint: digest(raw),
    definitions,
    stock: {
      status: verified ? ('verified' as const) : ('unverified' as const),
      quantities,
      copies: verified
        ? ir.definitions.flatMap((d) =>
            cards.find((c) => c.id === d.cardId)!.copies.map((c) => ({ id: c.id, kind: d.kind })),
          )
        : [],
    },
    runtimeReady: verified,
  };
  return freeze(BoonArtifactSchema.parse({ ...compiled, fingerprint: digest(compiled) }));
}
type zBoonKind = BoonArtifact['definitions'][number]['kind'];

export function validateBoonArtifact(
  raw: unknown,
  artifact: unknown,
): asserts artifact is BoonArtifact {
  boundPhysicalInput(artifact);
  const a = BoonArtifactSchema.parse(artifact);
  invariant(digest(compileBoons(raw, a.input)) === digest(a), 'Artifact benefici modificato.');
}
