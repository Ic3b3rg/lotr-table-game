import { z } from 'zod';

export const RuleIdSchema = z.enum(['manual', 'reference', 'faq', 'corrections']);
export const RuleCatalogSchema = z
  .array(
    z.strictObject({ id: RuleIdSchema, title: z.string().min(1).max(120), available: z.boolean() }),
  )
  .length(4);
