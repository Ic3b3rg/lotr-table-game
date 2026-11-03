import { createHash } from 'node:crypto';
import { canonical } from '../shared/canonical';
export { canonical } from '../shared/canonical';
export const digest = (value: unknown) =>
  createHash('sha256').update(canonical(value)).digest('hex');
