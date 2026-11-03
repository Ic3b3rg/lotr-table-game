import { z } from 'zod';
import { ContentIdSchema } from './catalog';
import { RoundSchema } from './rounds';
import { JourneySchema } from './journey-map';
import { PhysicalInputSchema } from './physical';
import { PreparationSchema } from './preparation';
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const base = { expectedRevision: z.int().nonnegative(), roundId: z.uuid() };
const hero = { ...base, heroId: ContentIdSchema };
const turn = { ...hero, turnId: z.uuid() };
export const CycleAnswerSchema = z.strictObject({
  type: z.literal('CYCLE_INPUT'),
  expectedRevision: z.int().nonnegative(),
  runId: z.uuid(),
  pendingId: z.uuid(),
  sourceFingerprint: hash,
  input: PhysicalInputSchema,
});
export const CycleIntentSchema = z.discriminatedUnion('type', [
  z.strictObject({ ...hero, type: z.literal('START_TURN'), agreed: z.literal(true) }),
  z.strictObject({ ...turn, type: z.literal('END_TURN') }),
  z.strictObject({ ...turn, type: z.literal('START_TRAVEL'), mapId: z.uuid() }),
  z.strictObject({
    ...turn,
    type: z.literal('MOVE_HERO'),
    mapId: z.uuid(),
    fromSpaceId: z.string(),
    destinationSpaceId: z.string(),
  }),
  z.strictObject({ ...base, type: z.literal('BEGIN_SHADOW'), agreed: z.literal(true) }),
  z.strictObject({
    ...base,
    type: z.literal('CONFIRM_SHADOW_STEP'),
    step: z.enum(['enemies', 'darkness', 'threat']),
    agreed: z.literal(true),
  }),
  z.strictObject({ ...base, type: z.literal('END_RALLY'), agreed: z.literal(true) }),
  z.strictObject({ ...hero, type: z.literal('START_RALLY_SCOUT') }),
  CycleAnswerSchema,
]);
export const CyclePendingSchema = z.strictObject({
  runId: z.uuid(),
  type: z.enum(['END_TURN', 'START_RALLY_SCOUT', 'CONFIRM_SHADOW_STEP']),
  heroId: ContentIdSchema,
});
export const CycleStateSchema = z.strictObject({
  version: z.literal(1),
  seed: z.strictObject({
    revision: z.int().nonnegative(),
    round: RoundSchema,
    journey: JourneySchema,
    preparation: PreparationSchema.optional(),
  }),
  records: z
    .array(
      z.strictObject({
        playerId: z.uuid(),
        requestId: z.string().min(24).max(80),
        intent: CycleIntentSchema,
      }),
    )
    .min(1)
    .max(4000),
  pending: CyclePendingSchema.nullable(),
});
export type CycleState = z.infer<typeof CycleStateSchema>;
export type CycleIntent = z.infer<typeof CycleIntentSchema>;
