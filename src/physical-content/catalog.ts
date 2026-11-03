import { cardFacts, EXPECTED, FAMILIES, parsePhysicalPack } from './model';
import type { DeepReadonly, PhysicalPack } from './model';
import { boundPhysicalInput, validatePhysicalPack } from './validation';

export { PHYSICAL_CONTENT_LIMITS } from './model';
export type { DeepReadonly, PhysicalCard, PhysicalPack } from './model';

type Diagnostic = { cardId: string | null; field: string; code: string; message: string };
type Coverage = {
  family: (typeof FAMILIES)[number];
  definitions: number;
  copies: number;
  expectedDefinitions: number;
  expectedCopies: number;
  complete: boolean;
};
type Result = {
  formatVersion: 1;
  coverage: Coverage[];
  diagnostics: Diagnostic[];
  anomalies: { cardId: string; field: string; message: string }[];
} & ({ status: 'verified'; catalog: PhysicalPack } | { status: 'diagnostic' });

function freeze<T>(value: T): DeepReadonly<T> {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value as DeepReadonly<T>;
}

function readPack(value: unknown): PhysicalPack {
  boundPhysicalInput(value);
  const pack = parsePhysicalPack(value);
  validatePhysicalPack(pack);
  return pack;
}

function assess(pack: PhysicalPack): Result {
  const diagnostics: Diagnostic[] = [];
  for (const c of pack.cards) {
    for (const [field, fact] of cardFacts(c)) {
      if (fact.status !== 'verified')
        diagnostics.push({ cardId: c.id, field, code: fact.status, message: fact.note });
    }
  }
  const coverage = FAMILIES.map((family) => {
    const cards = pack.cards.filter((c) => c.family === family);
    const definitions = cards.length;
    const copies = cards.reduce((n, c) => n + c.copies.length, 0);
    const expected = EXPECTED[family];
    const complete =
      definitions === expected.definitions &&
      copies === expected.copies &&
      !cards.some((c) => diagnostics.some((d) => d.cardId === c.id));
    if (definitions !== expected.definitions || copies !== expected.copies)
      diagnostics.push({
        cardId: null,
        field: family,
        code: 'coverage',
        message: `Attesi ${expected.definitions} definizioni/${expected.copies} copie; ricevuti ${definitions}/${copies}.`,
      });
    return {
      family,
      definitions,
      copies,
      expectedDefinitions: expected.definitions,
      expectedCopies: expected.copies,
      complete,
    };
  });
  const anomalies = pack.cards
    .filter((c) => c.binding.value?.skillStatus === 'absent-in-checked-base')
    .map((c) => ({ cardId: c.id, field: 'binding', message: c.binding.note }));
  const common = { formatVersion: 1 as const, coverage, diagnostics, anomalies };
  return diagnostics.length
    ? { ...common, status: 'diagnostic' as const }
    : { ...common, status: 'verified' as const, catalog: pack };
}

/** Validates submitted evidence, not source authenticity or execution semantics. */
export function inspectPhysicalContent(value: unknown): DeepReadonly<Result> {
  return freeze(assess(readPack(value)));
}

export function requirePhysicalCatalog(value: unknown): DeepReadonly<PhysicalPack> {
  const result = inspectPhysicalContent(value);
  if (result.status !== 'verified')
    throw new Error('Catalogo diagnostic: contenuto non completamente verificato.');
  return result.catalog;
}

/** A partial export has its own profile and cannot certify the complete pack. */
export function requirePhysicalFamily(value: unknown, family: string) {
  const selected = FAMILIES.find((f) => f === family);
  if (!selected) throw new Error('Famiglia fisica sconosciuta.');
  const pack = readPack(value);
  const result = assess(pack);
  if (!result.coverage.find((c) => c.family === selected)?.complete)
    throw new Error(`Famiglia ${selected} diagnostic: contenuto non completamente verificato.`);
  const cards = pack.cards.filter((c) => c.family === selected);
  const ids = new Set(cards.map((c) => c.id));
  return freeze({
    formatVersion: 1 as const,
    profile: 'base-physical-family-v1' as const,
    status: 'verified' as const,
    language: pack.language,
    family: selected,
    sources: pack.sources,
    cards,
    errata: pack.errata.filter((e) => ids.has(e.cardId)),
    anomalies: result.anomalies.filter((a) => ids.has(a.cardId)),
  });
}
