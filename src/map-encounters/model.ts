import { z } from 'zod';
import { ClockObservationSchema, InputError, parseAssemblyInput } from '../map-assembly/model';

const int32 = z.int().min(-2147483648).max(2147483647);
const source = z
  .string()
  .max(160)
  .regex(/^[\w.-]+:-?[1-9][0-9]*$/);
const sources = z.array(source).max(1000);
const f32 = z
  .number()
  .finite()
  .refine((n) => Math.fround(n) === n, 'Richiesto float32.');
const timeout = z.number().min(1).max(86400000);
const schema = z.strictObject({
  formatVersion: z.literal(1),
  algorithm: z.enum(['source-map-encounters-v1', 'source-map-encounters-A3-v1']),
  assembly: z.unknown(),
  placement: z.strictObject({
    formatVersion: z.literal(1),
    algorithm: z.enum([
      'source-encounter-placement-pack-v1',
      'source-encounter-placement-pack-A3-v1',
    ]),
    provenance: z.strictObject({
      sourceVersion: z.string().min(1).max(200),
      files: z
        .array(
          z.strictObject({
            file: z
              .string()
              .max(100)
              .regex(/^[\w.-]+$/),
            sha256: z.string().regex(/^[a-f0-9]{64}$/),
          }),
        )
        .min(1)
        .max(100),
    }),
    models: z
      .array(
        z.strictObject({
          index: z.int().min(0).max(10000),
          source,
          id: int32.min(0),
          nodeType: int32,
          requiredTraits: int32,
          excludedTraits: int32,
          specificTileModelSource: source.nullable(),
          specificSpaceIndex: int32,
          prefab: z.strictObject({
            path: z.string().min(1).max(1500),
            resourceKey: z.string().min(1).max(1500),
            source,
            targetClass: z.literal('GameObject'),
          }),
        }),
      )
      .max(10000),
    sections: z
      .array(
        z.strictObject({
          index: z.int().min(0).max(6),
          source,
          tileEncounters: z
            .array(
              z.strictObject({
                encounterSource: source,
                tileId: int32,
                specifySpaceIndex: z.boolean(),
                spaceIndex: int32,
              }),
            )
            .max(1000)
            .nullable(),
          sectionEncounterSources: sources.nullable(),
          randomFillPercent: f32,
        }),
      )
      .min(4)
      .max(7),
    adventureEncounterSources: sources.nullable(),
    specifiedGroupSource: source.nullable(),
  }),
  execution: z.strictObject({
    policy: z.literal('encounter-operations-v1'),
    maxOperations: z.int().min(1).max(10000000),
    maxTraceEvents: z.int().min(1).max(200000),
    clock: z.discriminatedUnion('policy', [
      z.strictObject({
        policy: z.literal('logical-clock-v1'),
        stepMilliseconds: z.number().min(0).max(100000),
        timeoutMilliseconds: timeout,
      }),
      z.strictObject({ policy: z.literal('monotonic-clock-v1'), timeoutMilliseconds: timeout }),
      z.strictObject({
        policy: z.literal('replay-clock-v1'),
        timeoutMilliseconds: timeout,
        observations: z
          .array(ClockObservationSchema.extend({ depth: z.int().min(0).max(10000) }))
          .max(200000),
      }),
    ]),
  }),
});

/** Metadata assertions, never catalog filtering or a caller-supplied checkpoint. */
export function parseEncounterInput(value: unknown) {
  const raw = schema.parse(value),
    assembly = parseAssemblyInput(raw.assembly);
  const p = raw.placement,
    selection = assembly.selection;
  const fail = (message: string): never => {
    throw new InputError(`Input: ${message}`);
  };
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const files = new Map(p.provenance.files.map((f) => [f.file, f.sha256]));
  if (files.size !== p.provenance.files.length) fail('File placement duplicato.');
  if (p.provenance.sourceVersion !== selection.provenance.sourceVersion)
    fail('Versione placement incompatibile.');
  for (const f of assembly.geometry.provenance.files)
    if (files.get(f.file) !== f.sha256) fail('Provenienza placement incompatibile.');
  const checkRef = (r: string) => {
    if (!files.has(r.slice(0, r.lastIndexOf(':')))) fail(`File placement non dichiarato: ${r}.`);
  };
  const a3 = selection.algorithm === 'source-selection-A3-v1';
  if (
    p.sections.length !== (a3 ? 7 : 4) ||
    (raw.algorithm === 'source-map-encounters-A3-v1') !== a3 ||
    (p.algorithm === 'source-encounter-placement-pack-A3-v1') !== a3
  )
    fail('Placement di un’altra ricetta.');
  const models = new Set(selection.encounters.map((e) => e.source));
  const tileModels = new Set(
    [...selection.standard, ...selection.custom].map((t) => t.modelSource),
  );
  if (p.models.length !== selection.encounters.length) fail('Metadati placement incompleti.');
  p.models.forEach((m, i) => {
    const e = selection.encounters[i]!;
    if (m.index !== i || m.source !== e.source || m.id !== e.id)
      fail('Identità placement incompatibile.');
    checkRef(m.source);
    checkRef(m.prefab.source);
    if (m.specificTileModelSource !== null && !tileModels.has(m.specificTileModelSource))
      fail('SpecificTile non risolto.');
    const path = m.prefab.path.replaceAll('\\', '/');
    if (
      !/^Assets\/Resources\/.+\.prefab$/i.test(path) ||
      path.slice('Assets/Resources/'.length, -'.prefab'.length).toLowerCase() !==
        m.prefab.resourceKey
    )
      fail('Prefab.Path e resource key incompatibili.');
  });
  p.sections.forEach((s, i) => {
    if (s.index !== i || s.source !== selection.sections[i]!.source)
      fail('Sezione placement incompatibile.');
    const fixed = [
      ...(s.tileEncounters ?? []).map((e) => e.encounterSource),
      ...(s.sectionEncounterSources ?? []),
    ];
    if (!same(fixed, selection.sections[i]!.fixedEncounterSources))
      fail('Riferimenti fixed incompatibili con selezione.');
    if (fixed.some((r) => !models.has(r))) fail('Fixed model non risolto.');
  });
  if (!same(p.adventureEncounterSources ?? [], selection.adventureEncounterSources))
    fail('AdventureEncounters incompatibili.');
  if (
    p.specifiedGroupSource !== null &&
    !selection.groups.some((g) => g.source === p.specifiedGroupSource)
  )
    fail('SpecifiedEncounterGroup non risolto.');
  return { ...raw, assembly };
}
export type EncounterInput = ReturnType<typeof parseEncounterInput>;
export const PlacementPackSchema = schema.shape.placement;
export type PlacementModel = EncounterInput['placement']['models'][number];
