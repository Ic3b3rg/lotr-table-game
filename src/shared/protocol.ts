import { z } from 'zod';

export const NameSchema = z.string().trim().min(1).max(32).regex(/^[^\u0000-\u001f\u007f]+$/);
export const IntentIdSchema = z.string().min(24).max(80).regex(/^[A-Za-z0-9_-]+$/);
export const RecoveryCodeSchema = z.string().max(64).transform(value => value.replace(/[\s-]/g, '').toUpperCase()).pipe(z.string().regex(/^[A-F0-9]{24}$/));
export const JoinSchema = z.strictObject({ name: NameSchema, requestId: IntentIdSchema, recoveryCode: RecoveryCodeSchema, generation: z.uuid() });
export const RecoverSchema = z.strictObject({ recoveryCode: RecoveryCodeSchema, generation: z.uuid() });
export const PlayerSchema = z.strictObject({ id: z.uuid(), name: NameSchema });
export const SessionSchema = z.strictObject({
  id: z.uuid(), generation: z.uuid(), revision: z.int().nonnegative(), updatedAt: z.iso.datetime(),
  players: z.array(PlayerSchema).max(5),
});
export const IdentitySchema = z.object({ player: PlayerSchema.nullable() });
export const ErrorSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) });
export const HostSchema = z.object({
  addresses: z.array(z.object({ address: z.ipv4(), label: z.string(), joinUrl: z.url() })),
});
export type Session = z.infer<typeof SessionSchema>;
export type HostInfo = z.infer<typeof HostSchema>;
export type Player = z.infer<typeof PlayerSchema>;
