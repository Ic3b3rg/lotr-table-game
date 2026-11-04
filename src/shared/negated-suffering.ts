import { z } from 'zod';
import { StatSchema } from './skill-tests';

/** Source-directed suffering with a test to negate, never a binary pass/fail test. */
export const NegatedSufferingSchema = z.strictObject({
  negate: StatSchema,
  family: z.enum(['damage', 'fear']),
  amount: z.int().min(1).max(56),
  face: z.enum(['faceup', 'facedown']),
});
