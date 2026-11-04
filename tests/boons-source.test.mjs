import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readyScenario } from './scenario-helper.mjs';
import { reachPhysical } from './physical-helper.mjs';
import { state, text } from './fixtures/scenario.mjs';
import { boonFixture, boonGrant } from './fixtures/boons.mjs';
import { compileBoons, compilePhysicalFronts } from '../dist/physical-resolution-library.mjs';
import { digest } from '../dist/map-freeze-library.mjs';
import { readBackup } from './skill-test-helper.mjs';

test('consecutive reachable source actions preserve copy custody rather than reconstructing or dropping it', async (t) => {
  const f = boonFixture(),
    a = compileBoons(f.raw, f.boonInput);
  const combat = {
    version: 'combat-windows-v1',
    roundId: '00000000-0000-4000-8000-000000000099',
    artifactFingerprint: digest('invented context'),
    clauses: [],
    heroes: [],
  };
  const pr = (children) => ({
    profile: 'source-fronts-v1',
    combat,
    children,
    initialCredits: [0, 0],
    darknessHeroes: [],
    limits: [0, 1].map(() => ({ kind: 'requires-capability', capability: 'source-derived' })),
  });
  const ready = await readyScenario(t, (pack) => {
    pack.name = 'Fonte sintetica #94 · due azioni inventate';
    pack.manifest.scope = 'synthetic-physical-p1';
    pack.manifest.boons = { version: a.version, fingerprint: a.fingerprint };
    pack.definitions[0].states.find((s) => s.index === 9).transitions.FINISHED = 12;
    for (const [n, program] of [
      pr([boonGrant(0, 'hidden')]),
      pr([{ kind: 'test', hero: 0, stat: 'wit', target: null }]),
    ].entries())
      pack.definitions[0].states.push(
        state(
          12 + n,
          [
            {
              index: 0,
              op: 'physical',
              origin: {
                type: 'Synthetic.PhysicalProgram',
                parameterHash: digest(program),
                load: 'hash-match-positional',
              },
              text: text('Effetto inventato con custodia conservata.'),
              program,
            },
          ],
          { FINISHED: n ? 10 : 13 },
        ),
      );
  });
  for (const [name, value] of Object.entries({
    'physical-content': f.raw,
    'physical-fronts': compilePhysicalFronts(f.raw, f.ir, f.catalog),
    'physical-boons': a,
  }))
    await writeFile(join(ready.host.dataDir, name + '.json'), JSON.stringify(value));
  const s = await reachPhysical(ready);
  assert.equal(s.physical.active.options[0].id, 'reveal');
  const backup = await readBackup(ready.host),
    p = backup.payload.state.physical;
  assert.equal(p.runs.length, 2);
  assert.equal(p.snapshot.resolution.resources.boonCustody[0].kind, 'hidden');
  assert.equal(p.snapshot.parents[0].returnCount, 1);
});
