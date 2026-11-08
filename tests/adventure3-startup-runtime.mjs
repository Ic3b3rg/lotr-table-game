import { buildSync } from 'esbuild';
const code = buildSync({
  stdin: {
    contents: `export * from './src/scenario/journey-startup-source'; export {validateScenarioBinding} from './src/scenario/pack'; export {parseState,StateSchema} from './src/server/state'; export {validateEpisodeState,validateEpisodeReceipts} from './src/server/episode-state'; export {validateCampDepartureSource,campDepartureOffer,beginCampDeparture} from './src/scenario/camp-departure';`,
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
  `data:text/javascript;base64,${Buffer.from(Buffer.from(code).toString() + '\n//# sourceURL=adventure3-startup-runtime-test.mjs').toString('base64')}`
);
