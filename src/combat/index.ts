export { compileCombatSource, verifyCombatArtifact, type CombatArtifact } from './compiler';
export { createCombatKernel, restoreCombatKernel } from './kernel';
export type { CombatSeed, Continuation } from './kernel-model';
export type {
  TrustedCombatPort,
  AttackQuery,
  ExternalQuery,
  AttackPlan,
  EnemySelection,
} from './kernel-model';
export { combatCapability } from './capability';
