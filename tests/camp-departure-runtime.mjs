import { buildSync } from 'esbuild';
const code = buildSync({
  stdin: {
    contents: `export {refreshCampPreparation} from './src/scenario/camp-preparation'; export {CommandSchema} from './src/shared/protocol'; export {parseState,StateSchema} from './src/server/state'; export {archiveDomain,validateEpisodeState} from './src/server/episode-state'; export {campDepartureOffer,beginCampDeparture,projectCampDeckSource} from './src/scenario/camp-departure'; export {applyPhysicalCycle} from './src/server/physical-cycle'; export {BackupSchema,checksum} from './src/server/backup-format'; export {Store} from './src/server/store'; export {performCommand} from './src/server/commands';`,
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
  target: 'node24',
}).outputFiles[0].contents;
export const runtime = await import(
  `data:text/javascript;base64,${Buffer.from(Buffer.from(code).toString() + '\n//# sourceURL=camp-departure-runtime-test.mjs').toString('base64')}`
);
