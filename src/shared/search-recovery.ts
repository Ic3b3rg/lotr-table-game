import { z } from 'zod';

/** Printed source consequences; the acting hero comes from the encounter frame. */
export const SearchRecoverySchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('discard-physical'), count: z.literal(1) }),
  z.strictObject({ kind: z.literal('scout'), count: z.literal(2) }),
  z.strictObject({ kind: z.literal('look'), count: z.literal(2) }),
  z.strictObject({ kind: z.literal('scout-or-prepare'), count: z.literal(2) }),
]);
