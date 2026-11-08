import { buildSync } from 'esbuild';
const code = buildSync({
  stdin: {
    contents: `export {boonEnemyPositions} from './src/server/physical-spatial'; export {openCombatPhysical} from './src/combat/controller'; export {startPhaseEvent} from './src/scenario/runtime'; export {archivedState} from './src/server/episode-state'; export {validateBattleCombatSource,battleCombatPack,battleCombatProblems,battleDarknessHeroes} from './src/scenario/battle-combat'; export {createBattleScenario} from './src/scenario/battle-startup'; export {groupInRange,nearestThreatSteps} from './src/combat/movement'; export {preflightCombatOperation} from './src/combat/preflight'; export {initialCombat,startHeroAttack,advanceCombat,combatPending,answerCombat,combatView} from './src/combat/controller'; export {executeEpisodeIntent} from './src/server/physical-cycle'; export {beginHeroFailure,applyConclusionAction} from './src/scenario/conclusion'; export {scenarioView,ScenarioViewSchema} from './src/shared/scenario';`,
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
  target: 'node24',
}).outputFiles[0].contents;
export const battleRuntime = await import(
  `data:text/javascript;base64,${Buffer.from(Buffer.from(code).toString() + '\n//# sourceURL=battle-combat-runtime-test.mjs').toString('base64')}`
);
