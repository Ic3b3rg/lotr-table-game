import { z } from 'zod';

export const NameSchema = z.string().trim().min(1).max(32).regex(/^[^\u0000-\u001f\u007f]+$/);
export const JoinSchema = z.strictObject({ name: NameSchema });
export const PlayerSchema = z.strictObject({ id: z.uuid(), name: NameSchema });
export const SessionSchema = z.strictObject({
  id: z.uuid(), revision: z.int().nonnegative(), updatedAt: z.iso.datetime(),
  players: z.array(PlayerSchema).max(5),
});
export const HostSchema = z.object({
  addresses: z.array(z.object({ address: z.ipv4(), label: z.string(), joinUrl: z.url() })),
});
export type Session = z.infer<typeof SessionSchema>;
export type HostInfo = z.infer<typeof HostSchema>;
