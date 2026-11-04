import { z } from 'zod';
import { HashSchema, SourceSchema } from './generated-map';

const method = z.strictObject({
  assemblyHash: HashSchema,
  method: z.string().regex(/^06[0-9a-f]{6}$/),
  bodyHash: HashSchema,
});
const receiver = {
  source: SourceSchema,
  owner: SourceSchema,
  definition: SourceSchema,
  threshold: z.int().positive().max(999),
};
export const ThreatContinuationsSchema = z.strictObject({
  version: z.literal('source-threat-continuations-v1'),
  projectionFingerprint: HashSchema,
  evidenceHash: HashSchema,
  roundsFingerprint: HashSchema,
  deploymentFingerprint: HashSchema,
  failureFingerprint: HashSchema,
  methods: z.strictObject({
    controller: method,
    compare: method,
    register: method,
    unique: method,
    callback: method,
    limit: method,
  }),
  thresholds: z
    .array(
      z.strictObject({
        ...receiver,
        form: z.enum(['spawn-register', 'darkness-spawn-register', 'spawn-terminal']),
        multiplier: z.int().positive().max(100),
        next: z.strictObject(receiver).nullable(),
        definitionHash: HashSchema,
        evidenceHash: HashSchema,
      }),
    )
    .length(3),
});
export const ThreatCauseSchema = z.strictObject({
  kind: z.literal('threat'),
  before: z.int().nonnegative(),
  after: z.int().nonnegative(),
  limit: z.int().positive(),
  frameId: z.uuid().nullable(),
  controllerHash: HashSchema,
});
