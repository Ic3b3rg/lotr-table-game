import assert from 'node:assert/strict';
import { reachPhysical } from './physical-helper.mjs';
import { scenarioInput } from './scenario-helper.mjs';
import { readSession } from './skill-test-helper.mjs';
import { hash } from './fixtures/physical-fronts.mjs';
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { relative } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readyFronts } from './physical-front-helper.mjs';
import { inventedFrontInput, diagnosticRaw } from './fixtures/physical-fronts.mjs';
import { inventedLastStand } from './fixtures/last-stand.mjs';
import { catalogFixture } from './fixtures/catalog.mjs';
import { suffer } from './fixtures/physical-resolution.mjs';
import { compileLastStand, compilePhysicalFronts } from '../dist/physical-resolution-library.mjs';

export async function readyLastStand(
  t,
  edit = () => {},
  frontEdit = () => {},
  catalogEdit = () => {},
) {
  const ready = await readyFronts(
    t,
    (pack, pr) => {
      pr.children = [suffer(0, 5, 0)];
      edit(pack, pr);
    },
    catalogEdit,
  );
  const raw = diagnosticRaw(),
    input = inventedFrontInput(raw),
    catalog = catalogFixture();
  catalogEdit(catalog);
  frontEdit(input, catalog);
  const artifact = compileLastStand(raw, inventedLastStand(raw));
  await writeFile(
    join(ready.host.dataDir, 'physical-fronts.json'),
    JSON.stringify(compilePhysicalFronts(raw, input, catalog)),
  );
  const lastStandPath = join(ready.host.dataDir, 'physical-last-stand.json');
  await writeFile(lastStandPath, JSON.stringify(artifact));
  return { ...ready, lastStandPath };
}

export async function historicalPhysical() {
  const base = 'fa110b69ee35a7fb86f27fe2a8362d35b3fc4a8f';
  const { outputFiles } = await build({
    stdin: {
      contents: "export * from './src/physical-resolution/index.ts';",
      resolveDir: process.cwd(),
    },
    bundle: true,
    platform: 'node',
    format: 'esm',
    write: false,
    logLevel: 'silent',
    plugins: [
      {
        name: 'read-released-main',
        setup(b) {
          b.onLoad({ filter: /\.ts$/ }, (args) => {
            const path = relative(process.cwd(), args.path);
            if (path.startsWith('src/'))
              return {
                contents: execFileSync('git', ['show', `${base}:${path}`], { encoding: 'utf8' }),
                loader: 'ts',
              };
          });
        },
      },
    ],
  });
  return import(
    'data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64')
  );
}

export async function waitingLastStand(t) {
  const ready = await readyLastStand(t, (pack) => {
    pack.preparedEffects = [
      {
        skillId: 'role-1-skill-1',
        cardHash: hash(catalogFixture().skills.find((s) => s.id === 'role-1-skill-1')),
        effect: 'inspiration',
        amount: 1,
      },
    ];
  });
  await reachPhysical(ready);
  const r = await scenarioInput(ready.host, ready.player, {
    kind: 'physical-choice',
    option: 'reveal',
  });
  assert.equal(r.status, 200, await r.text());
  return ready;
}
export async function recoverSeat(host, seat) {
  const s = await readSession(host);
  const r = await host.request('/api/recover', {
    generation: s.generation,
    recoveryCode: seat.recoveryCode,
  });
  assert.equal(r.status, 200, await r.text());
  seat.cookie = r.headers.get('set-cookie')?.split(';')[0];
}
