import { buildSync } from 'esbuild';
const built = buildSync({
  stdin: {
    resolveDir: process.cwd(),
    contents: `
    export {parseState,StateSchema} from './src/server/state';
    export {BackupSchema} from './src/server/backup-format';
    export {requireBeforeInteraction} from './src/server/interaction-window';
    export {privateLookView} from './src/server/private-look';
    export {beforeInteractionEffects,beforeOrderFeasible,afterKnownEffect} from './src/physical-resolution/interaction-look';
    export {interactScenario} from './src/scenario/runtime';
    export {encounterProgram} from './src/scenario/encounter-physical';
    export {nextProvocation,combatPending,answerCombat} from './src/combat/controller';
    export {replayPhysical,validatePhysical} from './src/physical-resolution/runtime';
  `,
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  write: false,
});
export const runtime = await import(
  `data:text/javascript;base64,${Buffer.from(built.outputFiles[0].contents).toString('base64')}`
);
