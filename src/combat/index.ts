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
export { compileSourceDeployment, verifySourceDeployment } from './deployment-compiler';
export { generateDeployment } from './deployment';
export { compileCombatClosure, verifyCombatClosure, type CombatClosure } from './compiler';
export { selectGroupInstruction, groupAttackPacket } from './selection';
export { applyGroupHits, preflightCombatGroup, effectiveGroup, boonSupply } from './group';

export { threatMovements, moveEnemyOneSpace } from './movement';
