import { z } from 'zod';
export { boundPhysicalInput as bounded } from '../physical-content/validation';

const id = z.string().regex(/^[A-Za-z0-9_.-]{1,100}$/);
const ref = z.string().min(1).max(200);
export const fingerprint = z.string().regex(/^[0-9a-f]{64}$/);
const bits = z.string().regex(/^[0-9a-f]{8}$/);
const number = z.number().finite().min(-1e6).max(1e6);
const integer = z.int().min(0).max(1000000);
const scalar = z.strictObject({ value: number, float32le: bits });
const vector = z.tuple([number, number, number]);
const uv = z.tuple([number, number]);
const bits3 = z.tuple([bits, bits, bits]);
const transform = z.strictObject({
  record: ref,
  parent: ref.nullable(),
  position: z.tuple([scalar, scalar, scalar]),
  rotation: z.tuple([scalar, scalar, scalar, scalar]),
  scale: z.tuple([scalar, scalar, scalar]),
});
export const pinsSchema = z.strictObject({
  sourceFingerprint: fingerprint.optional(),
  artifactFingerprint: fingerprint.optional(),
});
export const sourceSchema = z.strictObject({
  format: z.literal('battle-map-source-v1'),
  algorithm: z.literal('rectilinear-patches-v1'),
  files: z
    .array(
      z.strictObject({
        id: ref,
        bytes: z.int().positive().max(Number.MAX_SAFE_INTEGER),
        sha256: fingerprint,
      }),
    )
    .min(1)
    .max(128),
  records: z
    .array(
      z.strictObject({
        id: ref,
        file: ref,
        locator: z.string().min(1).max(500),
        sha256: fingerprint,
        kind: z.enum([
          'resource-manager',
          'prefab',
          'adventure',
          'model',
          'build-settings',
          'manager',
          'board',
          'material',
          'texture',
          'transform',
          'mesh',
          'patch',
          'anchor',
        ]),
      }),
    )
    .min(1)
    .max(1024),
  resourceManager: z.strictObject({
    record: ref,
    entries: z
      .array(z.strictObject({ key: ref, target: ref }))
      .min(2)
      .max(16),
  }),
  prefab: z.strictObject({ record: ref, adventure: ref }),
  mechanics: z
    .array(
      z.strictObject({
        capability: z.enum([
          'resource-loading',
          'board-initialization',
          'skin-material',
          'root-merge',
        ]),
        file: ref,
        locator: z.string().min(1).max(500),
        sha256: fingerprint,
      }),
    )
    .length(4),
  adventure: z.strictObject({ record: ref, resourceKey: ref, model: ref }),
  model: z.strictObject({
    record: ref,
    resourceKey: ref,
    type: z.literal('battle'),
    boards: z
      .array(z.strictObject({ id, skin: integer }))
      .min(1)
      .max(4),
  }),
  buildSettings: z.strictObject({
    record: ref,
    scenes: z
      .array(z.strictObject({ index: integer, key: ref, manager: ref }))
      .min(1)
      .max(2),
  }),
  materials: z
    .array(z.strictObject({ record: ref, skin: integer, texture: ref }))
    .min(1)
    .max(16),
  textures: z
    .array(
      z.strictObject({
        record: ref,
        width: z.int().min(1).max(16384),
        height: z.int().min(1).max(16384),
        stream: z.strictObject({
          file: ref,
          offset: z.int().min(0).max(Number.MAX_SAFE_INTEGER),
          bytes: z.int().positive().max(Number.MAX_SAFE_INTEGER),
          sha256: fingerprint,
        }),
      }),
    )
    .min(1)
    .max(16),
  transforms: z.array(transform).min(1).max(512),
  meshes: z
    .array(
      z.strictObject({
        record: ref,
        codec: z.enum(['float32', 'packed']),
        vertices: z
          .array(
            z.strictObject({
              index: integer,
              position: vector,
              positionBits: bits3.nullable(),
              uv: uv.nullable(),
              uvBits: z.tuple([bits, bits]).nullable(),
            }),
          )
          .min(4)
          .max(512),
        submeshes: z
          .array(
            z.strictObject({
              index: integer,
              vertices: z.tuple([integer, integer, integer, integer]),
            }),
          )
          .min(1)
          .max(128),
      }),
    )
    .min(1)
    .max(256),
  alternatives: z
    .array(
      z.strictObject({
        id,
        scene: ref,
        manager: ref,
        root: ref,
        boards: z
          .array(
            z.strictObject({
              id,
              record: ref,
              transform: ref,
              patches: z
                .array(
                  z.strictObject({
                    record: ref,
                    mesh: ref,
                    submesh: integer,
                    transform: ref,
                    staticBatched: z.boolean(),
                  }),
                )
                .min(1)
                .max(64),
            }),
          )
          .min(1)
          .max(4),
      }),
    )
    .length(2),
  selectedAlternative: id,
  anchors: z
    .array(
      z.strictObject({
        id,
        kind: z.enum(['hero', 'spawn', 'terrain', 'search', 'threat', 'wall']),
        order: integer.nullable(),
        transform: ref,
        record: ref.nullable(),
        wall: z
          .strictObject({ mesh: ref, submesh: integer, children: z.array(ref).max(8) })
          .nullable(),
      }),
    )
    .min(1)
    .max(128),
  policy: z.strictObject({
    id,
    revision: z.int().positive(),
    evidence: z
      .array(
        z.strictObject({ file: ref, locator: z.string().min(1).max(500), sha256: fingerprint }),
      )
      .min(1)
      .max(32),
    assumptions: z.array(z.string().min(1).max(2000)).min(1).max(16),
    faces: z
      .array(
        z.strictObject({
          texture: ref,
          regions: z
            .array(z.strictObject({ id, patches: z.array(integer).min(1).max(64) }))
            .min(1)
            .max(64),
        }),
      )
      .min(1)
      .max(16),
  }),
  policyFingerprint: fingerprint,
  tolerances: z.strictObject({
    geometry: z.number().min(1e-10).max(0.002),
    uv: z.number().min(1e-10).max(0.002),
    wallDistance: z.number().min(1e-10).max(0.25),
    wallAlignment: z.number().min(1e-10).max(0.002),
  }),
});
export type BattleMapSource = z.infer<typeof sourceSchema>;
export type BattleMapPins = z.infer<typeof pinsSchema>;
export type Vec3 = [number, number, number];
export type Vec2 = [number, number];
export type Transform = BattleMapSource['transforms'][number];
export type Anchor = BattleMapSource['anchors'][number];
export type Alternative = BattleMapSource['alternatives'][number];
export function check(value: unknown, message: string): asserts value {
  if (!value) throw new Error(`Battle map: ${message}`);
}
export function unique(values: (string | number)[], label: string): void {
  check(new Set(values).size === values.length, `${label}: duplicate identity.`);
}
export const sorted = <T extends { id: string }>(values: T[]): T[] =>
  [...values].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
