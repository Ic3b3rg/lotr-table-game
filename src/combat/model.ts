import { z } from 'zod';
import { HashSchema, SourceSchema, ProjectionSchema } from '../shared/generated-map';
import { boundPhysicalInput } from '../physical-content/validation';

export const id = z.string().min(1).max(200);
export const count = z.int().min(0).max(10000);
export const stat = z.enum(['might', 'agility', 'spirit', 'wisdom', 'wit']);
export const modifier = z.enum(['pierce', 'stun']);
export const dependency = z.enum([
  'person-controller',
  'attack-controller',
  'attack-windows',
  'persistent-attack-hooks',
  'physical-consequences-p2',
  'scenario-continuation',
  'boon-quantities-57',
  'shadow-runtime',
  'terminal-loss',
]);
export type Dependency = z.infer<typeof dependency>;
export type Stat = z.infer<typeof stat>;
export type Modifier = z.infer<typeof modifier>;
const json = z.record(z.string().max(200), z.json());
const variable = z.strictObject({
  name: id,
  type: z.enum(['int', 'bool', 'string', 'object', 'vector3']),
  value: z.json(),
});
export const actionLocator = z.strictObject({ source: SourceSchema, state: count, action: count });
export const addition = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('flip-random'),
    family: z.enum(['damage', 'fear']),
    amount: count,
    window: z.literal('after-enemy-attack'),
  }),
  z.strictObject({
    kind: z.literal('gain-weakness'),
    amount: count,
    condition: z.literal('damage-positive'),
    window: z.literal('enemy-attack-physical-result'),
  }),
  z.strictObject({
    kind: z.literal('discard-prepared'),
    amount: count,
    window: z.literal('after-enemy-attack'),
  }),
  z.strictObject({
    kind: z.literal('gain-boon'),
    boon: z.enum(['emboldened', 'determined', 'hidden']),
    condition: z.literal('damage-positive'),
    window: z.literal('enemy-attack-physical-result'),
  }),
]);
export const CombatSourceSchema = z.strictObject({
  format: z.literal('combat-source-v1'),
  manifest: z.strictObject({
    scope: z.literal('first-combat-kernel-v1'),
    difficulty: z.literal('normal'),
    enemy: SourceSchema,
    spawns: z.array(actionLocator).min(1).max(8),
    files: z
      .array(
        z.strictObject({
          file: id,
          sha256: HashSchema,
          externals: z.array(z.strictObject({ id: z.int().min(1).max(100), file: id })).max(100),
        }),
      )
      .min(1)
      .max(32),
    mechanics: z
      .array(
        z.strictObject({
          capability: z.enum(['spawn-budget-v1', 'figure-hits-v1', 'counterattack-v1']),
          file: id,
          locator: id,
          sha256: HashSchema,
        }),
      )
      .length(3),
  }),
  projection: ProjectionSchema,
  assets: z
    .array(
      z.strictObject({
        source: SourceSchema,
        cls: z.enum([
          'EnemyModel',
          'EnemyActivationModel',
          'GameObject',
          'EnemyLogic',
          'IYieldableComponent',
          'PlayMakerFSM',
          'Tile',
          'TileSpace',
          'ItemModel',
        ]),
        objectHash: HashSchema,
        dataHash: HashSchema,
        data: json,
      }),
    )
    .min(1)
    .max(128),
  globals: z.array(variable).max(100),
  fsms: z
    .array(
      z.strictObject({
        source: SourceSchema,
        objectHash: HashSchema,
        start: id,
        variables: z.array(variable).max(100),
        handlers: z.record(id, count),
        deferredStates: z.array(z.strictObject({ index: count, name: id, dependency })).max(128),
        states: z
          .array(
            z.strictObject({
              index: count,
              name: id,
              transitions: z.record(id, count),
              actions: z
                .array(
                  z.strictObject({
                    index: count,
                    type: id,
                    enabled: z.literal(true),
                    parameterHash: HashSchema,
                    parameters: json,
                  }),
                )
                .max(64),
            }),
          )
          .min(1)
          .max(128),
      }),
    )
    .min(1)
    .max(8),
  items: z
    .array(
      z.strictObject({
        id,
        model: SourceSchema,
        file: id,
        locator: id,
        cells: z.strictObject({
          B: z.string().max(20),
          C: z.string().max(100),
          G: z.string().max(100),
          I: z.string().max(20),
          K: z.string().max(16384),
        }),
        ranged: z.literal(false),
      }),
    )
    .min(1)
    .max(32),
  texts: z
    .array(
      z.strictObject({
        key: id,
        file: id,
        locator: id,
        value: z.string().min(1).max(16384),
        sha256: HashSchema,
      }),
    )
    .min(1)
    .max(128),
  additions: z
    .array(z.strictObject({ key: id, textHash: HashSchema, operation: addition }))
    .max(32),
});
export type CombatSource = z.infer<typeof CombatSourceSchema>;
export type Addition = z.infer<typeof addition>;
export const check: (condition: unknown, message: string) => asserts condition = (ok, message) => {
  if (!ok) throw new Error(`Combattimento: ${message}`);
};
export function unique(values: (string | number)[], label: string) {
  check(new Set(values).size === values.length, `${label}: duplicato.`);
}
export function bounded(raw: unknown) {
  boundPhysicalInput(raw);
}
export function integer(raw: unknown, label: string, min = 0, max = 10000): number {
  check(
    typeof raw === 'number' && Number.isSafeInteger(raw) && raw >= min && raw <= max,
    `${label}: intero fuori limite.`,
  );
  return raw;
}
export function object(raw: unknown): Record<string, unknown> {
  check(!!raw && typeof raw === 'object' && !Array.isArray(raw), 'Record fonte richiesto.');
  return raw as Record<string, unknown>;
}
export function list(raw: unknown): unknown[] {
  check(Array.isArray(raw), 'Lista fonte richiesta.');
  return raw;
}
