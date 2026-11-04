import { readyRounds, endTurns, finishCycle } from './original-round-helper.mjs';
import { attachFollowup } from './fixtures/shadow-followup.mjs';
import { attachCombat } from './combat-controller-helper.mjs';
import {
  attachActivationSource,
  attachActivationThreshold,
} from './fixtures/shadow-activations.mjs';
import { attachFailure } from './fixtures/adventure-failure.mjs';
import { attachThreats } from './fixtures/threat-continuations.mjs';
import { buildSync } from 'esbuild';
import { readSession } from './skill-test-helper.mjs';
import { answerFollowup } from './second-shadow-helper.mjs';
import assert from 'node:assert/strict';

const code = buildSync({
  stdin: {
    contents: `export { preflightSourceShadow, beginSourceShadow, applySourceThreat, advanceSourceShadow } from './src/scenario/round-source'; export { sourceDarknessHeroes } from './src/scenario/darkness'; export { beginHeroFailure } from './src/scenario/conclusion'; export { BackupSchema } from './src/server/backup-format'; export { parseState } from './src/server/state';`,
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
  target: 'node24',
});
export const runtime = await import(
  `data:text/javascript;base64,${Buffer.from(Buffer.from(code.outputFiles[0].contents).toString() + '\n//# sourceURL=threat-runtime-test.mjs').toString('base64')}`
);
export function readyThreats(t, { before = 60, limit = 62, perHero = 1, edit = () => {} } = {}) {
  return readyRounds(t, (pack, frozen) => {
    attachFollowup(pack, frozen);
    attachCombat(pack, frozen, (src) => {
      attachActivationSource(
        src,
        frozen.mapGeneration.projection.sections.flatMap((s) => s.tiles.map((t) => t.source)),
      );
      Object.assign(src.shadow.controller, pack.manifest.rounds.controller);
      attachActivationThreshold(src, pack);
    });
    attachFailure(pack);
    pack.globals.find((v) => v.name === 'pressure').value = before;
    Object.assign(pack.manifest.rounds.threat, {
      limit,
      perHero,
      perToken: 0,
      perUnexploredTile: 0,
    });
    attachThreats(pack);
    edit(pack, frozen);
  });
}
export async function drainThreats(ready, observe = () => {}) {
  for (let n = 0; n < 160; n++) {
    const s = await readSession(ready.host);
    await observe(s);
    if (!s.scenario.pending) {
      await finishCycle(ready);
      return readSession(ready.host);
    }
    if (s.scenario.conclusion) return s;
    const r = await answerFollowup(ready, s);
    assert.equal(r.status, 200, await r.text());
  }
  assert.fail('threshold continuation did not settle');
}
export { endTurns };
