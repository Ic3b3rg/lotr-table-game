import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readyPhysical, reachPhysical } from './physical-helper.mjs';
import { inventedFrontInput, diagnosticRaw, hash } from './fixtures/physical-fronts.mjs';
import { suffer } from './fixtures/physical-resolution.mjs';
import { compilePhysicalFronts } from '../dist/physical-resolution-library.mjs';
export async function readyFronts(t, edit = () => {}) {
  const ready = await readyPhysical(t, (pack, pr) => {
    pack.name = 'Prova sintetica P1 — fonte inventata, fronti verificati';
    pack.manifest.scope = 'synthetic-physical-p1';
    pr.profile = 'source-fronts-v1';
    pr.initialCredits = [0, 0];
    pr.darknessHeroes = [];
    pr.limits = [0, 1].map(() => ({ kind: 'requires-capability', capability: 'source-derived' }));
    pr.children = [{ ...suffer(0, 2, 0), face: 'faceup' }];
    edit(pack, pr);
    pack.definitions[0].states.at(-1).actions[0].origin.parameterHash = hash(pr);
  });
  const raw = diagnosticRaw(),
    input = inventedFrontInput(raw);
  for (const d of input.definitions.filter((d) => d.cardId.includes('damage')))
    d.body = [
      {
        op: 'choose-alternative',
        branches: [
          { op: 'discard-prepared', hero: 'self', n: 1 },
          { op: 'suffer', hero: 'self', family: 'fear', n: 1, face: 'down' },
        ],
      },
      { op: 'discard-self' },
    ];
  const artifact = compilePhysicalFronts(raw, input);
  await writeFile(join(ready.host.dataDir, 'physical-fronts.json'), JSON.stringify(artifact));
  return ready;
}
