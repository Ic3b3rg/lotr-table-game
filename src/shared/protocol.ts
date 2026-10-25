import { z } from 'zod';
import { CatalogSummarySchema, ContentIdSchema } from './catalog';
import { CopyIdSchema, PreparationViewSchema } from './preparation';

export const NameSchema = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .regex(/^[^\u0000-\u001f\u007f]+$/);
export const IntentIdSchema = z
  .string()
  .min(24)
  .max(80)
  .regex(/^[A-Za-z0-9_-]+$/);
export const RecoveryCodeSchema = z
  .string()
  .max(64)
  .transform((value) => value.replace(/[\s-]/g, '').toUpperCase())
  .pipe(z.string().regex(/^[A-F0-9]{24}$/));
export const JoinSchema = z.strictObject({
  name: NameSchema,
  requestId: IntentIdSchema,
  recoveryCode: RecoveryCodeSchema,
  generation: z.uuid(),
});
export const RecoverSchema = z.strictObject({
  recoveryCode: RecoveryCodeSchema,
  generation: z.uuid(),
});
export const PlayerSchema = z.strictObject({ id: z.uuid(), name: NameSchema });
export const DemoSchema = z.strictObject({
  id: z.uuid(),
  choice: z.enum(['A', 'B']).nullable(),
  resolvedBy: z.uuid().nullable(),
});
export const SessionSchema = z.strictObject({
  schemaVersion: z.literal(2),
  id: z.uuid(),
  generation: z.uuid(),
  revision: z.int().nonnegative(),
  updatedAt: z.iso.datetime(),
  players: z.array(PlayerSchema).max(5),
  demo: DemoSchema.nullable().default(null),
  catalog: CatalogSummarySchema.nullable(),
  preparation: PreparationViewSchema.nullable(),
});
export const IdentitySchema = z.object({
  player: PlayerSchema.nullable(),
  canManageBackups: z.boolean(),
});
export const ErrorSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) });
const CommandBase = { requestId: IntentIdSchema, generation: z.uuid() };
export const CommandSchema = z.discriminatedUnion('type', [
  z.strictObject({ ...CommandBase, type: z.literal('PREPARE_COMPANY'), expectedRevision: z.int().nonnegative(), agreed: z.literal(true) }),
  z.strictObject({
    ...CommandBase,
    type: z.literal('SELECT_HEROES'),
    expectedRevision: z.int().nonnegative(),
    heroIds: z.array(ContentIdSchema).max(4),
  }),
  z.strictObject({
    ...CommandBase,
    type: z.literal('CONFIGURE_HERO'),
    expectedRevision: z.int().nonnegative(),
    heroId: ContentIdSchema,
    roleId: ContentIdSchema.nullable(),
    itemCopies: z.array(CopyIdSchema).max(3),
  }),
  z.strictObject({
    ...CommandBase,
    type: z.literal('OPEN_DEMO'),
    expectedDemoId: z.uuid().nullable(),
  }),
  z.strictObject({
    ...CommandBase,
    type: z.literal('RESOLVE_DEMO'),
    demoId: z.uuid(),
    choice: z.enum(['A', 'B']),
    agreed: z.literal(true),
  }),
]);
const DemoReceiptSchema = z.strictObject({
  requestId: IntentIdSchema,
  type: z.enum(['OPEN_DEMO', 'RESOLVE_DEMO']),
  appliedRevision: z.int().nonnegative(),
  demoId: z.uuid(),
  choice: z.enum(['A', 'B']).nullable(),
});
export const ReceiptSchema = z.union([
  DemoReceiptSchema,
  z.strictObject({
    requestId: IntentIdSchema,
    type: z.enum(['SELECT_HEROES', 'CONFIGURE_HERO', 'PREPARE_COMPANY']),
    appliedRevision: z.int().nonnegative(),
    preparationStatus: z.enum(['draft', 'prepared']),
  }),
]);
export const BackupPreviewSchema = z.object({
  format: z.literal('lotr-offline-session'),
  formatVersion: z.literal(1),
  exportedAt: z.iso.datetime(),
  payload: z.object({
    state: z.object({ players: z.array(PlayerSchema.strip()).max(5), updatedAt: z.iso.datetime() }),
  }),
});
export const HostSchema = z.object({
  isLoopbackOnly: z.boolean(),
  addresses: z.array(z.object({ address: z.ipv4(), label: z.string(), joinUrl: z.url() })),
});
export type Session = z.infer<typeof SessionSchema>;
export type HostInfo = z.infer<typeof HostSchema>;
export type Player = z.infer<typeof PlayerSchema>;
export type Command = z.infer<typeof CommandSchema>;
export type Receipt = z.infer<typeof ReceiptSchema>;

export type PreparationCommand = Extract<Command, { type: 'SELECT_HEROES' | 'CONFIGURE_HERO' | 'PREPARE_COMPANY' }>;
