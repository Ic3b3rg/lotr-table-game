import { scenarioReceiptProblem } from '../scenario/validate';
import { digest } from '../map-freeze/hash';
import { z } from 'zod';
import { IntentIdSchema, ReceiptSchema } from '../shared/protocol';
import { StateSchema, parseState } from './state';
import { journeyBudgetProblem } from './journey-map';
import { generationReceiptProblem } from './generation-state';

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
    const scenarioProblem = scenarioReceiptProblem(payload.state, payload.commands);
    if (scenarioProblem) ctx.addIssue({ code: 'custom', message: scenarioProblem });
    const generationProblem = generationReceiptProblem(payload.state, payload.commands);
    if (generationProblem) ctx.addIssue({ code: 'custom', message: generationProblem });
    const budgetProblem = journeyBudgetProblem(
      payload.state,
      payload.commands.map((command) => command.receipt),
    );
    if (budgetProblem) ctx.addIssue({ code: 'custom', message: budgetProblem });
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

export { canonical } from '../map-freeze/hash';
export const checksum = digest;
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
      const version =
        raw.state && typeof raw.state === 'object' && 'schemaVersion' in raw.state
          ? raw.state.schemaVersion
          : 1;
      if (typeof version === 'number' && version <= 35 && Array.isArray(raw.commands))
        for (const command of raw.commands)
          if (command?.receipt?.departure?.version === 'camp-departure-v2')
            throw new Error('Ricevuta prospettica viaggio3 sotto uno schema storico.');
      if (typeof version === 'number' && version <= 30 && Array.isArray(raw.commands))
        for (const command of raw.commands) {
          const receipt = command?.receipt;
          if (receipt && (receipt.departure !== undefined || receipt.kind === 'camp-depart'))
            throw new Error('Ricevuta partenza non valida per uno schema storico.');
        }
      if (typeof version === 'number' && version <= 28 && Array.isArray(raw.commands))
        for (const command of raw.commands) {
          const receipt =
            command && typeof command === 'object' && 'receipt' in command ? command.receipt : null;
          if (
            receipt &&
            typeof receipt === 'object' &&
            ('preparation' in receipt ||
              ('kind' in receipt &&
                [
                  'camp-prepare',
                  'camp-select-role',
                  'camp-accessory',
                  'camp-confirm',
                  'camp-return',
                ].includes(String(receipt.kind))))
          )
            throw new Error('Ricevuta preparazione non valida per uno schema storico.');
        }
      if (typeof version === 'number' && version <= 27 && Array.isArray(raw.commands))
        for (const command of raw.commands) {
          const receipt =
            command && typeof command === 'object' && 'receipt' in command ? command.receipt : null;
          if (
            receipt &&
            typeof receipt === 'object' &&
            ('item' in receipt || ('kind' in receipt && receipt.kind === 'camp-item'))
          )
            throw new Error('Ricevuta oggetto del campo non valida per uno schema storico.');
        }
      if (typeof version === 'number' && version <= 26 && Array.isArray(raw.commands))
        for (const command of raw.commands) {
          const receipt =
            command && typeof command === 'object' && 'receipt' in command ? command.receipt : null;
          if (
            receipt &&
            typeof receipt === 'object' &&
            ('skill' in receipt || ('kind' in receipt && receipt.kind === 'camp-skill'))
          )
            throw new Error('Ricevuta del campo non valida per uno schema storico.');
        }
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
