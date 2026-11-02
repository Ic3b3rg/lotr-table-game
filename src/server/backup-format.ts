import { createHash } from 'node:crypto';
import { z } from 'zod';
import { IntentIdSchema, ReceiptSchema } from '../shared/protocol';
import { StateSchema, parseState } from './state';

const HashSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const BackupCommandSchema = z.strictObject({
  playerId: z.uuid(),
  requestId: IntentIdSchema,
  fingerprint: HashSchema,
  receipt: ReceiptSchema,
});
export const BackupPayloadSchema = z
  .strictObject({ state: StateSchema, commands: z.array(BackupCommandSchema).max(5000) })
  .superRefine((payload, ctx) => {
    const ids = new Set(payload.state.players.map((player) => player.id));
    const keys = new Set<string>();
    for (const command of payload.commands) {
      const key = `${command.playerId}:${command.requestId}`;
      if (
        keys.has(key) ||
        !ids.has(command.playerId) ||
        command.receipt.requestId !== command.requestId ||
        command.receipt.appliedRevision > payload.state.revision
      ) {
        ctx.addIssue({ code: 'custom', message: 'Registro delle conferme non coerente.' });
      }
      keys.add(key);
    }
  });
export type BackupPayload = z.infer<typeof BackupPayloadSchema>;

export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}
export const checksum = (payload: unknown) =>
  createHash('sha256').update(canonical(payload)).digest('hex');
export const BackupSchema = z
  .strictObject({
    format: z.literal('lotr-offline-session'),
    formatVersion: z.literal(1),
    exportedAt: z.iso.datetime(),
    payload: z.unknown(),
    checksum: HashSchema,
  })
  .transform((backup, ctx) => {
    if (checksum(backup.payload) !== backup.checksum) {
      ctx.addIssue({ code: 'custom', message: 'La copia è stata modificata o è incompleta.' });
      return z.NEVER;
    }
    try {
      const raw = z
        .strictObject({ state: z.unknown(), commands: z.unknown() })
        .parse(backup.payload);
      const payload = BackupPayloadSchema.parse({
        state: parseState(raw.state),
        commands: raw.commands,
      });
      return { ...backup, payload };
    } catch {
      ctx.addIssue({
        code: 'custom',
        message: 'Il salvataggio contiene dati incompatibili o incoerenti.',
      });
      return z.NEVER;
    }
  });
export const RestoreSchema = z.strictObject({
  backup: BackupSchema,
  generation: z.uuid(),
  expectedRevision: z.int().nonnegative(),
  confirmed: z.literal(true),
});
export type Restore = z.infer<typeof RestoreSchema>;
